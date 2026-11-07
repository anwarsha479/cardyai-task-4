import { EntityManager } from 'typeorm';
import { Book } from '../books/entities/book.entity';
import { AppError } from '../common/exceptions/app-error';
import { Limits } from '../settings/settings.constants';
import { holdExpiresAt, lowestFreeCopy } from './utils/lending-rules.util';

export interface CopyInUse {
  copyNumber: number;
  kind: 'loan' | 'hold';
  memberId: string;
  /** Loan id for a loan, reservation id for a hold. */
  id: string;
}

export interface Availability {
  onLoan: number;
  onHold: number;
  available: number;
  queueLength: number;
}

/**
 * Locks the book row FOR UPDATE. Every change to a book's copies or queue takes this lock first, so
 * changes to one book run one at a time and the queue is always served in order.
 */
export async function lockBook(manager: EntityManager, bookId: string): Promise<Book> {
  const book = await manager.findOne(Book, { where: { id: bookId }, lock: { mode: 'pessimistic_write' } });
  if (!book) throw AppError.notFound('Book');
  return book;
}

export async function copiesInUse(manager: EntityManager, bookId: string): Promise<CopyInUse[]> {
  return manager.query(
    `SELECT copy_number AS "copyNumber", 'loan' AS kind, member_id AS "memberId", id
       FROM loans WHERE book_id = $1 AND returned_at IS NULL
     UNION ALL
     SELECT held_copy_number, 'hold', member_id, id
       FROM reservations WHERE book_id = $1 AND status = 'ready'
     ORDER BY "copyNumber"`,
    [bookId],
  );
}

export async function freeCopy(manager: EntityManager, book: Book): Promise<number | null> {
  const inUse = await copiesInUse(manager, book.id);
  return lowestFreeCopy(book.totalCopies, inUse.map((c) => c.copyNumber));
}

/**
 * While a copy is free and someone is waiting, holds the lowest free copy for the first member in the
 * queue, starting at `at`. Returns the reservations that became ready, in queue order.
 */
export async function offerFreeCopies(manager: EntityManager, book: Book, at: Date, limits: Limits): Promise<string[]> {
  const offered: string[] = [];
  for (;;) {
    const copy = await freeCopy(manager, book);
    if (copy === null) return offered;
    const [next]: { id: string }[] = await manager.query(
      `SELECT id FROM reservations WHERE book_id = $1 AND status = 'waiting' ORDER BY queue_seq LIMIT 1 FOR UPDATE`,
      [book.id],
    );
    if (!next) return offered;
    await manager.query(
      `UPDATE reservations SET status = 'ready', held_copy_number = $2, ready_at = $3, hold_expires_at = $4 WHERE id = $1`,
      [next.id, copy, at, holdExpiresAt(at, limits.reservationHoldHours)],
    );
    offered.push(next.id);
  }
}

/**
 * Expires every hold on the book whose time is up at `now`, earliest first, and passes each copy on at
 * the instant the hold expired. The next member's hold therefore starts on time, however late this runs.
 */
export async function processExpiredHolds(manager: EntityManager, book: Book, now: Date, limits: Limits): Promise<number> {
  let expired = 0;
  for (;;) {
    const [hold]: { id: string; hold_expires_at: Date }[] = await manager.query(
      `SELECT id, hold_expires_at FROM reservations
        WHERE book_id = $1 AND status = 'ready' AND hold_expires_at <= $2
        ORDER BY hold_expires_at, queue_seq LIMIT 1 FOR UPDATE`,
      [book.id, now],
    );
    if (!hold) return expired;
    await manager.query(`UPDATE reservations SET status = 'expired', closed_at = hold_expires_at WHERE id = $1`, [hold.id]);
    expired += 1;
    await offerFreeCopies(manager, book, hold.hold_expires_at, limits);
  }
}

export async function unpaidBalance(manager: EntityManager, memberId: string): Promise<number> {
  const [row]: { balance: number }[] = await manager.query(
    `SELECT (SELECT coalesce(sum(fine_cents), 0) FROM loans WHERE member_id = $1)
          - (SELECT coalesce(sum(amount_cents), 0) FROM fine_payments WHERE member_id = $1) AS balance`,
    [memberId],
  );
  return Number(row.balance);
}

export async function availabilityByBook(manager: EntityManager, books: Book[]): Promise<Map<string, Availability>> {
  const rows: { bookId: string; onLoan: number; onHold: number; queueLength: number }[] = await manager.query(
    `SELECT b.id AS "bookId",
            (SELECT count(*) FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL)::int AS "onLoan",
            (SELECT count(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready')::int AS "onHold",
            (SELECT count(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'waiting')::int AS "queueLength"
       FROM books b WHERE b.id = ANY($1::uuid[])`,
    [books.map((b) => b.id)],
  );
  const byId = new Map(books.map((b) => [b.id, b]));
  return new Map(
    rows.map(({ bookId, onLoan, onHold, queueLength }) => [
      bookId,
      { onLoan, onHold, available: Math.max(0, byId.get(bookId)!.totalCopies - onLoan - onHold), queueLength },
    ]),
  );
}

/** Position in the queue (1 = next) of a waiting reservation. */
export async function queuePositions(manager: EntityManager, reservationIds: string[]): Promise<Map<string, number>> {
  if (reservationIds.length === 0) return new Map();
  const rows: { id: string; position: number }[] = await manager.query(
    `SELECT r.id, (SELECT count(*) FROM reservations w
                    WHERE w.book_id = r.book_id AND w.status = 'waiting' AND w.queue_seq <= r.queue_seq)::int AS position
       FROM reservations r WHERE r.id = ANY($1::uuid[]) AND r.status = 'waiting'`,
    [reservationIds],
  );
  return new Map(rows.map((r) => [r.id, r.position]));
}
