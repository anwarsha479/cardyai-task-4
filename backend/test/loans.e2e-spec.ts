import { chargeFine, createBook } from './support/factories';
import { createLibraryWorld, LibraryWorld } from './support/library-world';

describe('Checkout', () => {
  let w: LibraryWorld;

  beforeEach(async () => {
    w = await createLibraryWorld();
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-LOAN-01: a member gets the lowest free copy, due one loan period after checkout', async () => {
    const book = await createBook(w.t.dataSource, { copies: 3 });
    const [a, b] = w.members;
    const first = await w.checkout(a, book.id).expect(201);
    expect(first.body).toMatchObject({
      book: { id: book.id },
      copyNumber: 1,
      member: { id: a.user.id },
      checkedOutAt: '2026-03-10T12:00:00.000Z',
      dueAt: '2026-03-24T12:00:00.000Z',
      returnedAt: null,
      overdue: false,
      fineCents: 0,
    });
    const second = await w.checkout(b, book.id).expect(201);
    expect(second.body.copyNumber).toBe(2);
    expect((await w.bookView(a, book.id)).availability).toEqual({ onLoan: 2, onHold: 0, available: 1, queueLength: 0 });
  });

  it('T-LOAN-02: a member at the loan limit cannot borrow until they return one', async () => {
    const [a] = w.members;
    const books = [];
    for (let i = 0; i < 6; i++) books.push(await createBook(w.t.dataSource, { copies: 1 }));
    const loans = [];
    for (const book of books.slice(0, 5)) loans.push((await w.checkout(a, book.id).expect(201)).body);

    const refused = await w.checkout(a, books[5].id).expect(409);
    expect(refused.body.error).toMatchObject({ code: 'RULE_VIOLATION', reason: 'LOAN_LIMIT_REACHED', details: { max: 5, active: 5 } });

    await w.returnLoan(loans[0].id).expect(200);
    await w.checkout(a, books[5].id).expect(201);
  });

  it('T-LOAN-03: no free copy gives NO_COPY_AVAILABLE; a second copy of the same book gives ALREADY_BORROWED', async () => {
    const [a, b] = w.members;
    await w.checkout(a).expect(201);
    const none = await w.checkout(b).expect(409);
    expect(none.body.error.reason).toBe('NO_COPY_AVAILABLE');

    const book = await createBook(w.t.dataSource, { copies: 2 });
    await w.checkout(a, book.id).expect(201);
    const again = await w.checkout(a, book.id).expect(409);
    expect(again.body.error.reason).toBe('ALREADY_BORROWED');
    await w.api().post('/api/books/00000000-0000-4000-8000-000000000000/checkout').set({ Authorization: `Bearer ${a.token}` }).expect(404);
  });

  it('T-LOAN-04: unpaid fines over the threshold block checkout; exactly at the threshold they do not', async () => {
    const book = await createBook(w.t.dataSource, { copies: 3 });
    const [atLimit, over] = w.members;
    await chargeFine(w.t.dataSource, atLimit.user, 1000);
    await chargeFine(w.t.dataSource, over.user, 1001);

    await w.checkout(atLimit, book.id).expect(201);
    const blocked = await w.checkout(over, book.id).expect(409);
    expect(blocked.body.error).toMatchObject({ reason: 'BORROWING_BLOCKED', details: { balanceCents: 1001, thresholdCents: 1000 } });

    await w.pay(over, 1).expect(201);
    await w.checkout(over, book.id).expect(201);
  });

  it('T-LOAN-05: the librarian’s open loans are paged and searchable, with desk totals across all loans', async () => {
    const [a, b] = w.members;
    for (const [i, member] of [a, a, b, b, b].entries()) {
      const book = await createBook(w.t.dataSource, { title: `Shelf ${i}` });
      w.t.clock.set(`2026-02-${String(20 + i).padStart(2, '0')}T12:00:00Z`);
      await w.checkout(member, book.id).expect(201);
    }
    w.t.clock.set('2026-03-10T12:00:00Z');
    // Due 6–10 March: the loan due 10 March 12:00 is due right now, so not yet overdue.
    const loans = (query: string) => w.get(w.librarian, `/loans?${query}`);

    const first = await loans('page=1&pageSize=2');
    expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2, summary: { open: 5, overdue: 4, oldestDaysLate: 4, accruingFineCents: (4 + 3 + 2 + 1) * 25 } });
    expect(first.items.map((l: { book: { title: string } }) => l.book.title)).toEqual(['Shelf 0', 'Shelf 1']);
    expect((await loans('page=3&pageSize=2')).items.map((l: { book: { title: string } }) => l.book.title)).toEqual(['Shelf 4']);
    expect((await loans('overdue=true&pageSize=10')).total).toBe(4);
    const byMember = await loans(`search=${encodeURIComponent(b.user.name)}`);
    expect([byMember.total, byMember.summary.open]).toEqual([3, 5]);
    expect((await loans('search=shelf%203')).items.map((l: { book: { title: string } }) => l.book.title)).toEqual(['Shelf 3']);
  });
});
