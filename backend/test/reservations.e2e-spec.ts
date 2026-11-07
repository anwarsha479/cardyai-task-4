import { bearer } from './support/auth-helpers';
import { chargeFine } from './support/factories';
import { createLibraryWorld, LibraryWorld, reservationRow } from './support/library-world';

describe('Reservation queue', () => {
  let w: LibraryWorld;

  beforeEach(async () => {
    w = await createLibraryWorld({ members: 5 });
  });

  afterEach(async () => {
    await w.t.close();
  });

  const position = async (who: (typeof w.members)[number]) => (await w.bookView(who)).myReservation?.position;

  it('T-RES-01: members reserve only when no copy is free, once per book, and not while they have it or are blocked', async () => {
    const [a, b, blocked] = w.members;
    const free = await w.reserve(a).expect(409);
    expect(free.body.error.reason).toBe('COPIES_AVAILABLE');

    await w.checkout(a).expect(201);
    expect((await w.reserve(a).expect(409)).body.error.reason).toBe('ALREADY_BORROWED');
    const first = await w.reserve(b).expect(201);
    expect(first.body).toMatchObject({ status: 'waiting', position: 1, heldCopyNumber: null, member: { id: b.user.id } });
    expect((await w.reserve(b).expect(409)).body.error.reason).toBe('ALREADY_RESERVED');

    await chargeFine(w.t.dataSource, blocked.user, 2000);
    expect((await w.reserve(blocked).expect(409)).body.error.reason).toBe('BORROWING_BLOCKED');
  });

  it('T-RES-02: copies are held for waiting members strictly in the order they reserved', async () => {
    const [holder, a, b, c] = w.members;
    let loan = (await w.checkout(holder).expect(201)).body.id;
    for (const m of [a, b, c]) await w.reserve(m).expect(201);
    expect([await position(a), await position(b), await position(c)]).toEqual([1, 2, 3]);

    for (const next of [a, b, c]) {
      const returned = await w.returnLoan(loan).expect(200);
      expect(returned.body.heldFor).toMatchObject({ member: { id: next.user.id }, holdExpiresAt: '2026-03-12T12:00:00.000Z' });
      loan = (await w.checkout(next).expect(201)).body.id;
    }
    const statuses = await w.t.dataSource.query(`SELECT status FROM reservations ORDER BY queue_seq`);
    expect(statuses.map((r: { status: string }) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
  });

  it('T-RES-03: a held copy can be checked out only by the member it is held for', async () => {
    const [holder, a, outsider] = w.members;
    const loan = (await w.checkout(holder).expect(201)).body.id;
    const reservation = (await w.reserve(a).expect(201)).body.id;
    await w.returnLoan(loan).expect(200);

    expect((await w.checkout(outsider).expect(409)).body.error.reason).toBe('NO_COPY_AVAILABLE');
    expect((await w.checkout(holder).expect(409)).body.error.reason).toBe('NO_COPY_AVAILABLE');
    expect((await w.bookView(outsider)).availability).toEqual({ onLoan: 0, onHold: 1, available: 0, queueLength: 0 });

    const taken = await w.checkout(a).expect(201);
    expect(taken.body.copyNumber).toBe(1);
    const [row] = await w.t.dataSource.query(`SELECT status, loan_id, closed_at FROM reservations WHERE id = $1`, [reservation]);
    expect(row).toMatchObject({ status: 'fulfilled', loan_id: taken.body.id });
  });

  it('T-RES-04: leaving the queue keeps the order; giving up a held copy passes it to the next member', async () => {
    const [holder, a, b, c] = w.members;
    const loan = (await w.checkout(holder).expect(201)).body.id;
    const [ra, rb] = [(await w.reserve(a).expect(201)).body.id, (await w.reserve(b).expect(201)).body.id];
    await w.reserve(c).expect(201);

    expect((await w.cancel(b, rb).expect(200)).body.status).toBe('cancelled');
    expect([await position(a), await position(c)]).toEqual([1, 2]);

    await w.returnLoan(loan).expect(200);
    expect((await reservationRow(w, ra)).status).toBe('ready');
    await w.cancel(a, ra).expect(200);
    expect((await w.bookView(c)).myReservation).toMatchObject({ status: 'ready', holdExpiresAt: '2026-03-12T12:00:00.000Z' });
    expect((await w.cancel(a, ra).expect(409)).body.error.reason).toBe('INVALID_STATE');
  });

  it('T-RES-05: new copies go to the queue first, in order', async () => {
    const [holder, a, b, c] = w.members;
    await w.checkout(holder).expect(201);
    for (const m of [a, b, c]) await w.reserve(m).expect(201);

    const res = await w.api().patch(`/api/books/${w.book.id}`).set(bearer(w.librarian.token)).send({ totalCopies: 3 }).expect(200);
    expect(res.body.availability).toEqual({ onLoan: 1, onHold: 2, available: 0, queueLength: 1 });
    const held = await w.t.dataSource.query(
      `SELECT member_id, held_copy_number FROM reservations WHERE status = 'ready' ORDER BY held_copy_number`,
    );
    expect(held).toEqual([
      { member_id: a.user.id, held_copy_number: 2 },
      { member_id: b.user.id, held_copy_number: 3 },
    ]);
    expect(await position(c)).toBe(1);
  });
});
