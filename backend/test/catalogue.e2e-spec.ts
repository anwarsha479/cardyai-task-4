import { bearer } from './support/auth-helpers';
import { createBook } from './support/factories';
import { createLibraryWorld, LibraryWorld } from './support/library-world';

describe('Catalogue', () => {
  let w: LibraryWorld;
  const lib = () => bearer(w.librarian.token);

  beforeEach(async () => {
    w = await createLibraryWorld();
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-CAT-01: a librarian adds a book and it is listed with every copy available', async () => {
    const res = await w.api().post('/api/books').set(lib()).send({ title: '  Middlemarch ', author: 'George Eliot', totalCopies: 3 }).expect(201);
    expect(res.body).toMatchObject({
      title: 'Middlemarch',
      author: 'George Eliot',
      totalCopies: 3,
      availability: { onLoan: 0, onHold: 0, available: 3, queueLength: 0 },
    });
    const list = await w.api().get('/api/books').set(bearer(w.members[0].token)).expect(200);
    expect(list.body.items.find((b: { id: string }) => b.id === res.body.id)).toMatchObject({ myLoan: null, myReservation: null });
  });

  it('T-CAT-02: blank titles or authors and negative, fractional or too large copy counts are refused; 0 copies is fine', async () => {
    const bad: [object, string][] = [
      [{ title: '', author: 'A', totalCopies: 1 }, 'title'],
      [{ title: '   ', author: 'A', totalCopies: 1 }, 'title'],
      [{ author: 'A', totalCopies: 1 }, 'title'],
      [{ title: 'T', author: '', totalCopies: 1 }, 'author'],
      [{ title: 'T', author: 'A', totalCopies: -1 }, 'totalCopies'],
      [{ title: 'T', author: 'A', totalCopies: 1.5 }, 'totalCopies'],
      [{ title: 'T', author: 'A', totalCopies: 101 }, 'totalCopies'],
      [{ title: 'T', author: 'A' }, 'totalCopies'],
    ];
    for (const [body, field] of bad) {
      const res = await w.api().post('/api/books').set(lib()).send(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(res.body.error.details.fields)).toContain(field);
    }
    await w.api().patch(`/api/books/${w.book.id}`).set(lib()).send({ totalCopies: -2 }).expect(400);
    await w.api().patch(`/api/books/${w.book.id}`).set(lib()).send({ title: ' ' }).expect(400);
    const zero = await w.api().post('/api/books').set(lib()).send({ title: 'On order', author: 'A', totalCopies: 0 }).expect(201);
    expect(zero.body.availability.available).toBe(0);
  });

  it('T-CAT-03: lowering the copy count over a copy on loan is refused; over free copies it is accepted', async () => {
    const book = await createBook(w.t.dataSource, { copies: 4 });
    const [a, b, c] = w.members;
    for (const m of [a, b, c]) await w.checkout(m, book.id).expect(201);
    await w.api().post(`/api/loans/${(await w.t.dataSource.query(`SELECT id FROM loans WHERE copy_number = 1`))[0].id}/return`).set(lib()).expect(200);
    // Copies 2 and 3 are on loan, 1 and 4 are free.

    const refused = await w.api().patch(`/api/books/${book.id}`).set(lib()).send({ totalCopies: 2 }).expect(409);
    expect(refused.body.error).toMatchObject({ reason: 'COPIES_IN_USE', details: { copies: [3] } });
    const ok = await w.api().patch(`/api/books/${book.id}`).set(lib()).send({ totalCopies: 3, title: 'Renamed' }).expect(200);
    expect(ok.body).toMatchObject({ title: 'Renamed', totalCopies: 3, availability: { onLoan: 2, available: 1 } });
  });

  it('T-CAT-04: search matches title or author, and each book shows availability and the member’s own loan or reservation', async () => {
    const austen = await createBook(w.t.dataSource, { title: 'Emma', author: 'Jane Austen', copies: 1 });
    await createBook(w.t.dataSource, { title: 'Persuasion', author: 'Jane AUSTEN', copies: 2 });
    await createBook(w.t.dataSource, { title: '100% Pure', author: 'Someone', copies: 2 });
    const [a, b] = w.members;
    const loan = await w.checkout(a, austen.id).expect(201);
    const reservation = await w.reserve(b, austen.id).expect(201);

    const found = await w.api().get('/api/books').query({ search: 'austen' }).set(bearer(b.token)).expect(200);
    expect(found.body.items.map((x: { title: string }) => x.title)).toEqual(['Emma', 'Persuasion']);
    expect(found.body.items[0]).toMatchObject({
      availability: { onLoan: 1, onHold: 0, available: 0, queueLength: 1 },
      myLoan: null,
      myReservation: { id: reservation.body.id, status: 'waiting', position: 1 },
    });
    const mine = await w.bookView(a, austen.id);
    expect(mine.myLoan).toMatchObject({ id: loan.body.id, copyNumber: 1, dueAt: '2026-03-24T12:00:00.000Z' });

    const percent = await w.api().get('/api/books').query({ search: '100%' }).set(lib()).expect(200);
    expect(percent.body.items.map((x: { title: string }) => x.title)).toEqual(['100% Pure']);
    const byTitle = await w.api().get('/api/books').query({ search: 'persuasion' }).set(lib()).expect(200);
    expect(byTitle.body.items).toHaveLength(1);
  });

  it('T-CAT-05: the catalogue is paged by cursor in title order, with no book repeated or skipped', async () => {
    const titles = ['delta', 'Alpha', 'echo', 'Charlie', 'bravo', 'Foxtrot', 'golf'];
    for (const title of titles) await createBook(w.t.dataSource, { title });
    const [member] = w.members;
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const res = await w.api().get('/api/books').query({ limit: 3, ...(cursor ? { cursor } : {}) }).set(bearer(member.token)).expect(200);
      expect(res.body.total).toBe(titles.length + 1);
      expect(res.body.items.length).toBeLessThanOrEqual(3);
      seen.push(...res.body.items.map((b: { title: string }) => b.title));
      cursor = res.body.nextCursor ?? undefined;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toEqual(['Alpha', w.book.title, 'bravo', 'Charlie', 'delta', 'echo', 'Foxtrot', 'golf'].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));

    for (const query of [{ limit: 0 }, { limit: 61 }, { cursor: 'not-a-cursor' }, { filter: 'everything' }]) {
      const res = await w.api().get('/api/books').query(query).set(bearer(member.token)).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('T-CAT-06: the Available and My books filters are applied on the server, with their own totals', async () => {
    const [a, b] = w.members;
    await createBook(w.t.dataSource, { title: 'Free', copies: 2 });
    const reserved = await createBook(w.t.dataSource, { title: 'Reserved', copies: 1 });
    await w.checkout(a).expect(201);
    await w.checkout(a, reserved.id).expect(201);
    await w.reserve(b, reserved.id).expect(201);
    const titles = (body: Record<string, any>) => body.items.map((x: { title: string }) => x.title);

    const available = await w.get(b, '/books?filter=available');
    expect([titles(available), available.total]).toEqual([['Free'], 1]);
    const mine = await w.get(b, '/books?filter=mine');
    expect([titles(mine), mine.total]).toEqual([['Reserved'], 1]);
    expect(titles(await w.get(a, '/books?filter=mine'))).toEqual([w.book.title, 'Reserved'].sort());
    await w.api().get('/api/books').query({ filter: 'mine' }).set(lib()).expect(400);
  });
});
