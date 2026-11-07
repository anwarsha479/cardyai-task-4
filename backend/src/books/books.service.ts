import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, IsNull } from 'typeorm';
import { Role } from '../auth/enums/role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Clock, CLOCK } from '../common/clock/clock';
import { AppError, RuleReason } from '../common/exceptions/app-error';
import { likePattern } from '../common/utils/like-pattern';
import { availabilityByBook, copiesInUse, lockBook, offerFreeCopies, processExpiredHolds, queuePositions } from '../lending/copy-queue';
import { Loan } from '../lending/entities/loan.entity';
import { Reservation } from '../lending/entities/reservation.entity';
import { ReservationStatus } from '../lending/enums/reservation-status.enum';
import { copiesAbove, isHoldExpired } from '../lending/utils/lending-rules.util';
import { SettingsService } from '../settings/settings.service';
import { CreateBookDto, ListBooksQueryDto, UpdateBookDto } from './dto/book.dto';
import { BookPageDto, BookViewDto } from './dto/book-view.dto';
import { Book } from './entities/book.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The cursor is the sort key of the last book on the page: (lower(title), id), opaque to clients. */
function encodeCursor(sortTitle: string, id: string): string {
  return Buffer.from(JSON.stringify([sortTitle, id])).toString('base64url');
}

function decodeCursor(cursor: string): [string, string] {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string' && UUID.test(value[1])) {
      return [value[0], value[1]];
    }
  } catch {
    // Falls through to the validation error below.
  }
  throw AppError.validation({ cursor: ['This cursor is not valid. Start again from the first page.'] });
}

@Injectable()
export class BooksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  /**
   * One page of the catalogue, sorted by title. Keyset paging: each page starts after the previous
   * page's last (lower(title), id), so a page costs the same however deep it is and never repeats or
   * skips a book while others are added.
   */
  async list(user: AuthUser, query: ListBooksQueryDto): Promise<BookPageDto> {
    if (query.filter === 'mine' && user.role !== Role.Member) {
      throw AppError.validation({ filter: ['Only members have books of their own'] });
    }
    const base = this.dataSource.manager.createQueryBuilder(Book, 'book');
    if (query.search) {
      const q = likePattern(query.search);
      base.andWhere(new Brackets((w) => w.where('book.title ILIKE :q', { q }).orWhere('book.author ILIKE :q', { q })));
    }
    if (query.filter === 'available') {
      base.andWhere(
        `book.total_copies > (SELECT count(*) FROM loans l WHERE l.book_id = book.id AND l.returned_at IS NULL)
                           + (SELECT count(*) FROM reservations r WHERE r.book_id = book.id AND r.status = 'ready')`,
      );
    }
    if (query.filter === 'mine') {
      base.andWhere(
        `(EXISTS (SELECT 1 FROM loans l WHERE l.book_id = book.id AND l.member_id = :me AND l.returned_at IS NULL)
          OR EXISTS (SELECT 1 FROM reservations r WHERE r.book_id = book.id AND r.member_id = :me AND r.status IN ('waiting', 'ready')))`,
        { me: user.id },
      );
    }
    const total = await base.clone().getCount();

    const page = base.clone().addSelect('lower(book.title)', 'sort_title').orderBy('lower(book.title)').addOrderBy('book.id');
    if (query.cursor) {
      const [afterTitle, afterId] = decodeCursor(query.cursor);
      page.andWhere('(lower(book.title), book.id) > (:afterTitle, CAST(:afterId AS uuid))', { afterTitle, afterId });
    }
    const { entities, raw } = await page.limit(query.limit + 1).getRawAndEntities<{ sort_title: string }>();
    const hasMore = entities.length > query.limit;
    const books = entities.slice(0, query.limit);
    const last = books.length - 1;
    return {
      items: await this.views(this.dataSource.manager, user, books),
      nextCursor: hasMore ? encodeCursor(raw[last].sort_title, books[last].id) : null,
      total,
    };
  }

  async get(user: AuthUser, id: string): Promise<BookViewDto> {
    const book = await this.dataSource.manager.findOneBy(Book, { id });
    if (!book) throw AppError.notFound('Book');
    const [view] = await this.views(this.dataSource.manager, user, [book]);
    return view;
  }

  async create(user: AuthUser, dto: CreateBookDto): Promise<BookViewDto> {
    const now = this.clock.now();
    const book = await this.dataSource.manager.save(Book, { ...dto, createdAt: now, updatedAt: now });
    return this.get(user, book.id);
  }

  /** Lowering the count is refused if it would remove a copy on loan or on hold; new copies go to the queue first. */
  async update(user: AuthUser, id: string, dto: UpdateBookDto): Promise<BookViewDto> {
    const now = this.clock.now();
    await this.dataSource.transaction(async (manager) => {
      const book = await lockBook(manager, id);
      const limits = await this.settings.getLimits(manager);
      await processExpiredHolds(manager, book, now, limits);
      if (dto.totalCopies !== undefined && dto.totalCopies < book.totalCopies) {
        const inUse = await copiesInUse(manager, id);
        const removed = copiesAbove(inUse.map((c) => c.copyNumber), dto.totalCopies);
        if (removed.length > 0) {
          throw AppError.rule(
            RuleReason.COPIES_IN_USE,
            `Copies ${removed.join(', ')} are on loan or on hold. Lower the count once they are back.`,
            { copies: removed },
          );
        }
      }
      Object.assign(book, dto, { updatedAt: now });
      await manager.save(Book, book);
      await offerFreeCopies(manager, book, now, limits);
    });
    return this.get(user, id);
  }

  private async views(manager: EntityManager, user: AuthUser, books: Book[]): Promise<BookViewDto[]> {
    if (books.length === 0) return [];
    const now = this.clock.now();
    const availability = await availabilityByBook(manager, books);
    const ids = books.map((b) => b.id);
    const isMember = user.role === Role.Member;
    const loans = isMember
      ? await manager.find(Loan, { where: { memberId: user.id, bookId: In(ids), returnedAt: IsNull() } })
      : [];
    const openLoans = new Map(loans.map((l) => [l.bookId, l]));
    const reservations = isMember
      ? await manager.find(Reservation, {
          where: { memberId: user.id, bookId: In(ids), status: In([ReservationStatus.Waiting, ReservationStatus.Ready]) },
        })
      : [];
    const positions = await queuePositions(manager, reservations.map((r) => r.id));
    const activeReservations = new Map(reservations.map((r) => [r.bookId, r]));

    return books.map((book) => {
      const loan = openLoans.get(book.id);
      const reservation = activeReservations.get(book.id);
      const expired =
        reservation?.status === ReservationStatus.Ready && isHoldExpired(reservation.holdExpiresAt!, now);
      return {
        id: book.id,
        title: book.title,
        author: book.author,
        totalCopies: book.totalCopies,
        availability: availability.get(book.id)!,
        myLoan: loan ? { id: loan.id, copyNumber: loan.copyNumber, dueAt: loan.dueAt } : null,
        myReservation:
          reservation && !expired
            ? {
                id: reservation.id,
                status: reservation.status,
                position: positions.get(reservation.id) ?? null,
                holdExpiresAt: reservation.holdExpiresAt,
              }
            : null,
      };
    });
  }
}
