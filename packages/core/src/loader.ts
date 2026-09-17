import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugFromFilename } from './books.js';
import { createBible } from './bible.js';
import type { Bible, Book, LoadedBook, TranslationMeta } from './types.js';

/**
 * Where `data/` lives.
 *
 * Resolved per call rather than frozen at module load, so tests can point the
 * loader at a fixture tree and a deployment can relocate the corpus. The
 * default walks up from this file (works from both `src/` and `dist/`, which
 * sit at the same depth) rather than trusting the process cwd.
 *
 * `import.meta.url` rather than `__dirname`: these packages emit ESM, where
 * `__dirname` does not exist.
 */
const HERE = dirname(fileURLToPath(import.meta.url));

let dataDirOverride: string | undefined = process.env.SCRIPTURA_DATA_DIR;

export function getDataDir(): string {
  return dataDirOverride ?? join(HERE, '..', '..', '..', 'data');
}

/** Point the loader at a different `data/` tree. Clears every cache. */
export function setDataDir(dir: string | undefined): void {
  dataDirOverride = dir;
  clearCache();
}

/**
 * Translation ids that are safe to join onto a filesystem path.
 *
 * Every id we ship is a short lowercase slug (`kjv`, `rv1909`, `lsg1910`), so
 * the allowlist costs nothing and closes the traversal below.
 */
const SAFE_TRANSLATION_ID = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Resolve `data/<id>`, refusing anything that escapes the data root.
 *
 * This has to live here rather than in the caller. Route *path* segments were
 * already safe — the router's `[^/]+` allows only one segment and Express does
 * not percent-decode `req.path` — but **query strings are decoded**, so
 * `/search?translation=../../../etc` arrived here with real `../` sequences and
 * would read any directory shaped like a translation, returning its verses in
 * the response body. Validating at the sink covers `/search`, `/compare`, the
 * CLI, and any future caller at once, instead of relying on each one to sanitise
 * first.
 *
 * The regex is the real guard; the resolve/prefix check is belt and braces
 * against anything the pattern fails to anticipate (Windows `\` separators,
 * say, which `path.join` also treats as a separator).
 */
function translationDir(id: string): string {
  if (!SAFE_TRANSLATION_ID.test(id)) {
    throw new Error(`Invalid translation id: ${JSON.stringify(id)}`);
  }
  const root = resolve(getDataDir());
  const dir = resolve(root, id);
  if (dir !== root && !dir.startsWith(root + sep)) {
    throw new Error(`Translation id escapes the data root: ${JSON.stringify(id)}`);
  }
  return dir;
}

/**
 * Cache keyed by translation id, holding the in-flight promise rather than the
 * resolved value so concurrent requests share a single read of the 66 files.
 *
 * A translation is a few MB parsed, and nothing invalidates on its own — the
 * data only changes when `scripts/ingest.py` runs, which means a restart.
 */
const cache = new Map<string, Promise<Bible>>();

/** Drop cached translations. Intended for tests. */
export function clearCache(): void {
  cache.clear();
}

/**
 * Read a translation's metadata without touching its book files.
 *
 * `GET /translations/:id` only needs these nine fields; going through
 * `loadTranslation` for them would parse all 66 books to throw them away.
 */
export async function loadMetadata(id: string): Promise<TranslationMeta> {
  const raw = await readFile(join(translationDir(id), 'metadata.json'), 'utf-8');
  return JSON.parse(raw) as TranslationMeta;
}

async function readTranslation(id: string): Promise<Bible> {
  const dir = translationDir(id);
  const meta = await loadMetadata(id);

  const booksDir = join(dir, 'books');
  const files = (await readdir(booksDir)).filter((f) => f.endsWith('.json')).sort();

  const books: LoadedBook[] = (
    await Promise.all(
      files.map(async (file) => {
        const raw = await readFile(join(booksDir, file), 'utf-8');
        // The slug lives in the filename, never in the JSON body.
        return { ...(JSON.parse(raw) as Book), slug: slugFromFilename(file) };
      })
    )
  ).sort((a, b) => a.number - b.number); // explicit, not reliant on the NN- prefix

  return createBible(meta, books);
}

/**
 * Load a Bible translation by its ID (e.g. "kjv", "rv1909").
 * Reads the translation's metadata.json and all book files from data/{id}/.
 */
export async function loadTranslation(id: string): Promise<Bible> {
  let pending = cache.get(id);
  if (!pending) {
    pending = readTranslation(id);
    cache.set(id, pending);
    // Don't cache a failure — a bad id should be retryable, not sticky.
    pending.catch(() => cache.delete(id));
  }
  return pending;
}

/**
 * List metadata for all available translations in the data/ directory.
 */
export async function listTranslations(): Promise<TranslationMeta[]> {
  const dirs = (await readdir(getDataDir())).sort();
  const translations: TranslationMeta[] = [];

  for (const dir of dirs) {
    try {
      translations.push(await loadMetadata(dir));
    } catch {
      // Skip directories without metadata.json
    }
  }

  return translations;
}
