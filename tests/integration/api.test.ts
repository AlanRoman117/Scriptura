import { createRouter } from '@scriptura/api';
import { compareVerse } from '@scriptura/compare';
import { clearCache, listTranslations } from '@scriptura/core';

/**
 * Integration tests against the real `data/` corpus.
 *
 * `createRouter` is framework-agnostic, so these drive it directly — no HTTP
 * server, no supertest, no port. The loader caches translations, so the first
 * touch of each is the only expensive one.
 */

const get = (path: string, query: Record<string, string> = {}) =>
  createRouter({ path, query });

beforeAll(async () => {
  // Warm the two translations most of these tests share.
  await Promise.all([get('/translations/kjv'), get('/translations/rv1909')]);
});

afterAll(() => clearCache());

describe('GET /', () => {
  test('is a browsable index rather than a 404', async () => {
    // Opening the server in a browser lands here; answering "Route not found"
    // is a poor first impression.
    const res = await get('/');
    expect(res.status).toBe(200);
    const body = res.body as { endpoints: Record<string, string>; examples: string[] };
    expect(Object.keys(body.endpoints).length).toBeGreaterThan(0);
    expect(body.examples.length).toBeGreaterThan(0);
  });

  test('every advertised example actually works', async () => {
    const { examples } = (await get('/')).body as { examples: string[] };
    for (const example of examples) {
      const [path, qs] = example.split('?');
      const query = Object.fromEntries(new URLSearchParams(qs ?? ''));
      expect({ example, status: (await get(path, query)).status }).toEqual({
        example,
        status: 200,
      });
    }
  });
});

describe('GET /translations', () => {
  test('lists the ingested translations', async () => {
    const res = await get('/translations');
    expect(res.status).toBe(200);
    const body = res.body as Array<{ id: string }>;
    // Asserted as a floor, not an exact count, so ingesting martin1744 later
    // does not break this.
    expect(body.length).toBeGreaterThanOrEqual(10);
    expect(body.map((t) => t.id)).toEqual(expect.arrayContaining(['kjv', 'rv1909', 'bungo']));
  });
});

describe('GET /translations/:id', () => {
  test('returns metadata plus a navigable book index', async () => {
    const res = await get('/translations/kjv');
    expect(res.status).toBe(200);
    const body = res.body as { id: string; books: Array<Record<string, unknown>> };
    expect(body.id).toBe('kjv');
    expect(body.books).toHaveLength(66);
    expect(body.books[0]).toEqual({
      number: 1,
      name: 'Genesis',
      slug: 'genesis',
      chapters: 50,
    });
  });

  test('404s on an unknown translation', async () => {
    const res = await get('/translations/nosuch');
    expect(res.status).toBe(404);
  });
});

describe('book addressing', () => {
  // The bug this suite exists for: the router used to hand the raw URL segment
  // to a lookup that only matched a book's localized name or abbreviation, so
  // every case below except plain English 404'd.
  test.each([
    ['slug', '/translations/kjv/john/3/16'],
    ['numbered slug', '/translations/kjv/1-samuel/1/1'],
    ['multi-word slug', '/translations/kjv/song-of-solomon/1/1'],
    ['abbreviation', '/translations/kjv/Jhn/3/16'],
    ['canonical book number', '/translations/kjv/43/3/16'],
    ['localized name', '/translations/rv1909/Juan/3/16'],
    ['accented localized name', '/translations/rv1909/Génesis/1/1'],
    ['slug against Spanish', '/translations/rv1909/genesis/1/1'],
    ['slug against French', '/translations/lsg1910/song-of-solomon/1/1'],
    ['slug against Japanese', '/translations/bungo/john/3/16'],
  ])('resolves by %s', async (_label, path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect((res.body as { text: string }).text.length).toBeGreaterThan(0);
  });

  test('the same slug works across every language', async () => {
    const paths = ['kjv', 'rv1909', 'lsg1910', 'bungo', 'ostervald'].map(
      (id) => `/translations/${id}/john/3/16`
    );
    const bodies = await Promise.all(paths.map(async (p) => (await get(p)).body));
    const texts = bodies.map((b) => (b as { text: string }).text);
    expect(texts.every((t) => t.length > 0)).toBe(true);
    // Five different languages, so five distinct strings.
    expect(new Set(texts).size).toBe(5);
  });
});

describe('response shapes match the static build', () => {
  test('chapter', async () => {
    const res = await get('/translations/kjv/john/3');
    expect(Object.keys(res.body as object).sort()).toEqual(
      ['book', 'book_number', 'book_slug', 'chapter', 'translation', 'verses'].sort()
    );
  });

  test('verse', async () => {
    const res = await get('/translations/kjv/john/3/16');
    expect(res.body).toMatchObject({
      translation: 'kjv',
      book: 'John',
      book_slug: 'john',
      book_number: 43,
      chapter: 3,
      verse: 16,
      reference: 'John 3:16',
    });
    expect((res.body as { text: string }).text).toContain('For God so loved');
  });

  test('book index', async () => {
    const res = await get('/translations/kjv/john');
    expect(res.body).toMatchObject({ translation: 'kjv', book: 'John', slug: 'john' });
    expect((res.body as { chapters: unknown[] }).chapters).toHaveLength(21);
  });
});

describe('errors are actionable', () => {
  test('an unresolvable book suggests valid slugs', async () => {
    const res = await get('/translations/kjv/songofsolomon/1/1');
    expect(res.status).toBe(404);
    const body = res.body as { valid_examples: string[] };
    expect(body.valid_examples.length).toBeGreaterThan(0);
    // Include a numbered slug — that is the form people get wrong.
    expect(body.valid_examples.some((s) => /^\d/.test(s))).toBe(true);
  });

  test('an out-of-range chapter reports the real range', async () => {
    const res = await get('/translations/kjv/john/99');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ valid_range: [1, 21] });
  });

  test('unknown route', async () => {
    expect((await get('/nope')).status).toBe(404);
  });
});

describe('GET /search', () => {
  test('paginates', async () => {
    const res = await get('/search', { q: 'love', translation: 'kjv', limit: '5' });
    expect(res.status).toBe(200);
    const body = res.body as { total: number; results: unknown[] };
    expect(body.total).toBeGreaterThan(5);
    expect(body.results).toHaveLength(5);
  });

  test('results carry a usable book_slug', async () => {
    const res = await get('/search', { q: 'beginning', translation: 'kjv', limit: '1' });
    const [first] = (res.body as { results: Array<{ book_slug: string }> }).results;
    const followUp = await get(`/translations/kjv/${first.book_slug}/1/1`);
    expect(followUp.status).toBe(200);
  });

  test('rejects a bad limit and missing params', async () => {
    expect((await get('/search', { q: 'a', translation: 'kjv', limit: 'abc' })).status).toBe(400);
    expect((await get('/search', { q: 'a' })).status).toBe(400);
  });
});

describe('GET /compare', () => {
  test('returns real text for every language, with localized references', async () => {
    const res = await get('/compare', {
      ref: 'John 3:16',
      translations: 'kjv,rv1909,lsg1910,bungo',
    });
    expect(res.status).toBe(200);
    const { results } = res.body as {
      results: Array<{ translation: string; text: string; found: boolean; reference?: string }>;
    };
    expect(results).toHaveLength(4);
    // The regression that matters: these silently came back as empty strings
    // for every non-English translation.
    for (const row of results) {
      expect(row.found).toBe(true);
      expect(row.text.length).toBeGreaterThan(0);
    }
    expect(results.find((r) => r.translation === 'rv1909')?.reference).toBe('Juan 3:16');
  });

  test('one bad id degrades a single row, not the request', async () => {
    const res = await get('/compare', { ref: 'John 3:16', translations: 'kjv,nosuch' });
    expect(res.status).toBe(200);
    const { results } = res.body as { results: Array<{ found: boolean; error?: string }> };
    expect(results[0].found).toBe(true);
    expect(results[1]).toMatchObject({ found: false, error: 'translation not found' });
  });

  test('a malformed reference is a 400, not a 500', async () => {
    expect((await get('/compare', { ref: 'garbage', translations: 'kjv' })).status).toBe(400);
    expect((await get('/compare', { ref: 'John 3:16' })).status).toBe(400);
  });
});

describe('compareVerse (library)', () => {
  test('resolves one English reference across languages', async () => {
    const rows = await compareVerse('John 3:16', ['kjv', 'rv1909', 'lsg1910']);
    expect(rows.every((r) => r.found && r.text.length > 0)).toBe(true);
    expect(new Set(rows.map((r) => r.text)).size).toBe(3);
  });
});

describe('loader', () => {
  test('every listed translation is loadable and has books', async () => {
    const metas = await listTranslations();
    for (const meta of metas) {
      const res = await get(`/translations/${meta.id}`);
      expect(res.status).toBe(200);
      expect((res.body as { books: unknown[] }).books.length).toBeGreaterThan(0);
    }
  });
});
