import { bearer } from './support/auth-helpers';
import { chargeFine } from './support/factories';
import { createLibraryWorld, LibraryWorld } from './support/library-world';

const DUE = '2026-03-24T12:00:00.000Z';
const afterDue = (ms: number) => new Date(new Date(DUE).getTime() + ms).toISOString();
const DAY = 86_400_000;

describe('Fines with a fixed clock', () => {
  let w: LibraryWorld;

  beforeEach(async () => {
    w = await createLibraryWorld({ copies: 3 });
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-FINE-01: a loan returned at exactly its due instant has no fine', async () => {
    const loan = await w.checkout(w.members[0]).expect(201);
    expect(loan.body.dueAt).toBe(DUE);
    w.t.clock.set(DUE);
    const res = await w.returnLoan(loan.body.id).expect(200);
    expect(res.body.loan).toMatchObject({ returnedAt: DUE, daysLate: 0, fineCents: 0, overdue: false });
  });

  it('T-FINE-02: every started day after the due instant is one day late at the daily fine', async () => {
    const loans = [];
    for (const m of w.members) loans.push((await w.checkout(m).expect(201)).body.id);
    const cases: [string, number][] = [
      [afterDue(1), 1],
      [afterDue(3 * DAY), 3],
      [afterDue(3 * DAY + 1), 4],
    ];
    for (const [i, [at, days]] of cases.entries()) {
      w.t.clock.set(at);
      const res = await w.returnLoan(loans[i]).expect(200);
      expect(res.body.loan).toMatchObject({ returnedAt: at, daysLate: days, fineCents: days * 25 });
    }
  });

  it('T-FINE-03: the fine stops at the cap however late the book is', async () => {
    const loan = await w.checkout(w.members[0]).expect(201);
    w.t.clock.set(afterDue(60 * DAY));
    const open = await w.api().get('/api/loans').set(bearer(w.librarian.token)).expect(200);
    expect(open.body.items[0]).toMatchObject({ overdue: true, daysLate: 60, accruingFineCents: 1000, fineCents: 0 });
    const res = await w.returnLoan(loan.body.id).expect(200);
    expect(res.body.loan).toMatchObject({ daysLate: 60, fineCents: 1000 });
  });

  it('T-FINE-04: payments reduce the balance and can never exceed it', async () => {
    const [m] = w.members;
    await chargeFine(w.t.dataSource, m.user, 500);
    const paid = await w.pay(m, 200).expect(201);
    expect(paid.body).toMatchObject({ balanceCents: 300, totalFinesCents: 500, totalPaidCents: 200 });
    expect((await w.get(w.librarian, `/members/${m.user.id}/payments`)).items[0]).toMatchObject({ amountCents: 200, recordedBy: w.librarian.user.name });

    const over = await w.pay(m, 301).expect(409);
    expect(over.body.error).toMatchObject({ reason: 'PAYMENT_EXCEEDS_BALANCE', details: { balanceCents: 300, amountCents: 301 } });
    for (const amountCents of [0, -5, 2.5, '100']) {
      const res = await w.api().post(`/api/members/${m.user.id}/payments`).set(bearer(w.librarian.token)).send({ amountCents }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    await w.api().post(`/api/members/${w.librarian.user.id}/payments`).set(bearer(w.librarian.token)).send({ amountCents: 1 }).expect(404);

    expect((await w.pay(m, 300).expect(201)).body.balanceCents).toBe(0);
  });

  it('T-FINE-05: a loan cannot be returned twice', async () => {
    const loan = await w.checkout(w.members[0]).expect(201);
    w.t.clock.set(afterDue(2 * DAY));
    await w.returnLoan(loan.body.id).expect(200);
    w.t.clock.set(afterDue(5 * DAY));
    const again = await w.returnLoan(loan.body.id).expect(409);
    expect(again.body.error.reason).toBe('INVALID_STATE');
    const [{ fine_cents, days_late }] = await w.t.dataSource.query(`SELECT fine_cents, days_late FROM loans WHERE id = $1`, [loan.body.id]);
    expect([fine_cents, days_late]).toEqual([50, 2]);
    await w.returnLoan('00000000-0000-4000-8000-000000000000').expect(404);
  });
});
