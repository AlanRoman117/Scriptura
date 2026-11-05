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

test('the licence address and the rights notice pass through with the metadata', async ({ request }) => {
  const list = (await (await request.get('/translations')).json()) as Array<Record<string, unknown>>;
  const of = (id: string) => list.find((t) => t.id === id);
  expect(of('vbl')?.license_url).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
  expect(of('blivre')?.license).toBe('cc-by-3.0-br');
  expect(of('blivre')?.license_url).toBe('https://creativecommons.org/licenses/by/3.0/br/');
  expect(of('kjv')?.license).toBe('public-domain');
  expect(of('kjv')?.rights_notice).toMatch(/^Public domain outside the UK;/);

  for (const path of ['/translations/kjv', '/translations/kjv/full.json']) {
    expect((await (await request.get(path)).json()).rights_notice).toBe(of('kjv')?.rights_notice);
  }
  for (const path of ['/translations/vbl', '/translations/vbl/full.json']) {
    expect((await (await request.get(path)).json()).license_url).toBe(of('vbl')?.license_url);
  }

  // Optional, and absent rather than empty where there is none.
  expect(of('asv')).not.toHaveProperty('license_url');
  expect(of('asv')).not.toHaveProperty('rights_notice');
  // The chapter and verse shapes do not grow: the attribution they carry already
  // holds the licence's address in words.
  const chapter = await (await request.get('/translations/vbl/john/3')).json();
  expect(chapter).not.toHaveProperty('license_url');
  expect(chapter.attribution).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
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

test('a chapter with a title carries `superscription`; one without does not grow', async ({ request }) => {
  // A Psalm's title stands before verse 1 and is not a verse. The key is
  // present only where the source has one: the KJV chapter above has none.
  const titled = await (await request.get('/translations/web/psalms/3')).json();
  expect(keys(titled)).toEqual([
    'attribution', 'book', 'book_number', 'book_slug', 'chapter', 'license',
    'superscription', 'translation', 'verses',
  ].sort());
  expect(titled.superscription).toBe('A Psalm by David, when he fled from Absalom his son.');
  expect(titled.verses[0].text).not.toContain('Absalom');

  const plain = await (await request.get('/translations/web/psalms/1')).json();
  expect(keys(plain)).not.toContain('superscription');

  // The verse payload never carries it: a title belongs to the chapter.
  const verse = await (await request.get('/translations/web/psalms/3/1')).json();
  expect(keys(verse)).not.toContain('superscription');
});

test('the same slug addresses every translation, in every language', async ({ request }) => {
  const texts = await Promise.all(
    ['kjv', 'rv1909', 'lsg1910', 'bungo', 'blivre'].map(async (id) =>
      (await (await request.get(`/translations/${id}/john/3/16`)).json()).text
    )
  );
  expect(texts.every((t: string) => t.length > 0)).toBe(true);
  expect(new Set(texts).size).toBe(5);
});

test('search paginates and reports a total the UI can page on', async ({ request }) => {
  const res = await request.get('/search?q=love&translation=kjv&limit=5');
  const body = await res.json();
  // The matching options are echoed because they change what `total` counts —
  // a client showing "1,382 matches" has to be able to say what was counted.
  expect(keys(body)).toEqual([
    'limit',
    'match_case',
    'mode',
    'offset',
    'query',
    'results',
    'total',
    'translation',
  ]);
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

test.describe('the offline bundle', () => {
  /**
   * What the reader PWA downloads to work offline.
   *
   * The `.json` suffix is accepted as well as the bare path, and that is not
   * cosmetic: the static CDN tree appends `.json` to every endpoint, so this is
   * the one URL a browser client must be able to fetch unchanged from either a
   * live server or a bucket. If the two ever disagree, the reader installs
   * translations from one origin and 404s against the other.
   */
  test('lists the translations with or without the .json suffix, as the reader fetches it', async ({ request }) => {
    const bare = await request.get('/translations');
    const suffixed = await request.get('/translations.json');

    expect(bare.status()).toBe(200);
    expect(suffixed.status()).toBe(200);
    expect(await suffixed.json()).toEqual(await bare.json());
  });

  test('serves a whole translation, with or without the .json suffix', async ({ request }) => {
    const bare = await request.get('/translations/kjv/full');
    const suffixed = await request.get('/translations/kjv/full.json');

    expect(bare.status()).toBe(200);
    expect(suffixed.status()).toBe(200);
    expect(await suffixed.json()).toEqual(await bare.json());
  });

  test('carries the licence, the attribution, and every verse', async ({ request }) => {
    const body = await request.get('/translations/vbl/full.json').then((r) => r.json());

    // A client caching the text offline still owes the notice CC BY-SA requires
    // it to display, so both travel with the payload.
    expect(body.license).toBe('cc-by-sa-4.0');
    expect(body.attribution).toBeTruthy();
    expect(body.books).toHaveLength(66);

    const john = body.books.find((b: { slug: string }) => b.slug === 'john');
    expect(john.name).toBeTruthy();
    expect(john.chapters[2].verses[15].text).toContain('Dios');
  });

  test('an unknown translation is a 404, not a book lookup', async ({ request }) => {
    const response = await request.get('/translations/nope/full.json');
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toContain('Translation "nope" not found');
  });
});
