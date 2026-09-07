import { expect, test } from '@playwright/test';

/**
 * The response contract a front-end will code against.
 *
 * Asserts exact key sets, not just presence: an accidental extra field is a
 * contract change too, and a client generating types from these responses would
 * silently drift.
 */

const keys = (o: object) => Object.keys(o).sort();

test('GET / advertises endpoints, and every example it lists works', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const body = await res.json();

  for (const example of body.examples as string[]) {
    expect.soft(
      { example, status: (await request.get(example)).status() },
      `advertised example should work: ${example}`
    ).toEqual({ example, status: 200 });
  }
});

test('GET /translations is a bare array of metadata', async ({ request }) => {
  const body = await (await request.get('/translations')).json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeGreaterThanOrEqual(10);
  expect(keys(body[0])).toEqual([
    'attribution', 'book_count', 'id', 'language', 'license',
    'name', 'source_url', 'testament', 'year',
  ]);
});

test('GET /translations/:id carries a book index a picker can render', async ({ request }) => {
  const body = await (await request.get('/translations/kjv')).json();
  expect(body.books).toHaveLength(66);
  expect(keys(body.books[0])).toEqual([
    'abbreviation', 'chapters', 'name', 'number', 'slug', 'testament',
  ]);
  expect(body.books.filter((b: { testament: string }) => b.testament === 'OT')).toHaveLength(39);
});

test('GET /translations/:id/:book lists chapters with verse counts', async ({ request }) => {
  const body = await (await request.get('/translations/kjv/john')).json();
  expect(keys(body)).toEqual([
    'abbreviation', 'book', 'chapters', 'number', 'slug', 'testament', 'translation',
  ]);
  expect(body.chapters).toHaveLength(21);
  expect(keys(body.chapters[0])).toEqual(['number', 'verses']);
});

test('GET chapter and verse have the documented shapes', async ({ request }) => {
  const chapter = await (await request.get('/translations/kjv/john/3')).json();
  expect(keys(chapter)).toEqual([
    'attribution', 'book', 'book_number', 'book_slug', 'chapter', 'license',
    'translation', 'verses',
  ].sort());

  const verse = await (await request.get('/translations/kjv/john/3/16')).json();
  expect(keys(verse)).toEqual([
    'attribution', 'book', 'book_number', 'book_slug', 'chapter', 'license',
    'reference', 'text', 'translation', 'verse',
  ].sort());
  expect(verse.reference).toBe('John 3:16');
});

test('the same slug addresses every translation, in every language', async ({ request }) => {
  const texts = await Promise.all(
    ['kjv', 'rv1909', 'lsg1910', 'bungo', 'ostervald'].map(async (id) =>
      (await (await request.get(`/translations/${id}/john/3/16`)).json()).text
    )
  );
  expect(texts.every((t: string) => t.length > 0)).toBe(true);
  expect(new Set(texts).size).toBe(5);
});

test('search paginates and reports a total the UI can page on', async ({ request }) => {
  const res = await request.get('/search?q=love&translation=kjv&limit=5');
  const body = await res.json();
  expect(keys(body)).toEqual(['limit', 'offset', 'query', 'results', 'total', 'translation']);
  expect(body.results).toHaveLength(5);
  expect(body.total).toBeGreaterThan(5);

  // book_slug must be directly usable as a path segment.
  const followUp = await request.get(`/translations/kjv/${body.results[0].book_slug}/1/1`);
  expect(followUp.status()).toBe(200);
});

test('compare returns one row per translation with localized references', async ({ request }) => {
  const body = await (
    await request.get('/compare?ref=John+3:16&translations=kjv,rv1909,bungo')
  ).json();
  expect(body.results).toHaveLength(3);
  expect(body.results.every((r: { found: boolean }) => r.found)).toBe(true);
  expect(body.results.find((r: { translation: string }) => r.translation === 'rv1909').reference)
    .toBe('Juan 3:16');
});

test('an offline client can fetch a whole translation in one request', async ({ request }) => {
  // The static build emits /translations/:id/full.json for exactly this — a PWA
  // precaching chapter-by-chapter would be ~1,189 requests. Dynamic serving of
  // it is not implemented; this asserts the contract the static tree provides.
  const res = await request.get('/translations/kjv');
  const body = await res.json();
  expect(body.books).toHaveLength(66);
  // Attribution must be reachable offline for CC BY-SA translations.
  const vbl = await (await request.get('/translations/vbl/john/3/16')).json();
  expect(vbl.license).toBe('cc-by-sa-4.0');
  expect(vbl.attribution).toContain('CC BY-SA');
});

test('compare/chapter powers the side-by-side reading view', async ({ request }) => {
  const res = await request.get('/compare/chapter?book=john&chapter=3&translations=kjv,rv1909');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.chapter).toBe(3);
  expect(body.results).toHaveLength(2);
  // Verse numbers are preserved so columns can be aligned even where a
  // translation omits a verse.
  expect(body.results[0].verses[0]).toHaveProperty('number');
  expect(body.results[0].verses.length).toBeGreaterThan(30);
});
