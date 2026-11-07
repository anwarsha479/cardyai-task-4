import { createLibraryWorld, LibraryWorld } from './support/library-world';

const ROUNDS = 25;

describe('Two members can never get the same copy', () => {
  let w: LibraryWorld;

  beforeEach(async () => {
    w = await createLibraryWorld({ members: 10 });
  });

  afterEach(async () => {
    await w.t.close();
  });

  const openLoans = async () => (await w.t.dataSource.query(`SELECT count(*)::int AS n FROM loans WHERE returned_at IS NULL`))[0].n;

  it(`T-RACE-01: two members checking out the last copy at once: exactly one wins, ${ROUNDS} times`, async () => {
    const [ann, bob] = w.members;
    for (let round = 0; round < ROUNDS; round++) {
      const results = await Promise.all([w.checkout(ann), w.checkout(bob)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.error.reason).toBe('NO_COPY_AVAILABLE');
      expect(await openLoans()).toBe(1);
      await w.returnLoan(results.find((r) => r.status === 201)!.body.id).expect(200);
    }
  });

  it('T-RACE-02: ten members checking out the last copy at once: exactly one wins', async () => {
    const results = await Promise.all(w.members.map((m) => w.checkout(m)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.reason === 'NO_COPY_AVAILABLE')).toBe(true);
    expect(await openLoans()).toBe(1);
  });

  it('T-RACE-03: the database itself refuses a second open loan of a copy, bypassing the API', async () => {
    const res = await w.checkout(w.members[0]).expect(201);
    const insert = () =>
      w.t.dataSource.query(
        `INSERT INTO loans (book_id, copy_number, member_id, checked_out_at, due_at) VALUES ($1, 1, $2, now(), now() + interval '14 days')`,
        [w.book.id, w.members[1].user.id],
      );
    await expect(insert()).rejects.toMatchObject({ driverError: { code: '23505', constraint: 'ux_loans_open_copy' } });

    await w.t.dataSource.query(`UPDATE loans SET returned_at = now(), days_late = 0 WHERE id = $1`, [res.body.id]);
    await insert();
  });

  it('T-RACE-04: a return racing another member’s checkout always hands the copy to the waiting member', async () => {
    const [holder, waiting, outsider] = w.members;
    for (let round = 0; round < 10; round++) {
      const loan = (await w.checkout(holder).expect(201)).body.id;
      await w.reserve(waiting).expect(201);
      const [returned, grab] = await Promise.all([w.returnLoan(loan), w.checkout(outsider)]);
      expect(returned.status).toBe(200);
      expect(returned.body.heldFor.member.id).toBe(waiting.user.id);
      expect(grab.status).toBe(409);
      expect(grab.body.error.reason).toBe('NO_COPY_AVAILABLE');
      const next = await w.checkout(waiting).expect(201);
      await w.returnLoan(next.body.id).expect(200);
    }
  });

  it('T-RACE-05: members reserving at once get distinct queue places, and a double click makes one reservation', async () => {
    const [holder, clicker, ...others] = w.members;
    await w.checkout(holder).expect(201);
    const results = await Promise.all([
      w.reserve(clicker),
      w.reserve(clicker),
      w.reserve(clicker),
      ...others.map((m) => w.reserve(m)),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1 + others.length);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.reason === 'ALREADY_RESERVED')).toBe(true);

    const rows: { member_id: string; position: number }[] = await w.t.dataSource.query(
      `SELECT member_id, row_number() OVER (ORDER BY queue_seq)::int AS position FROM reservations WHERE status = 'waiting'`,
    );
    expect(new Set(rows.map((r) => r.member_id)).size).toBe(rows.length);
    const positions = await Promise.all(results.filter((r) => r.status === 201).map((r) => r.body.position as number));
    expect(positions.sort((x, y) => x - y)).toEqual(rows.map((r) => r.position));
  });
});
