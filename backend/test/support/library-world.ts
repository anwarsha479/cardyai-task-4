import request from 'supertest';
import { Role } from '../../src/auth/enums/role.enum';
import { Book } from '../../src/books/entities/book.entity';
import { HoldExpiryService } from '../../src/lending/hold-expiry.service';
import { User } from '../../src/users/entities/user.entity';
import { bearer, loginAs } from './auth-helpers';
import { createBook, createUser } from './factories';
import { createTestApp, TestApp } from './test-app';

export interface Person {
  user: User;
  token: string;
}

/** A test app with one librarian, `members` signed-in members and one book with `copies` copies. */
export interface LibraryWorld {
  t: TestApp;
  librarian: Person;
  members: Person[];
  book: Book;
  api(): ReturnType<typeof request>;
  checkout(who: Person, bookId?: string): request.Test;
  reserve(who: Person, bookId?: string): request.Test;
  cancel(who: Person, reservationId: string): request.Test;
  returnLoan(loanId: string): request.Test;
  account(who: Person, memberId?: string): Promise<Record<string, any>>;
  bookView(who: Person, bookId?: string): Promise<Record<string, any>>;
  /** GET an API path as `who`, expecting 200. */
  get(who: Person, path: string): Promise<Record<string, any>>;
  pay(member: Person, amountCents: number): request.Test;
  runExpiry(): Promise<string[]>;
}

export async function createLibraryWorld(options: { members?: number; copies?: number; now?: string } = {}): Promise<LibraryWorld> {
  const t = await createTestApp({ now: options.now });
  const person = async (role: Role): Promise<Person> => {
    const user = await createUser(t.dataSource, { role });
    return { user, token: await loginAs(t.app, user) };
  };
  const librarian = await person(Role.Librarian);
  const members: Person[] = [];
  for (let i = 0; i < (options.members ?? 3); i++) members.push(await person(Role.Member));
  const book = await createBook(t.dataSource, { copies: options.copies ?? 1 });
  const api = () => request(t.app.getHttpServer());
  return {
    t,
    librarian,
    members,
    book,
    api,
    checkout: (who, bookId = book.id) => api().post(`/api/books/${bookId}/checkout`).set(bearer(who.token)),
    reserve: (who, bookId = book.id) => api().post(`/api/books/${bookId}/reservations`).set(bearer(who.token)),
    cancel: (who, id) => api().post(`/api/reservations/${id}/cancel`).set(bearer(who.token)),
    returnLoan: (loanId) => api().post(`/api/loans/${loanId}/return`).set(bearer(librarian.token)),
    account: async (who, memberId = who.user.id) =>
      (await api().get(`/api/members/${memberId}/account`).set(bearer(who.token)).expect(200)).body,
    bookView: async (who, bookId = book.id) => (await api().get(`/api/books/${bookId}`).set(bearer(who.token)).expect(200)).body,
    get: async (who, path) => (await api().get(`/api${path}`).set(bearer(who.token)).expect(200)).body,
    pay: (member, amountCents) =>
      api().post(`/api/members/${member.user.id}/payments`).set(bearer(librarian.token)).send({ amountCents }),
    runExpiry: () => t.app.get(HoldExpiryService).processExpired(),
  };
}

/** Status, copy and hold times of a reservation, read straight from the table. */
export async function reservationRow(world: LibraryWorld, id: string): Promise<{ status: string; held_copy_number: number | null; ready_at: Date | null; hold_expires_at: Date | null; closed_at: Date | null }> {
  const [row] = await world.t.dataSource.query(
    `SELECT status, held_copy_number, ready_at, hold_expires_at, closed_at FROM reservations WHERE id = $1`,
    [id],
  );
  return row;
}
