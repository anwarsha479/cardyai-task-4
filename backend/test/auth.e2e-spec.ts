import { bearer } from './support/auth-helpers';
import { TEST_PASSWORD } from './support/factories';
import { createLibraryWorld, LibraryWorld } from './support/library-world';

describe('Roles are enforced on the server', () => {
  let w: LibraryWorld;

  beforeEach(async () => {
    w = await createLibraryWorld({ copies: 2 });
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-AUTH-01: sign in returns a token and role; wrong password and unknown email get the same 401', async () => {
    const ok = await w.api().post('/api/auth/login').send({ email: w.librarian.user.email, password: TEST_PASSWORD }).expect(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));
    expect(ok.body.user).toMatchObject({ id: w.librarian.user.id, role: 'librarian' });

    const wrong = await w.api().post('/api/auth/login').send({ email: w.librarian.user.email, password: 'nope' }).expect(401);
    const unknown = await w.api().post('/api/auth/login').send({ email: 'ghost@example.test', password: TEST_PASSWORD }).expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);

    const me = await w.api().get('/api/auth/me').set(bearer(ok.body.accessToken)).expect(200);
    expect(me.body.email).toBe(w.librarian.user.email);
  });

  it('T-AUTH-02: no token or a bad token gets 401 everywhere', async () => {
    const member = w.members[0].user.id;
    const paths = ['/api/auth/me', '/api/books', `/api/books/${w.book.id}`, '/api/loans', '/api/members', `/api/members/${member}/account`, '/api/settings'];
    for (const path of paths) {
      const none = await w.api().get(path).expect(401);
      expect(none.body.error.code).toBe('UNAUTHENTICATED');
      await w.api().get(path).set(bearer('not-a-token')).expect(401);
    }
    await w.api().post(`/api/books/${w.book.id}/checkout`).expect(401);
    await w.api().post(`/api/books/${w.book.id}/reservations`).expect(401);
  });

  it('T-AUTH-03: a member cannot manage the catalogue, process returns, record payments, list loans or members, or change settings', async () => {
    const [member] = w.members;
    const auth = bearer(member.token);
    const loan = await w.checkout(member).expect(201);

    const created = await w.api().post('/api/books').set(auth).send({ title: 'Mine', author: 'Me', totalCopies: 1 }).expect(403);
    expect(created.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'Librarian role required' });
    await w.api().patch(`/api/books/${w.book.id}`).set(auth).send({ totalCopies: 9 }).expect(403);
    await w.api().post(`/api/loans/${loan.body.id}/return`).set(auth).expect(403);
    await w.api().post(`/api/members/${member.user.id}/payments`).set(auth).send({ amountCents: 1 }).expect(403);
    await w.api().get('/api/loans').set(auth).expect(403);
    await w.api().get('/api/members').set(auth).expect(403);
    await w.api().patch('/api/settings').set(auth).send({ maxActiveLoans: 20 }).expect(403);

    const [{ returned_at }] = await w.t.dataSource.query(`SELECT returned_at FROM loans WHERE id = $1`, [loan.body.id]);
    expect(returned_at).toBeNull();
  });

  it('T-AUTH-04: a librarian cannot check out or reserve', async () => {
    await w.checkout(w.librarian).expect(403);
    await w.reserve(w.librarian).expect(403);
    const [{ n }] = await w.t.dataSource.query(`SELECT count(*)::int AS n FROM loans`);
    expect(n).toBe(0);
  });

  it("T-AUTH-05: a member cannot read another member's account or cancel their reservation", async () => {
    const [a, b, c] = w.members;
    await w.checkout(a).expect(201);
    await w.checkout(b).expect(201);
    const reservation = await w.reserve(c).expect(201);

    await w.api().get(`/api/members/${c.user.id}/account`).set(bearer(a.token)).expect(403);
    const cancel = await w.cancel(a, reservation.body.id).expect(403);
    expect(cancel.body.error.code).toBe('FORBIDDEN');

    expect((await w.account(c)).member.id).toBe(c.user.id);
    expect((await w.account(w.librarian, c.user.id)).counts.reservations).toBe(1);
    for (const list of ['loans', 'reservations', 'payments']) {
      await w.api().get(`/api/members/${c.user.id}/${list}`).set(bearer(a.token)).expect(403);
    }
  });
});
