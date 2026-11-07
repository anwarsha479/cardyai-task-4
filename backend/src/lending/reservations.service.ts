import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Clock, CLOCK } from '../common/clock/clock';
import { AppError, RuleReason } from '../common/exceptions/app-error';
import { SettingsService } from '../settings/settings.service';
import { freeCopy, lockBook, offerFreeCopies, processExpiredHolds, queuePositions, unpaidBalance } from './copy-queue';
import { ReservationViewDto, toReservationView } from './dto/lending-views.dto';
import { Reservation } from './entities/reservation.entity';
import { ReservationStatus } from './enums/reservation-status.enum';
import { alreadyBorrowed, uniqueViolation } from './loans.service';
import { assertNotBlocked } from './utils/lending-rules.util';

const ONE_ACTIVE_INDEX = 'ux_reservations_one_active';

function alreadyReserved(): AppError {
  return AppError.rule(RuleReason.ALREADY_RESERVED, 'You are already in the queue for this book');
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  /** Joins the end of the queue. Only allowed when no copy is free, so the queue is never skipped. */
  async reserve(user: AuthUser, bookId: string): Promise<ReservationViewDto> {
    const now = this.clock.now();
    let id: string;
    try {
      id = await this.dataSource.transaction(async (manager) => {
        const book = await lockBook(manager, bookId);
        const limits = await this.settings.getLimits(manager);
        await processExpiredHolds(manager, book, now, limits);

        const [onLoan] = await manager.query(
          `SELECT 1 FROM loans WHERE book_id = $1 AND member_id = $2 AND returned_at IS NULL`,
          [bookId, user.id],
        );
        if (onLoan) throw alreadyBorrowed();
        const [reserved] = await manager.query(
          `SELECT 1 FROM reservations WHERE book_id = $1 AND member_id = $2 AND status IN ('waiting', 'ready')`,
          [bookId, user.id],
        );
        if (reserved) throw alreadyReserved();
        assertNotBlocked(await unpaidBalance(manager, user.id), limits.fineBlockThresholdCents);
        if ((await freeCopy(manager, book)) !== null) {
          throw AppError.rule(RuleReason.COPIES_AVAILABLE, 'A copy is free right now, so you can borrow it straight away');
        }
        const [row] = await manager.query(
          `INSERT INTO reservations (book_id, member_id, status, created_at) VALUES ($1, $2, 'waiting', $3) RETURNING id`,
          [bookId, user.id, now],
        );
        return row.id as string;
      });
    } catch (error) {
      if (uniqueViolation(error) === ONE_ACTIVE_INDEX) throw alreadyReserved();
      throw error;
    }
    return this.view(id);
  }

  /** Leaves the queue; giving up a held copy passes it to the next member at once. */
  async cancel(user: AuthUser, id: string): Promise<ReservationViewDto> {
    const now = this.clock.now();
    const found = await this.dataSource.manager.findOneBy(Reservation, { id });
    if (!found) throw AppError.notFound('Reservation');
    if (found.memberId !== user.id) throw AppError.forbidden('This reservation belongs to someone else');

    await this.dataSource.transaction(async (manager) => {
      const book = await lockBook(manager, found.bookId);
      const limits = await this.settings.getLimits(manager);
      await processExpiredHolds(manager, book, now, limits);
      const reservation = await manager.findOneOrFail(Reservation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (reservation.status !== ReservationStatus.Waiting && reservation.status !== ReservationStatus.Ready) {
        throw AppError.rule(RuleReason.INVALID_STATE, `This reservation is ${reservation.status}`, { status: reservation.status });
      }
      await manager.update(Reservation, { id }, { status: ReservationStatus.Cancelled, closedAt: now });
      if (reservation.status === ReservationStatus.Ready) await offerFreeCopies(manager, book, now, limits);
    });
    return this.view(id);
  }

  private async view(id: string): Promise<ReservationViewDto> {
    const reservation = await this.dataSource.manager.findOneOrFail(Reservation, {
      where: { id },
      relations: { book: true, member: true },
    });
    const positions = await queuePositions(this.dataSource.manager, [id]);
    return toReservationView(reservation, this.clock.now(), positions.get(id) ?? null);
  }
}
