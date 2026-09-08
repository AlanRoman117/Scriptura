import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The PWA must be able to reuse our search and book-resolution semantics.
 *
 * `@scriptura/core`'s barrel re-exports `loader.js`, which imports
 * `node:fs/promises` and touches `process.env` and `__dirname` at module scope
 * — importing it from a browser bundle is a build error. The pure subpaths
 * (`/books`, `/bible`, `@scriptura/search/matcher` and
 * `@scriptura/compare/chapters`) exist so the front-end gets the same folding,
 * book-resolution and comparison rules instead of a second implementation that
 * drifts.
 *
 * This bundles those subpaths for a browser target and fails if anything
 * Node-only leaks in. Without it, someone adds one convenient barrel import and
 * the front-end build breaks weeks later for reasons nobody connects back here.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

describe('pure subpaths stay browser-safe', () => {
  let work: string;

  beforeAll(() => {
    work = mkdtempSync(join(tmpdir(), 'scriptura-browser-'));
  });
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  test('bundle for a browser target with no Node built-ins', () => {
    // Must live inside the repo so workspace resolution finds @scriptura/*.
    const entry = join(REPO, `.browser-safety-${process.pid}.mjs`);
    const out = join(work, 'out.js');
    writeFileSync(
      entry,
      `import { foldText, normalizeBookKey, slugFromFilename, parseReference } from '@scriptura/core/books';
       import { createBible, buildIndex } from '@scriptura/core/bible';
       import { searchBible } from '@scriptura/search/matcher';
       import { alignChapters, compareChapterOf } from '@scriptura/compare/chapters';
       globalThis.x = [foldText, normalizeBookKey, slugFromFilename, parseReference, createBible, buildIndex, searchBible, alignChapters, compareChapterOf];`
    );

    try {
      execFileSync(
        join(REPO, 'node_modules', '.bin', 'esbuild'),
        [entry, '--bundle', '--platform=browser', '--format=esm', `--outfile=${out}`],
        { stdio: 'pipe' }
      );
      const bundled = readFileSync(out, 'utf-8');
      for (const forbidden of ['node:fs', 'node:path', '__dirname', 'process.env']) {
        expect({ forbidden, present: bundled.includes(forbidden) }).toEqual({
          forbidden,
          present: false,
        });
      }
    } finally {
      rmSync(entry, { force: true });
    }
  });
});
