import { bearer } from './support/auth-helpers';
import { chargeFine, createBook } from './support/factories';
import { createLibraryWorld, LibraryWorld } from './support/library-world';

describe('Member account page', () => {
  let w: LibraryWorld;

  beforeEach(async () => {
    w = await createLibraryWorld({ members: 3, now: '2026-02-01T12:00:00Z' });
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-ACC-01: the account shows open loans with due dates and overdue days, fines, payments, balance and reservations', async () => {
    const [a, b, c] = w.members;
    const [returned, overdue, current, queued, held] = await Promise.all(
      ['Returned late', 'Overdue', 'Current', 'Queued', 'Held'].map((title) => createBook(w.t.dataSource, { title, copies: 1 })),
    );

    const late = (await w.checkout(a, returned.id).expect(201)).body.id;
    w.t.clock.set('2026-02-20T12:00:00Z');
    await w.returnLoan(late).expect(200);
    await w.checkout(a, overdue.id).expect(201);
    w.t.clock.set('2026-03-10T12:00:00Z');
    await w.checkout(a, current.id).expect(201);
    await w.pay(a, 25).expect(201);

    await w.checkout(b, queued.id).expect(201);
    await w.reserve(c, queued.id).expect(201);
    await w.reserve(a, queued.id).expect(201);
    const heldLoan = (await w.checkout(b, held.id).expect(201)).body.id;
    await w.reserve(a, held.id).expect(201);
    await w.returnLoan(heldLoan).expect(200);

    const account = await w.account(a);
    expect(account).toMatchObject({
      member: { id: a.user.id, name: a.user.name },
      limits: { maxActiveLoans: 5, fineBlockThresholdCents: 1000, loanPeriodDays: 14 },
      balanceCents: 100,
      totalFinesCents: 125,
      totalPaidCents: 25,
      blocked: false,
      accruingFineCents: 100,
      counts: { openLoans: 2, overdueLoans: 1, reservations: 2, returnedLoans: 1, finedLoans: 1, payments: 1 },
    });
    expect(account.readyReservations).toMatchObject([{ book: { title: 'Held' }, heldCopyNumber: 1, holdExpiresAt: '2026-03-12T12:00:00.000Z' }]);

    const base = `/members/${a.user.id}`;
    expect((await w.get(a, `${base}/loans?state=open`)).items).toMatchObject([
      { book: { title: 'Overdue' }, dueAt: '2026-03-06T12:00:00.000Z', overdue: true, daysLate: 4, accruingFineCents: 100 },
      { book: { title: 'Current' }, dueAt: '2026-03-24T12:00:00.000Z', overdue: false, daysLate: 0, accruingFineCents: 0 },
    ]);
    for (const state of ['returned', 'fined']) {
      expect((await w.get(a, `${base}/loans?state=${state}`)).items).toMatchObject([
        { book: { title: 'Returned late' }, returnedAt: '2026-02-20T12:00:00.000Z', daysLate: 5, fineCents: 125 },
      ]);
    }
    expect((await w.get(a, `${base}/payments`)).items).toMatchObject([{ amountCents: 25, recordedBy: w.librarian.user.name }]);
    expect((await w.get(a, `${base}/reservations`)).items).toMatchObject([
      { book: { title: 'Queued' }, status: 'waiting', position: 2 },
      { book: { title: 'Held' }, status: 'ready', heldCopyNumber: 1, holdExpiresAt: '2026-03-12T12:00:00.000Z', position: null },
    ]);
  });

  it('T-ACC-03: account lists are paged with totals, and page sizes are limited', async () => {
    const [a] = w.members;
    for (let i = 0; i < 7; i++) {
      const book = await createBook(w.t.dataSource, { title: `History ${i}` });
      w.t.clock.set(`2026-02-${String(i + 1).padStart(2, '0')}T12:00:00Z`);
      const loan = (await w.checkout(a, book.id).expect(201)).body.id;
      w.t.clock.set(`2026-02-${String(i + 2).padStart(2, '0')}T12:00:00Z`);
      await w.returnLoan(loan).expect(200);
    }
    const page = (n: number) => w.get(a, `/members/${a.user.id}/loans?state=returned&page=${n}&pageSize=3`);
    const pages = [await page(1), await page(2), await page(3), await page(4)];
    expect(pages.map((p) => [p.total, p.page, p.pageSize, p.items.length])).toEqual([
      [7, 1, 3, 3],
      [7, 2, 3, 3],
      [7, 3, 3, 1],
      [7, 4, 3, 0],
    ]);
    expect(pages.flatMap((p) => p.items.map((l: { book: { title: string } }) => l.book.title))).toEqual(
      [6, 5, 4, 3, 2, 1, 0].map((i) => `History ${i}`),
    );
    for (const query of ['pageSize=101', 'pageSize=0', 'page=0', 'state=lost']) {
      const res = await w.api().get(`/api/members/${a.user.id}/loans?${query}`).set(bearer(a.token)).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('T-ACC-02: the librarian’s member list shows loans, overdue loans, balance and who is blocked', async () => {
    const [a, b, c] = w.members;
    const book = await createBook(w.t.dataSource, { copies: 3 });
    await w.checkout(a, book.id).expect(201);
    w.t.clock.set('2026-03-10T12:00:00Z');
    await w.checkout(b, book.id).expect(201);
    await chargeFine(w.t.dataSource, c.user, 1500);

    const res = await w.api().get('/api/members').set(bearer(w.librarian.token)).expect(200);
    const byId = Object.fromEntries(res.body.items.map((m: { id: string }) => [m.id, m]));
    expect(res.body.items).toHaveLength(3);
    expect(byId[a.user.id]).toMatchObject({ openLoans: 1, overdueLoans: 1, balanceCents: 0, blocked: false });
    expect(byId[b.user.id]).toMatchObject({ openLoans: 1, overdueLoans: 0, balanceCents: 0, blocked: false });
    expect(byId[c.user.id]).toMatchObject({ openLoans: 0, balanceCents: 1500, blocked: true });
    expect(res.body.summary).toEqual({ members: 3, booksOnLoan: 2, unpaidCents: 1500, owing: 1, blocked: 1 });
  });

  it('T-ACC-04: the member list is paged by name and searchable, while totals cover every member', async () => {
    await chargeFine(w.t.dataSource, w.members[0].user, 300);
    const names = w.members.map((m) => m.user.name).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
    const page1 = await w.get(w.librarian, '/members?page=1&pageSize=2');
    const page2 = await w.get(w.librarian, '/members?page=2&pageSize=2');
    expect([page1.total, page1.items.length, page2.items.length]).toEqual([3, 2, 1]);
    expect([...page1.items, ...page2.items].map((m: { name: string }) => m.name)).toEqual(names);

    const one = await w.get(w.librarian, `/members?search=${encodeURIComponent(w.members[1].user.email)}`);
    expect(one.items.map((m: { id: string }) => m.id)).toEqual([w.members[1].user.id]);
    expect([one.total, one.summary.members, one.summary.unpaidCents]).toEqual([1, 3, 300]);
    await w.api().get('/api/members?pageSize=101').set(bearer(w.librarian.token)).expect(400);
  });
});
