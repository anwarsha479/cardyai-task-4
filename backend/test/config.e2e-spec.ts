import { bearer } from './support/auth-helpers';
import { chargeFine, createBook, resetSettings } from './support/factories';
import { createLibraryWorld, LibraryWorld } from './support/library-world';

const DEFAULTS = {
  loanPeriodDays: 14,
  finePerDayCents: 25,
  maxFinePerLoanCents: 1000,
  maxActiveLoans: 5,
  reservationHoldHours: 48,
  fineBlockThresholdCents: 1000,
};

describe('Librarian configuration changes behaviour without a code change', () => {
  let w: LibraryWorld;
  const values = (body: { settings: { key: string; value: number }[] }) => Object.fromEntries(body.settings.map((s) => [s.key, s.value]));
  const setSettings = (body: object) => w.api().patch('/api/settings').set(bearer(w.librarian.token)).send(body).expect(200);

  beforeEach(async () => {
    w = await createLibraryWorld({ copies: 3 });
    await resetSettings(w.t.dataSource);
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-CFG-01: defaults apply on a fresh install; a change is saved with who and when', async () => {
    const fresh = await w.api().get('/api/settings').set(bearer(w.members[0].token)).expect(200);
    expect(values(fresh.body)).toEqual(DEFAULTS);

    await setSettings({ loanPeriodDays: 21 });
    const after = await w.api().get('/api/settings').set(bearer(w.librarian.token)).expect(200);
    expect(after.body.settings.find((s: { key: string }) => s.key === 'loanPeriodDays')).toMatchObject({
      value: 21,
      defaultValue: 14,
      min: 1,
      max: 90,
      updatedBy: { id: w.librarian.user.id, name: w.librarian.user.name },
      updatedAt: '2026-03-10T12:00:00.000Z',
    });
  });

  it('T-CFG-02: invalid values are refused and nothing changes', async () => {
    const bad: object[] = [
      { loanPeriodDays: 0 },
      { loanPeriodDays: 91 },
      { finePerDayCents: -1 },
      { maxFinePerLoanCents: 100001 },
      { maxActiveLoans: 0 },
      { reservationHoldHours: 337 },
      { fineBlockThresholdCents: 12.5 },
      { maxActiveLoans: '3' },
      { maxActiveLoans: 3, colour: 'blue' },
      {},
    ];
    for (const body of bad) {
      const res = await w.api().patch('/api/settings').set(bearer(w.librarian.token)).send(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const res = await w.api().get('/api/settings').set(bearer(w.librarian.token)).expect(200);
    expect(values(res.body)).toEqual(DEFAULTS);
  });

  it('T-CFG-03: changing the loan period changes the due date of the next loan', async () => {
    const [a, b] = w.members;
    expect((await w.checkout(a).expect(201)).body.dueAt).toBe('2026-03-24T12:00:00.000Z');
    await setSettings({ loanPeriodDays: 7 });
    expect((await w.checkout(b).expect(201)).body.dueAt).toBe('2026-03-17T12:00:00.000Z');
    expect((await w.get(a, `/members/${a.user.id}/loans`)).items[0].dueAt).toBe('2026-03-24T12:00:00.000Z');
  });

  it('T-CFG-04: changing the daily fine and the cap changes the next fine', async () => {
    const [a, b] = w.members;
    const first = (await w.checkout(a).expect(201)).body.id;
    const second = (await w.checkout(b).expect(201)).body.id;
    w.t.clock.set('2026-03-27T12:00:00Z');
    expect((await w.returnLoan(first).expect(200)).body.loan).toMatchObject({ daysLate: 3, fineCents: 75 });

    await setSettings({ finePerDayCents: 50, maxFinePerLoanCents: 120 });
    expect((await w.returnLoan(second).expect(200)).body.loan).toMatchObject({ daysLate: 3, fineCents: 120 });
    const [{ fine_cents }] = await w.t.dataSource.query(`SELECT fine_cents FROM loans WHERE id = $1`, [first]);
    expect(fine_cents).toBe(75);
  });

  it('T-CFG-05: changing the maximum active loans changes how many a member can borrow', async () => {
    const [a] = w.members;
    const books = await Promise.all([1, 2, 3].map(() => createBook(w.t.dataSource)));
    await setSettings({ maxActiveLoans: 2 });
    await w.checkout(a, books[0].id).expect(201);
    await w.checkout(a, books[1].id).expect(201);
    const refused = await w.checkout(a, books[2].id).expect(409);
    expect(refused.body.error).toMatchObject({ reason: 'LOAN_LIMIT_REACHED', details: { max: 2 } });
    await setSettings({ maxActiveLoans: 3 });
    await w.checkout(a, books[2].id).expect(201);
  });

  it('T-CFG-06: changing the hold window changes how long the next hold lasts', async () => {
    const [holder, a, b] = w.members;
    const book = await createBook(w.t.dataSource, { copies: 1 });
    const loan = (await w.checkout(holder, book.id).expect(201)).body.id;
    await w.reserve(a, book.id).expect(201);
    await w.reserve(b, book.id).expect(201);
    await setSettings({ reservationHoldHours: 2 });

    const returned = await w.returnLoan(loan).expect(200);
    expect(returned.body.heldFor.holdExpiresAt).toBe('2026-03-10T14:00:00.000Z');
    w.t.clock.set('2026-03-10T14:00:00Z');
    await w.runExpiry();
    expect((await w.bookView(b, book.id)).myReservation).toMatchObject({ status: 'ready', holdExpiresAt: '2026-03-10T16:00:00.000Z' });
  });

  it('T-CFG-07: lowering the blocking threshold blocks a member with fines under the old one', async () => {
    const [a] = w.members;
    await chargeFine(w.t.dataSource, a.user, 600);
    const book = await createBook(w.t.dataSource);
    await setSettings({ fineBlockThresholdCents: 500 });
    expect((await w.checkout(a).expect(409)).body.error).toMatchObject({ reason: 'BORROWING_BLOCKED', details: { thresholdCents: 500 } });
    await setSettings({ fineBlockThresholdCents: 600 });
    await w.checkout(a, book.id).expect(201);
  });
});
