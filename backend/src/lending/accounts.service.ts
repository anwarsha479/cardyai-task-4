import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, IsNull, LessThan, MoreThan, Not } from 'typeorm';
import { Role } from '../auth/enums/role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Clock, CLOCK } from '../common/clock/clock';
import { Page, PageQueryDto } from '../common/dto/pagination.dto';
import { AppError, RuleReason } from '../common/exceptions/app-error';
import { likePattern } from '../common/utils/like-pattern';
import { SettingsService } from '../settings/settings.service';
import { User } from '../users/entities/user.entity';
import { queuePositions, unpaidBalance } from './copy-queue';
import {
  AccountCountsDto,
  AccountDto,
  ListMembersQueryDto,
  MemberDeskSummaryDto,
  MemberLoansQueryDto,
  MemberSummaryDto,
  PaymentViewDto,
} from './dto/account.dto';
import { LoanViewDto, ReservationViewDto, toLoanView, toReservationView } from './dto/lending-views.dto';
import { RecordPaymentDto } from './dto/loan.dto';
import { FinePayment } from './entities/fine-payment.entity';
import { Loan } from './entities/loan.entity';
import { Reservation } from './entities/reservation.entity';
import { ReservationStatus } from './enums/reservation-status.enum';
import { isBlocked } from './utils/lending-rules.util';

const ACTIVE_RESERVATION = In([ReservationStatus.Waiting, ReservationStatus.Ready]);

/** Unpaid balance of member `u`: fines charged minus payments (same as unpaidBalance). */
const MEMBER_BALANCE = `(SELECT coalesce(sum(fine_cents), 0) FROM loans l WHERE l.member_id = u.id)
  - (SELECT coalesce(sum(amount_cents), 0) FROM fine_payments p WHERE p.member_id = u.id)`;

@Injectable()
export class AccountsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  /** Totals and counts for the account page; the lists are paged separately. */
  async account(user: AuthUser, memberId: string): Promise<AccountDto> {
    const member = await this.member(user, memberId);
    const manager = this.dataSource.manager;
    const now = this.clock.now();
    const limits = await this.settings.getLimits();

    const [row]: (AccountCountsDto & { totalFinesCents: number; totalPaidCents: number })[] = await manager.query(
      `SELECT
         (SELECT count(*) FROM loans WHERE member_id = $1 AND returned_at IS NULL)::int AS "openLoans",
         (SELECT count(*) FROM loans WHERE member_id = $1 AND returned_at IS NULL AND due_at < $2)::int AS "overdueLoans",
         (SELECT count(*) FROM reservations WHERE member_id = $1 AND status IN ('waiting', 'ready'))::int AS "reservations",
         (SELECT count(*) FROM loans WHERE member_id = $1 AND returned_at IS NOT NULL)::int AS "returnedLoans",
         (SELECT count(*) FROM loans WHERE member_id = $1 AND fine_cents > 0)::int AS "finedLoans",
         (SELECT count(*) FROM fine_payments WHERE member_id = $1)::int AS "payments",
         (SELECT coalesce(sum(fine_cents), 0) FROM loans WHERE member_id = $1)::int AS "totalFinesCents",
         (SELECT coalesce(sum(amount_cents), 0) FROM fine_payments WHERE member_id = $1)::int AS "totalPaidCents"`,
      [memberId, now],
    );
    const { totalFinesCents, totalPaidCents, ...counts } = row;
    // Open loans are capped by the loan limit, so these lists stay small however long the history is.
    const overdue = await manager.find(Loan, {
      where: { memberId, returnedAt: IsNull(), dueAt: LessThan(now) },
      relations: { book: true, member: true },
    });
    const ready = await manager.find(Reservation, {
      where: { memberId, status: ReservationStatus.Ready },
      relations: { book: true, member: true },
      order: { holdExpiresAt: 'ASC' },
    });
    const balanceCents = totalFinesCents - totalPaidCents;

    return {
      member: { id: member.id, name: member.name, email: member.email },
      limits: {
        maxActiveLoans: limits.maxActiveLoans,
        loanPeriodDays: limits.loanPeriodDays,
        finePerDayCents: limits.finePerDayCents,
        maxFinePerLoanCents: limits.maxFinePerLoanCents,
        fineBlockThresholdCents: limits.fineBlockThresholdCents,
        reservationHoldHours: limits.reservationHoldHours,
      },
      balanceCents,
      totalFinesCents,
      totalPaidCents,
      blocked: isBlocked(balanceCents, limits.fineBlockThresholdCents),
      accruingFineCents: overdue.reduce((sum, l) => sum + toLoanView(l, now, limits).accruingFineCents, 0),
      counts,
      readyReservations: ready.map((r) => toReservationView(r, now, null)).filter((r) => r.status === ReservationStatus.Ready),
    };
  }

  /** open: soonest due first. returned and fined: latest return first. */
  async loans(user: AuthUser, memberId: string, query: MemberLoansQueryDto): Promise<Page<LoanViewDto>> {
    await this.member(user, memberId);
    const now = this.clock.now();
    const limits = await this.settings.getLimits();
    const where: FindOptionsWhere<Loan> =
      query.state === 'open'
        ? { memberId, returnedAt: IsNull() }
        : query.state === 'returned'
          ? { memberId, returnedAt: Not(IsNull()) }
          : { memberId, returnedAt: Not(IsNull()), fineCents: MoreThan(0) };
    const [loans, total] = await this.dataSource.manager.findAndCount(Loan, {
      where,
      relations: { book: true, member: true },
      order: query.state === 'open' ? { dueAt: 'ASC', id: 'ASC' } : { returnedAt: 'DESC', id: 'ASC' },
      ...this.window(query),
    });
    return { items: loans.map((l) => toLoanView(l, now, limits)), total, page: query.page, pageSize: query.pageSize };
  }

  /** Waiting and ready reservations, oldest first. */
  async reservations(user: AuthUser, memberId: string, query: PageQueryDto): Promise<Page<ReservationViewDto>> {
    await this.member(user, memberId);
    const now = this.clock.now();
    const manager = this.dataSource.manager;
    const [reservations, total] = await manager.findAndCount(Reservation, {
      where: { memberId, status: ACTIVE_RESERVATION },
      relations: { book: true, member: true },
      order: { createdAt: 'ASC', queueSeq: 'ASC' },
      ...this.window(query),
    });
    const positions = await queuePositions(manager, reservations.map((r) => r.id));
    return {
      items: reservations.map((r) => toReservationView(r, now, positions.get(r.id) ?? null)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Latest first. */
  async payments(user: AuthUser, memberId: string, query: PageQueryDto): Promise<Page<PaymentViewDto>> {
    await this.member(user, memberId);
    const [payments, total] = await this.dataSource.manager.findAndCount(FinePayment, {
      where: { memberId },
      relations: { recordedBy: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      ...this.window(query),
    });
    return {
      items: payments.map((p) => ({ id: p.id, amountCents: p.amountCents, note: p.note, recordedBy: p.recordedBy!.name, createdAt: p.createdAt })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** One page of members by name, plus totals across all members. */
  async listMembers(query: ListMembersQueryDto): Promise<Page<MemberSummaryDto> & { summary: MemberDeskSummaryDto }> {
    const now = this.clock.now();
    const limits = await this.settings.getLimits();
    const pattern = query.search ? likePattern(query.search) : null;
    const matches = `u.role = 'member' AND ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1)`;
    const rows: Omit<MemberSummaryDto, 'blocked'>[] = await this.dataSource.query(
      `SELECT u.id, u.name, u.email,
              (SELECT count(*) FROM loans l WHERE l.member_id = u.id AND l.returned_at IS NULL)::int AS "openLoans",
              (SELECT count(*) FROM loans l WHERE l.member_id = u.id AND l.returned_at IS NULL AND l.due_at < $2)::int AS "overdueLoans",
              (SELECT count(*) FROM reservations r WHERE r.member_id = u.id AND r.status IN ('waiting', 'ready'))::int AS "activeReservations",
              (${MEMBER_BALANCE})::int AS "balanceCents"
         FROM users u WHERE ${matches}
        ORDER BY lower(u.name), u.id
        LIMIT $3 OFFSET $4`,
      [pattern, now, query.pageSize, (query.page - 1) * query.pageSize],
    );
    const [{ total }] = await this.dataSource.query(`SELECT count(*)::int AS total FROM users u WHERE ${matches}`, [pattern]);
    const [summary]: MemberDeskSummaryDto[] = await this.dataSource.query(
      `WITH b AS (SELECT (${MEMBER_BALANCE}) AS balance FROM users u WHERE u.role = 'member')
       SELECT count(*)::int AS members,
              (SELECT count(*) FROM loans WHERE returned_at IS NULL)::int AS "booksOnLoan",
              coalesce(sum(balance), 0)::int AS "unpaidCents",
              count(*) FILTER (WHERE balance > 0)::int AS owing,
              count(*) FILTER (WHERE balance > $1)::int AS blocked
         FROM b`,
      [limits.fineBlockThresholdCents],
    );
    return {
      items: rows.map((r) => ({ ...r, blocked: isBlocked(r.balanceCents, limits.fineBlockThresholdCents) })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary,
    };
  }

  /** The member row is locked so two payments recorded at once cannot together exceed the balance. */
  async recordPayment(user: AuthUser, memberId: string, dto: RecordPaymentDto): Promise<AccountDto> {
    const now = this.clock.now();
    await this.dataSource.transaction(async (manager) => {
      const member = await manager.findOne(User, { where: { id: memberId, role: Role.Member }, lock: { mode: 'pessimistic_write' } });
      if (!member) throw AppError.notFound('Member');
      const balanceCents = await unpaidBalance(manager, memberId);
      if (dto.amountCents > balanceCents) {
        throw AppError.rule(RuleReason.PAYMENT_EXCEEDS_BALANCE, 'The payment is more than the unpaid balance', {
          balanceCents,
          amountCents: dto.amountCents,
        });
      }
      await manager.insert(FinePayment, {
        memberId,
        amountCents: dto.amountCents,
        note: dto.note ?? null,
        recordedById: user.id,
        createdAt: now,
      });
    });
    return this.account(user, memberId);
  }

  /** A member may read only their own account; a librarian may read anyone's. */
  private async member(user: AuthUser, memberId: string): Promise<User> {
    if (user.role === Role.Member && user.id !== memberId) {
      throw AppError.forbidden('You can only see your own account');
    }
    const member = await this.dataSource.manager.findOneBy(User, { id: memberId, role: Role.Member });
    if (!member) throw AppError.notFound('Member');
    return member;
  }

  private window(query: PageQueryDto): { skip: number; take: number } {
    return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
  }
}
