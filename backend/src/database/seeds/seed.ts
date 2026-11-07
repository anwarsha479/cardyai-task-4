import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Role } from '../../auth/enums/role.enum';
import { Book } from '../../books/entities/book.entity';
import { Clock } from '../../common/clock/clock';
import { FinePayment } from '../../lending/entities/fine-payment.entity';
import { Loan } from '../../lending/entities/loan.entity';
import { Reservation } from '../../lending/entities/reservation.entity';
import { ReservationStatus } from '../../lending/enums/reservation-status.enum';
import { computeFine, DAY_MS, daysLate, dueAt, holdExpiresAt, isBlocked } from '../../lending/utils/lending-rules.util';
import { defaultLimits } from '../../settings/settings.constants';
import { Setting } from '../../settings/entities/setting.entity';
import { User } from '../../users/entities/user.entity';
import { EXPECTED_COUNTS, SEED_BOOKS, SEED_LIBRARIAN, SEED_LOANS, SEED_MEMBERS, SEED_PAYMENTS, SEED_RESERVATIONS } from './seed-data';

export const SEED_ENTITIES = [User, Setting, Book, Loan, Reservation, FinePayment];

export interface SeedOptions {
  clock: Clock;
  password: string;
}

function fail(item: string, rule: string): never {
  throw new Error(`Seed data invalid — ${item}: ${rule}`);
}

/**
 * Builds the demo dataset with the API's own lending rules, checks the copy, queue and limit rules,
 * then writes it in one transaction (where the database constraints check it again). Running it a
 * second time does nothing.
 */
export async function runSeed(dataSource: DataSource, options: SeedOptions): Promise<{ created: boolean }> {
  const alreadySeeded = await dataSource.getRepository(User).existsBy({ email: SEED_LIBRARIAN.email });
  if (alreadySeeded) return { created: false };

  const now = options.clock.now();
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const limits = defaultLimits();
  const passwordHash = await hash(options.password, 10);

  const librarian = { id: randomUUID(), ...SEED_LIBRARIAN, role: Role.Librarian, passwordHash };
  const members = SEED_MEMBERS.map((m) => ({ id: randomUUID(), ...m, role: Role.Member, passwordHash }));
  const books = SEED_BOOKS.map((b) => ({ id: randomUUID(), title: b.title, author: b.author, totalCopies: b.copies, createdAt: ago(90), updatedAt: ago(90) }));
  const bookByTitle = new Map(books.map((b) => [b.title, b]));
  const member = (n: number, item: string) => members[n - 1] ?? fail(item, `unknown member ${n}`);
  const book = (title: string, item: string) => bookByTitle.get(title) ?? fail(item, `unknown book "${title}"`);

  const loans = SEED_LOANS.map((planned, i) => {
    const item = `loan ${i + 1}`;
    if (planned.returnedDaysAgo !== undefined && planned.returnedDaysAgo >= planned.outDaysAgo) fail(item, 'returned before it was lent');
    const checkedOutAt = ago(planned.outDaysAgo);
    const due = dueAt(checkedOutAt, limits.loanPeriodDays);
    const returnedAt = planned.returnedDaysAgo === undefined ? null : ago(planned.returnedDaysAgo);
    const lateDays = returnedAt ? daysLate(due, returnedAt) : null;
    return {
      id: randomUUID(),
      bookId: book(planned.book, item).id,
      copyNumber: 0,
      memberId: member(planned.member, item).id,
      checkedOutAt,
      dueAt: due,
      returnedAt,
      returnedById: returnedAt ? librarian.id : null,
      daysLate: lateDays,
      fineCents: lateDays === null ? 0 : computeFine(lateDays, limits.finePerDayCents, limits.maxFinePerLoanCents),
      createdAt: checkedOutAt,
    };
  });
  if (loans.length !== EXPECTED_COUNTS.loans) fail('loans', `expected ${EXPECTED_COUNTS.loans}`);

  // Give each loan the lowest copy that was back on the shelf when it was lent.
  for (const b of books) {
    const busyUntil = new Map<number, number>();
    for (const loan of loans.filter((l) => l.bookId === b.id).sort((x, y) => x.checkedOutAt.getTime() - y.checkedOutAt.getTime())) {
      let copy = 1;
      while (copy <= b.totalCopies && (busyUntil.get(copy) ?? 0) > loan.checkedOutAt.getTime()) copy++;
      if (copy > b.totalCopies) fail(`"${b.title}"`, 'more loans at once than copies');
      loan.copyNumber = copy;
      busyUntil.set(copy, loan.returnedAt?.getTime() ?? Infinity);
    }
  }
  const open = loans.filter((l) => l.returnedAt === null);
  for (const m of members) {
    if (open.filter((l) => l.memberId === m.id).length > limits.maxActiveLoans) fail(m.email, 'over the loan limit');
  }

  const payments = SEED_PAYMENTS.map((p) => ({
    id: randomUUID(),
    memberId: member(p.member, 'payment').id,
    amountCents: p.amountCents,
    note: p.note,
    recordedById: librarian.id,
    createdAt: ago(p.daysAgo),
  }));
  const balance = (memberId: string) =>
    loans.filter((l) => l.memberId === memberId).reduce((s, l) => s + l.fineCents, 0) -
    payments.filter((p) => p.memberId === memberId).reduce((s, p) => s + p.amountCents, 0);
  for (const m of members) if (balance(m.id) < 0) fail(m.email, 'paid more than they owe');

  const reservations = SEED_RESERVATIONS.map((planned, i) => {
    const item = `reservation ${i + 1}`;
    const b = book(planned.book, item);
    const m = member(planned.member, item);
    if (open.some((l) => l.bookId === b.id && l.memberId === m.id)) fail(item, 'member already has the book');
    if (isBlocked(balance(m.id), limits.fineBlockThresholdCents)) fail(item, 'member is blocked');
    const base = { id: randomUUID(), bookId: b.id, memberId: m.id, createdAt: ago(planned.daysAgo), closedAt: null, loanId: null };
    if (planned.readyFromReturnOf === undefined) {
      return { ...base, status: ReservationStatus.Waiting, heldCopyNumber: null, readyAt: null, holdExpiresAt: null };
    }
    const freed = loans[planned.readyFromReturnOf] ?? fail(item, 'unknown loan');
    if (freed.bookId !== b.id || !freed.returnedAt) fail(item, 'the held copy must come from a returned loan of this book');
    const expires = holdExpiresAt(freed.returnedAt, limits.reservationHoldHours);
    if (expires <= now) fail(item, 'hold would already have expired');
    return { ...base, status: ReservationStatus.Ready, heldCopyNumber: freed.copyNumber, readyAt: freed.returnedAt, holdExpiresAt: expires };
  });
  for (const b of books) {
    const used = open.filter((l) => l.bookId === b.id).length + reservations.filter((r) => r.bookId === b.id && r.heldCopyNumber).length;
    if (used > b.totalCopies) fail(`"${b.title}"`, 'more copies in use than it has');
    const waiting = reservations.some((r) => r.bookId === b.id && r.status === ReservationStatus.Waiting);
    if (waiting && used < b.totalCopies) fail(`"${b.title}"`, 'members wait while a copy is free');
  }
  // queue_seq follows insertion order, so insert oldest first.
  reservations.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());

  await dataSource.transaction(async (manager) => {
    await manager.insert(User, [librarian, ...members]);
    await manager.insert(Book, books);
    await manager.insert(Loan, loans);
    await manager.insert(FinePayment, payments);
    for (const r of reservations) await manager.insert(Reservation, r);
  });
  return { created: true };
}
