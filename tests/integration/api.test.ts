import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createRouter } from '@scriptura/api';
import { compareVerse } from '@scriptura/compare';
import { lookup } from '@scriptura/search';
import { clearCache, getDataDir, listTranslations, setDataDir } from '@scriptura/core';
import { chineseBible, writeBible } from '../helpers/chinese-bible';

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

  test('answers as translations.json too, the name the static tree gives it', async () => {
    const bare = await get('/translations');
    const suffixed = await get('/translations.json');
    expect(suffixed.status).toBe(200);
    expect(suffixed.body).toEqual(bare.body);
  });

  test.each(['cuvs', 'cuvt', 'ostervald'])('%s, withdrawn on 2026-11-01, is neither listed nor served', async (id) => {
    const list = (await get('/translations')).body as Array<{ id: string }>;
    expect(list.map((t) => t.id)).not.toContain(id);
    expect((await get(`/translations/${id}`)).status).toBe(404);
    expect((await get(`/translations/${id}/john/3/16`)).status).toBe(404);
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
      abbreviation: 'Gen',
      testament: 'OT',
      chapters: 50,
    });

    // The book picker needs OT/NT grouping without 66 extra requests.
    const testaments = new Set(body.books.map((b) => (b as { testament: string }).testament));
    expect(testaments).toEqual(new Set(['OT', 'NT']));
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
    ['Portuguese localized name', '/translations/blivre/João/3/16'],
    ['accented Portuguese name', '/translations/blivre/Gênesis/1/1'],
  ])('resolves by %s', async (_label, path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect((res.body as { text: string }).text.length).toBeGreaterThan(0);
  });

  test('the same slug works across every language', async () => {
    const paths = ['kjv', 'rv1909', 'lsg1910', 'bungo', 'blivre'].map(
      (id) => `/translations/${id}/john/3/16`
    );
    const bodies = await Promise.all(paths.map(async (p) => (await get(p)).body));
    const texts = bodies.map((b) => (b as { text: string }).text);
    expect(texts.every((t) => t.length > 0)).toBe(true);
    // Five different languages, so five distinct strings.
    expect(new Set(texts).size).toBe(5);
  });
});

// No Chinese Bible is in the library at present. Names in Han still have to
// resolve when one is, so this stands up a small one of each script.
describe('a Chinese Bible, from a small fixture', () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'scriptura-chinese-'));
    writeBible(dataDir, chineseBible('zhs', 'zh-Hans'));
    writeBible(dataDir, chineseBible('zht', 'zh-Hant'));
    setDataDir(dataDir);
    clearCache();
  });

  afterAll(() => {
    setDataDir(undefined);
    clearCache();
    rmSync(dataDir, { recursive: true, force: true });
  });

  test.each([
    ['Chinese localized name', '/translations/zhs/约翰福音/3/1'],
    ['traditional Chinese localized name', '/translations/zht/約翰福音/3/1'],
    ['slug against Chinese', '/translations/zhs/john/3/1'],
  ])('resolves by %s', async (_label, path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect((res.body as { text: string }).text.length).toBeGreaterThan(0);
  });

  test('one script does not answer to the other’s name', async () => {
    expect((await get('/translations/zhs/約翰福音/3/1')).status).toBe(404);
  });
});

describe('response shapes match the static build', () => {
  test('chapter', async () => {
    const res = await get('/translations/kjv/john/3');
    expect(Object.keys(res.body as object).sort()).toEqual(
      ['attribution', 'book', 'book_number', 'book_slug', 'chapter', 'license',
       'translation', 'verses'].sort()
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

describe('a chapter’s title (superscription)', () => {
  // A Psalm's title stands before verse 1 unnumbered. It is the chapter's,
  // never verse 1's, and the key is present only where the source has one, so
  // a client that never heard of it sees the payload it always did.
  test('a Psalm with a title carries it beside its verses, and verse 1 is the verse alone', async () => {
    const res = await get('/translations/web/psalms/3');
    expect(res.status).toBe(200);
    const body = res.body as { superscription?: string; verses: { number: number; text: string }[] };
    expect(body.superscription).toBe('A Psalm by David, when he fled from Absalom his son.');
    expect(body.verses[0]).toMatchObject({ number: 1 });
    expect(body.verses[0].text).toMatch(/^LORD, how my adversaries/);
    expect(body.verses).toHaveLength(8);
  });

  test.each([
    ['a Psalm whose source has no title', '/translations/web/psalms/1'],
    ['a translation whose source has no titles', '/translations/kjv/psalms/3'],
    ['a chapter outside the Psalms', '/translations/web/john/3'],
  ])('%s has no key at all', async (_label, path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('superscription');
  });

  test('the offline bundle carries it chapter by chapter', async () => {
    const body = (await get('/translations/web/full')).body as {
      books: { slug: string; chapters: { number: number; superscription?: string }[] }[];
    };
    const psalms = body.books.find((b) => b.slug === 'psalms')!;
    expect(psalms.chapters.find((c) => c.number === 3)?.superscription).toMatch(/^A Psalm by David/);
    expect(psalms.chapters.find((c) => c.number === 1)).not.toHaveProperty('superscription');
    // Psalm 119's Hebrew letters are headings, not a title, and are left out.
    expect(psalms.chapters.find((c) => c.number === 119)).not.toHaveProperty('superscription');
  });

  test('a chapter comparison carries each translation’s own, and its rows stay verses', async () => {
    const res = await get('/compare/chapter', { book: 'psalms', chapter: '3', translations: 'web,kjv' });
    expect(res.status).toBe(200);
    const body = res.body as { results: { translation: string; superscription?: string; verses: unknown[] }[] };
    expect(body.results[0]).toMatchObject({ translation: 'web', superscription: expect.stringMatching(/^A Psalm by David/) });
    expect(body.results[1]).not.toHaveProperty('superscription');
    expect(body.results.map((r) => r.verses.length)).toEqual([8, 8]);
  });
});

describe('attribution travels with the text', () => {
  // CC BY-SA requires the notice wherever the text appears. An offline client
  // that caches only chapters previously had no copy of it at all.
  test.each(['/translations/vbl/john/3', '/translations/vbl/john/3/16'])(
    '%s carries licence and attribution',
    async (path) => {
      const body = (await get(path)) .body as { license: string; attribution: string };
      expect(body.license).toBe('cc-by-sa-4.0');
      expect(body.attribution).toContain('CC BY-SA');
    }
  );

  test('public-domain translations say so rather than omitting it', async () => {
    const body = (await get('/translations/kjv/john/3/16')).body as { license: string };
    expect(body.license).toBe('public-domain');
  });
});

describe('reference grammar is shared', () => {
  // These two used to disagree: lookup accepted ranges, compareVerse 400'd on
  // them, and chapter-only parsed in neither.
  test('a range resolves through compare, not just lookup', async () => {
    const res = await get('/compare', { ref: 'Romans 8:28', translations: 'kjv,rv1909' });
    expect(res.status).toBe(200);
  });

  test('chapter-only references parse', async () => {
    const verses = await lookup('kjv', 'John 3');
    expect(verses.length).toBe(36);
  });

  test('a range returns exactly its span', async () => {
    expect(await lookup('kjv', 'Romans 8:28-30')).toHaveLength(3);
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

describe('path traversal via translation id', () => {
  // Regression. Route *path* segments were always safe — the router allows one
  // segment and Express does not percent-decode req.path — but query strings
  // ARE decoded, so ?translation=../../.. reached the loader with real ../
  // sequences and would read any directory shaped like a translation, returning
  // its verses in the response body.
  const ESCAPES = [
    '../../../../../../etc',
    '../..',
    '..',
    '/etc/passwd',
    'kjv/../../../etc',
    './kjv',
    '',
  ];

  test.each(ESCAPES)('/search rejects translation=%p', async (id) => {
    const res = await get('/search', { q: 'a', translation: id });
    expect(res.status).not.toBe(200);
  });

  test.each(ESCAPES)('/translations/:id rejects %p', async (id) => {
    const res = await get(`/translations/${id}`);
    expect(res.status).not.toBe(200);
  });

  test('/compare degrades the bad row without reading anything', async () => {
    const res = await get('/compare', {
      ref: 'Genesis 1:1',
      translations: `kjv,../../../../../../etc`,
    });
    expect(res.status).toBe(200);
    const { results } = res.body as { results: Array<{ found: boolean; text: string }> };
    expect(results[0].found).toBe(true);
    expect(results[1]).toMatchObject({ found: false, text: '' });
  });

  test('rejection never discloses a filesystem path', async () => {
    const res = await get('/search', { q: 'a', translation: '../../../../etc' });
    const body = JSON.stringify(res.body);
    // `os.homedir()` rather than a literal '/home/': macOS homes are under
    // /Users, so the literal quietly stopped asserting anything there.
    expect(body).not.toContain(homedir());
    expect(body).not.toContain(process.cwd());
  });

  // The test that actually proves the fix: stand up a real, well-formed
  // translation OUTSIDE the data root and confirm it cannot be read. Without
  // the guard this returns 200 with the marker text in the body.
  test('a well-formed translation outside the data root is unreachable', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'scriptura-traversal-'));
    const victim = join(outside, 'secret');
    try {
      mkdirSync(join(victim, 'books'), { recursive: true });
      writeFileSync(
        join(victim, 'metadata.json'),
        JSON.stringify({
          id: 'secret', name: 'Secret', language: 'en', license: 'public-domain',
          attribution: 'x', source_url: 'x', year: 2026, testament: 'both', book_count: 1,
        })
      );
      writeFileSync(
        join(victim, 'books', '01-genesis.json'),
        JSON.stringify({
          number: 1, name: 'Genesis', abbreviation: 'Gen', testament: 'OT',
          chapters: [{ number: 1, verses: [{ number: 1, text: 'CONFIDENTIAL-EXFIL-MARKER' }] }],
        })
      );

      // The traversal an attacker would send: a relative path from data/ to the victim.
      const escape = relative(getDataDir(), victim);
      expect(escape).toContain('..'); // sanity: this really does leave the root

      const search = await get('/search', { q: 'CONFIDENTIAL', translation: escape });
      expect(JSON.stringify(search.body)).not.toContain('EXFIL-MARKER');
      expect(search.status).not.toBe(200);

      const compare = await get('/compare', { ref: 'Genesis 1:1', translations: escape });
      expect(JSON.stringify(compare.body)).not.toContain('EXFIL-MARKER');

      const direct = await get(`/translations/${escape}`);
      expect(JSON.stringify(direct.body)).not.toContain('Secret');
      expect(direct.status).not.toBe(200);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test('legitimate ids still resolve', async () => {
    for (const id of ['kjv', 'rv1909', 'lsg1910', 'bungo']) {
      expect((await get(`/translations/${id}`)).status).toBe(200);
    }
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
