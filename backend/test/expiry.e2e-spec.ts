import { createLibraryWorld, LibraryWorld, Person, reservationRow } from './support/library-world';

const A_EXPIRES = '2026-03-12T12:00:00.000Z';
const B_EXPIRES = '2026-03-14T12:00:00.000Z';
const C_EXPIRES = '2026-03-16T12:00:00.000Z';
const justBefore = (iso: string) => new Date(new Date(iso).getTime() - 1).toISOString();

describe('Reservation holds expire on time (fixed clock)', () => {
  let w: LibraryWorld;
  let a: Person, b: Person, c: Person, outsider: Person;
  let ids: string[];

  /** The only copy is returned at 12:00 with a, b, c waiting in that order, so a's hold runs 48 h. */
  async function queueOf(members: Person[]): Promise<void> {
    const loan = (await w.checkout(w.members[0]).expect(201)).body.id;
    ids = [];
    for (const m of members) ids.push((await w.reserve(m).expect(201)).body.id);
    const returned = await w.returnLoan(loan).expect(200);
    expect(returned.body.heldFor).toMatchObject({ member: { id: members[0].user.id }, holdExpiresAt: A_EXPIRES });
  }

  beforeEach(async () => {
    w = await createLibraryWorld({ members: 5 });
    [, a, b, c, outsider] = w.members;
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-EXP-01: the job changes nothing 1 ms before expiry and passes the copy on at exactly the expiry instant', async () => {
    await queueOf([a, b, c]);
    w.t.clock.set(justBefore(A_EXPIRES));
    expect(await w.runExpiry()).toEqual([]);
    expect((await reservationRow(w, ids[0])).status).toBe('ready');

    w.t.clock.set(A_EXPIRES);
    expect(await w.runExpiry()).toEqual([w.book.id]);
    expect(await reservationRow(w, ids[0])).toMatchObject({ status: 'expired', closed_at: new Date(A_EXPIRES) });
    expect(await reservationRow(w, ids[1])).toMatchObject({
      status: 'ready',
      held_copy_number: 1,
      ready_at: new Date(A_EXPIRES),
      hold_expires_at: new Date(B_EXPIRES),
    });
    expect((await reservationRow(w, ids[2])).status).toBe('waiting');
  });

  it('T-EXP-02: at the expiry instant, with no job run, the copy already belongs to the next member', async () => {
    await queueOf([a, b, c]);
    w.t.clock.set(justBefore(A_EXPIRES));
    expect((await w.checkout(c).expect(409)).body.error.reason).toBe('NO_COPY_AVAILABLE');
    expect((await w.bookView(a)).myReservation).toMatchObject({ status: 'ready' });

    w.t.clock.set(A_EXPIRES);
    expect((await w.bookView(a)).myReservation).toBeNull();
    expect((await w.checkout(a).expect(409)).body.error.reason).toBe('NO_COPY_AVAILABLE');
    const loan = await w.checkout(b).expect(201);
    expect(loan.body).toMatchObject({ copyNumber: 1, checkedOutAt: A_EXPIRES });
    expect((await reservationRow(w, ids[1])).status).toBe('fulfilled');
  });

  it('T-EXP-03: when the last member’s hold expires the copy is free for anyone', async () => {
    await queueOf([a]);
    w.t.clock.set(A_EXPIRES);
    await w.runExpiry();
    expect((await w.bookView(outsider)).availability).toEqual({ onLoan: 0, onHold: 0, available: 1, queueLength: 0 });
    await w.checkout(outsider).expect(201);
  });

  it('T-EXP-04: a job that runs days late processes each hold at its own expiry instant', async () => {
    await queueOf([a, b, c]);
    w.t.clock.set('2026-03-15T12:00:00.000Z');
    await w.runExpiry();
    expect(await reservationRow(w, ids[0])).toMatchObject({ status: 'expired', closed_at: new Date(A_EXPIRES) });
    expect(await reservationRow(w, ids[1])).toMatchObject({
      status: 'expired',
      ready_at: new Date(A_EXPIRES),
      closed_at: new Date(B_EXPIRES),
    });
    expect(await reservationRow(w, ids[2])).toMatchObject({
      status: 'ready',
      ready_at: new Date(B_EXPIRES),
      hold_expires_at: new Date(C_EXPIRES),
    });
  });
});
