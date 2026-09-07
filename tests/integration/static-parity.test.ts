import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const REPO = join(__dirname, '..', '..');
const ROUTES = [
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
];

let work: string;
let outDir: string;

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'scriptura-parity-'));
  const dataDir = join(work, 'data');
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

  execFileSync(
    process.execPath,
    [
      join(REPO, 'scripts', 'build-static-api.mjs'),
      '--data-dir', dataDir,
      '--out-dir', outDir,
    ],
    { stdio: 'pipe' }
  );

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
});
