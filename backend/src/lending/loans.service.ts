import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, QueryFailedError } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Clock, CLOCK } from '../common/clock/clock';
import { AppError, RuleReason } from '../common/exceptions/app-error';
import { likePattern } from '../common/utils/like-pattern';
import { SettingsService } from '../settings/settings.service';
import { freeCopy, lockBook, offerFreeCopies, processExpiredHolds, unpaidBalance } from './copy-queue';
import { LoanViewDto, toLoanView } from './dto/lending-views.dto';
import { ListLoansQueryDto, LoanDeskSummaryDto, OpenLoanPageDto, ReturnResultDto } from './dto/loan.dto';
import { Loan } from './entities/loan.entity';
import { Reservation } from './entities/reservation.entity';
import { ReservationStatus } from './enums/reservation-status.enum';
import { assertNotBlocked, computeFine, daysLate, dueAt } from './utils/lending-rules.util';

const OPEN_COPY_INDEX = 'ux_loans_open_copy';
const OPEN_MEMBER_BOOK_INDEX = 'ux_loans_open_member_book';

export function uniqueViolation(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null;
  const driver = error.driverError as { code?: string; constraint?: string };
  return driver.code === '23505' ? (driver.constraint ?? '') : null;
}

export function alreadyBorrowed(): AppError {
  return AppError.rule(RuleReason.ALREADY_BORROWED, 'You already have a copy of this book');
}

function noCopyAvailable(): AppError {
  return AppError.rule(RuleReason.NO_COPY_AVAILABLE, 'No copy is free right now. Reserve the book to join the queue.');
}

@Injectable()
export class LoansService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Lends the member a copy: the one held for them, or else the lowest free copy. The book lock keeps
   * the queue in order; ux_loans_open_copy guarantees a copy is never lent twice.
   */
  async checkout(user: AuthUser, bookId: string): Promise<LoanViewDto> {
    const now = this.clock.now();
    let loanId: string;
    try {
      loanId = await this.dataSource.transaction(async (manager) => {
        const book = await lockBook(manager, bookId);
        const limits = await this.settings.getLimits(manager);
        await processExpiredHolds(manager, book, now, limits);

        const [mine] = await manager.query(
          `SELECT 1 FROM loans WHERE book_id = $1 AND member_id = $2 AND returned_at IS NULL`,
          [bookId, user.id],
        );
        if (mine) throw alreadyBorrowed();
        assertNotBlocked(await unpaidBalance(manager, user.id), limits.fineBlockThresholdCents);
        const active = await manager.countBy(Loan, { memberId: user.id, returnedAt: IsNull() });
        if (active >= limits.maxActiveLoans) {
          throw AppError.rule(
            RuleReason.LOAN_LIMIT_REACHED,
            `You can have at most ${limits.maxActiveLoans} books at a time. Return one to borrow another.`,
            { max: limits.maxActiveLoans, active },
          );
        }

        const myHold = await manager.findOne(Reservation, {
          where: { bookId, memberId: user.id, status: ReservationStatus.Ready },
          lock: { mode: 'pessimistic_write' },
        });
        const copy = myHold ? myHold.heldCopyNumber : await freeCopy(manager, book);
        if (copy === null) throw noCopyAvailable();

        const [{ id }] = await manager.query(
          `INSERT INTO loans (book_id, copy_number, member_id, checked_out_at, due_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $4) RETURNING id`,
          [bookId, copy, user.id, now, dueAt(now, limits.loanPeriodDays)],
        );
        if (myHold) {
          await manager.update(Reservation, { id: myHold.id }, { status: ReservationStatus.Fulfilled, closedAt: now, loanId: id });
        }
        return id as string;
      });
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint === OPEN_COPY_INDEX) throw noCopyAvailable();
      if (constraint === OPEN_MEMBER_BOOK_INDEX) throw alreadyBorrowed();
      throw error;
    }
    return this.view(loanId);
  }

  /** Charges the fine for late days and hands the copy to the first member in the queue. */
  async returnLoan(user: AuthUser, loanId: string): Promise<ReturnResultDto> {
    const now = this.clock.now();
    const found = await this.dataSource.manager.findOneBy(Loan, { id: loanId });
    if (!found) throw AppError.notFound('Loan');

    const heldForId = await this.dataSource.transaction(async (manager) => {
      const book = await lockBook(manager, found.bookId);
      const loan = await manager.findOneOrFail(Loan, { where: { id: loanId }, lock: { mode: 'pessimistic_write' } });
      if (loan.returnedAt) {
        throw AppError.rule(RuleReason.INVALID_STATE, 'This loan has already been returned', { returnedAt: loan.returnedAt });
      }
      const limits = await this.settings.getLimits(manager);
      await processExpiredHolds(manager, book, now, limits);
      const lateDays = daysLate(loan.dueAt, now);
      await manager.update(
        Loan,
        { id: loanId },
        {
          returnedAt: now,
          returnedById: user.id,
          daysLate: lateDays,
          fineCents: computeFine(lateDays, limits.finePerDayCents, limits.maxFinePerLoanCents),
        },
      );
      await offerFreeCopies(manager, book, now, limits);
      const held = await manager.findOneBy(Reservation, {
        bookId: book.id,
        heldCopyNumber: loan.copyNumber,
        status: ReservationStatus.Ready,
      });
      return held?.id ?? null;
    });

    const loan = await this.view(loanId);
    if (!heldForId) return { loan, heldFor: null };
    const held = await this.dataSource.manager.findOneOrFail(Reservation, { where: { id: heldForId }, relations: { member: true } });
    return {
      loan,
      heldFor: {
        reservationId: held.id,
        member: { id: held.member!.id, name: held.member!.name, email: held.member!.email },
        holdExpiresAt: held.holdExpiresAt!,
      },
    };
  }

  /** One page of open loans, soonest due first, plus desk totals across all open loans. */
  async listOpen(query: ListLoansQueryDto): Promise<OpenLoanPageDto> {
    const now = this.clock.now();
    const limits = await this.settings.getLimits();
    const list = this.dataSource.manager
      .createQueryBuilder(Loan, 'loan')
      .innerJoinAndSelect('loan.book', 'book')
      .innerJoinAndSelect('loan.member', 'member')
      .where('loan.returned_at IS NULL');
    if (query.overdue) list.andWhere('loan.due_at < :now', { now });
    if (query.search) {
      const q = likePattern(query.search);
      list.andWhere(new Brackets((w) => w.where('book.title ILIKE :q', { q }).orWhere('member.name ILIKE :q', { q })));
    }
    const [loans, total] = await list
      .orderBy('loan.dueAt', 'ASC')
      .addOrderBy('loan.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    // Same rule as daysLate and computeFine: every started day after the due instant, capped per loan.
    const [summary]: LoanDeskSummaryDto[] = await this.dataSource.query(
      `SELECT count(*)::int AS open,
              count(*) FILTER (WHERE due_at < $1)::int AS overdue,
              coalesce(max(ceil(extract(epoch FROM $1::timestamptz - due_at) / 86400)) FILTER (WHERE due_at < $1), 0)::int AS "oldestDaysLate",
              coalesce(sum(least(ceil(extract(epoch FROM $1::timestamptz - due_at) / 86400) * $2, $3)) FILTER (WHERE due_at < $1), 0)::int AS "accruingFineCents"
         FROM loans WHERE returned_at IS NULL`,
      [now, limits.finePerDayCents, limits.maxFinePerLoanCents],
    );
    return { items: loans.map((l) => toLoanView(l, now, limits)), total, page: query.page, pageSize: query.pageSize, summary };
  }

  private async view(id: string): Promise<LoanViewDto> {
    const loan = await this.dataSource.manager.findOneOrFail(Loan, { where: { id }, relations: { book: true, member: true } });
    return toLoanView(loan, this.clock.now(), await this.settings.getLimits());
  }
}
