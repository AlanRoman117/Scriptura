import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from '@scriptura/api';
import { clearCache, setDataDir } from '@scriptura/core';

/**
 * The static CDN tree and the live router must return the same JSON.
 *
 * `scripts/build-static-api.mjs` is deliberately zero-dependency `.mjs` that
 * runs with no TypeScript build, so it cannot import the router's formatters —
 * the two implementations are separate by design. This test is what keeps them
 * honest. It is the only mechanism that would have caught the divergence they
 * had before: different keys, and the chapter number living under `chapter` on
 * one side and `number` on the other.
 *
 * Runs over a two-book slice of real data so the builder emits a few hundred
 * files instead of ~64,000.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const ROUTES = [
  // The list the reader fetches as translations.json.
  'translations',
  'translations/tkjv',
  // The offline bundle. It is the payload the reader downloads, so a drift
  // here breaks every installed translation rather than one endpoint.
  'translations/tkjv/full',
  'translations/tja/full',
  'translations/tkjv/obadiah',
  'translations/tkjv/obadiah/1',
  'translations/tkjv/obadiah/1/1',
  'translations/tja/3-john',
  'translations/tja/3-john/1',
  'translations/tja/3-john/1/2',
  // A chapter with a title and one without, in the same book: the
  // `superscription` key must appear on exactly the same side of both.
  'translations/tkjv/psalms',
  'translations/tkjv/psalms/1',
  'translations/tkjv/psalms/3',
  'translations/tkjv/psalms/3/1',
];

/**
 * Two Psalms, hand-written: the real KJV has no titles, and the real WEB's
 * Psalms would mean 2,461 per-verse files. Psalm 3 carries its title.
 */
const PSALMS = {
  number: 19,
  name: 'Psalms',
  abbreviation: 'Psa',
  testament: 'OT',
  chapters: [
    {
      number: 1,
      verses: [{ number: 1, text: 'Blessed is the man that walketh not in the counsel of the ungodly.' }],
    },
    {
      number: 3,
      superscription: 'A Psalm of David, when he fled from Absalom his son.',
      verses: [
        { number: 1, text: 'LORD, how are they increased that trouble me!' },
        { number: 2, text: 'Many there be which say of my soul, There is no help for him in God.' },
      ],
    },
  ],
};

let work: string;
let dataDir: string;
let outDir: string;
const BUILDER = join(REPO, 'scripts', 'build-static-api.mjs');

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'scriptura-parity-'));
  dataDir = join(work, 'data');
  outDir = join(work, 'dist');

  // Two tiny books, one English and one Japanese — enough to cover the
  // localized-name and slug paths without copying 61MB.
  for (const [id, src] of [
    ['tkjv', 'kjv'],
    ['tja', 'bungo'],
  ]) {
    mkdirSync(join(dataDir, id, 'books'), { recursive: true });
    cpSync(join(REPO, 'data', src, 'metadata.json'), join(dataDir, id, 'metadata.json'));
    for (const book of ['31-obadiah.json', '64-3-john.json']) {
      cpSync(join(REPO, 'data', src, 'books', book), join(dataDir, id, 'books', book));
    }
  }
  writeFileSync(join(dataDir, 'tkjv', 'books', '19-psalms.json'), JSON.stringify(PSALMS));

  execFileSync(process.execPath, [BUILDER, '--data-dir', dataDir, '--out-dir', outDir], { stdio: 'pipe' });

  setDataDir(dataDir);
});

afterAll(() => {
  setDataDir(undefined);
  clearCache();
  rmSync(work, { recursive: true, force: true });
});

describe('static build vs dynamic router', () => {
  test.each(ROUTES)('/%s returns identical JSON', async (route) => {
    const staticBody = JSON.parse(readFileSync(join(outDir, `${route}.json`), 'utf-8'));
    const dynamic = await createRouter({ path: `/${route}`, query: {} });

    expect(dynamic.status).toBe(200);
    expect(dynamic.body).toEqual(staticBody);
  });

  test('a chapter’s title is a key on both sides only where the book has one', async () => {
    // `toEqual` treats a key set to undefined as absent, so the key sets are
    // read directly: an `undefined` the router writes would be a drift that the
    // static files, which cannot hold one, never show.
    const titled = JSON.parse(readFileSync(join(outDir, 'translations/tkjv/psalms/3.json'), 'utf-8'));
    const plain = JSON.parse(readFileSync(join(outDir, 'translations/tkjv/psalms/1.json'), 'utf-8'));
    expect(titled.superscription).toBe(PSALMS.chapters[1].superscription);
    expect(Object.keys(plain)).not.toContain('superscription');
    for (const route of ['translations/tkjv/psalms/3', 'translations/tkjv/psalms/1']) {
      const dynamic = await createRouter({ path: `/${route}`, query: {} });
      const file = JSON.parse(readFileSync(join(outDir, `${route}.json`), 'utf-8'));
      expect(Object.keys(dynamic.body as object).sort()).toEqual(Object.keys(file).sort());
    }
    const full = JSON.parse(readFileSync(join(outDir, 'translations/tkjv/full.json'), 'utf-8'));
    const psalms = full.books.find((b: { slug: string }) => b.slug === 'psalms');
    expect(Object.keys(psalms.chapters[0])).toEqual(['number', 'verses']);
    expect(Object.keys(psalms.chapters[1])).toEqual(['number', 'superscription', 'verses']);
  });
});

/** Every file under `dir`, as a path relative to it. */
const filesUnder = (dir: string): string[] =>
  (readdirSync(dir, { recursive: true }) as string[]).filter((f) => statSync(join(dir, f)).isFile()).sort();

describe('--full-only, the files a published reader downloads', () => {
  test('writes the list and each full.json, byte for byte as the full build does, and nothing else', () => {
    const lean = join(work, 'lean');
    execFileSync(process.execPath, [BUILDER, '--data-dir', dataDir, '--out-dir', lean, '--full-only'], { stdio: 'pipe' });

    const files = filesUnder(lean);
    expect(files).toEqual([
      'translations.json',
      join('translations', 'tja', 'full.json'),
      join('translations', 'tkjv', 'full.json'),
    ]);
    for (const file of files) {
      expect(readFileSync(join(lean, file), 'utf-8')).toBe(readFileSync(join(outDir, file), 'utf-8'));
    }
  });
});
