import { SystemClock } from '../src/common/clock/clock';
import { EXPECTED_COUNTS } from '../src/database/seeds/seed-data';
import { runSeed } from '../src/database/seeds/seed';
import { createTestApp, TestApp } from './support/test-app';

describe('Demo seed', () => {
  let t: TestApp;
  const seed = () => runSeed(t.dataSource, { clock: new SystemClock(), password: 'seed-test-password' });
  const count = async (sql: string) => (await t.dataSource.query(sql))[0].n as number;

  beforeAll(async () => {
    t = await createTestApp();
    expect(await seed()).toEqual({ created: true });
  });

  afterAll(async () => {
    await t.close();
  });

  it('T-SEED-01: 40 books with varying copies, 10 members and 25 loans, some of them overdue', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM books`)).toBe(40);
    expect(await count(`SELECT count(DISTINCT total_copies)::int AS n FROM books`)).toBeGreaterThanOrEqual(4);
    expect(await count(`SELECT count(*)::int AS n FROM users WHERE role = 'member'`)).toBe(10);
    expect(await count(`SELECT count(*)::int AS n FROM users WHERE role = 'librarian'`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM loans`)).toBe(EXPECTED_COUNTS.loans);
    expect(await count(`SELECT count(*)::int AS n FROM loans WHERE returned_at IS NULL AND due_at < now()`)).toBeGreaterThanOrEqual(5);
    expect(await count(`SELECT count(*)::int AS n FROM loans WHERE fine_cents > 0`)).toBeGreaterThanOrEqual(3);
    expect(await count(`SELECT count(*)::int AS n FROM reservations`)).toBe(EXPECTED_COUNTS.reservations);
  });

  it('T-SEED-02: no copy is lent twice, nobody is over the limit, fines follow the rule and queues wait only for busy books', async () => {
    expect(
      await count(`SELECT count(*)::int AS n FROM (
        SELECT 1 FROM loans WHERE returned_at IS NULL GROUP BY book_id, copy_number HAVING count(*) > 1) d`),
    ).toBe(0);
    expect(await count(`SELECT coalesce(max(c), 0)::int AS n FROM (SELECT count(*) AS c FROM loans WHERE returned_at IS NULL GROUP BY member_id) d`)).toBeLessThanOrEqual(5);
    expect(
      await count(`SELECT count(*)::int AS n FROM loans WHERE returned_at IS NOT NULL AND (
        days_late <> greatest(0, ceil(extract(epoch FROM returned_at - due_at) / 86400))::int
        OR fine_cents <> least(days_late * 25, 1000))`),
    ).toBe(0);
    expect(
      await count(`SELECT count(*)::int AS n FROM books b
        WHERE EXISTS (SELECT 1 FROM reservations r WHERE r.book_id = b.id AND r.status = 'waiting')
          AND b.total_copies > (SELECT count(*) FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL)
                             + (SELECT count(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'ready')`),
    ).toBe(0);
    expect(
      await count(`SELECT count(*)::int AS n FROM users u WHERE
        (SELECT coalesce(sum(amount_cents), 0) FROM fine_payments p WHERE p.member_id = u.id)
        > (SELECT coalesce(sum(fine_cents), 0) FROM loans l WHERE l.member_id = u.id)`),
    ).toBe(0);
  });

  it('T-SEED-03: running the seed again adds nothing', async () => {
    expect(await seed()).toEqual({ created: false });
    expect(await count(`SELECT count(*)::int AS n FROM loans`)).toBe(EXPECTED_COUNTS.loans);
  });
});
