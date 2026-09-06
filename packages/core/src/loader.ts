import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeBookKey, slugFromFilename } from './books.js';
import type { Bible, Book, Chapter, LoadedBook, TranslationMeta, Verse } from './types.js';

/**
 * Where `data/` lives.
 *
 * Resolved per call rather than frozen at module load, so tests can point the
 * loader at a fixture tree and a deployment can relocate the corpus. The
 * default walks up from this file (works from both `src/` and `dist/`, which
 * sit at the same depth) rather than trusting the process cwd.
 */
let dataDirOverride: string | undefined = process.env.SCRIPTURA_DATA_DIR;

export function getDataDir(): string {
  return dataDirOverride ?? join(__dirname, '..', '..', '..', 'data');
}

/** Point the loader at a different `data/` tree. Clears every cache. */
export function setDataDir(dir: string | undefined): void {
  dataDirOverride = dir;
  clearCache();
}

/**
 * Build the lookup table a `Bible` resolves book names against.
 *
 * Callers address books by URL slug (`1-samuel`), but people also reasonably
 * type the abbreviation (`1Sa`) or the localized name (`Génesis`, `ヨハネによる福音書`).
 * All three are indexed under a normalized key, so the same URL works across
 * every translation regardless of the language its book names are written in.
 *
 * The canonical book number works too (`/translations/kjv/43/3/16`).
 *
 * Slugs are registered last and win ties: they are the canonical addressing
 * scheme, and a translation could in principle abbreviate one book to another
 * book's slug.
 */
function buildIndex(books: LoadedBook[]): Map<string, LoadedBook> {
  const index = new Map<string, LoadedBook>();
  const add = (key: string, book: LoadedBook) => {
    const normalized = normalizeBookKey(key);
    if (normalized) index.set(normalized, book);
  };

  for (const book of books) add(book.name, book);
  for (const book of books) add(book.abbreviation, book);
  for (const book of books) add(String(book.number), book);
  for (const book of books) add(book.slug, book);

  return index;
}

function createBible(meta: TranslationMeta, books: LoadedBook[]): Bible {
  const index = buildIndex(books);
  const findBook = (name: string) => index.get(normalizeBookKey(name));

  return {
    meta,
    books,
    verse(bookName: string, chapterNum: number, verseNum: number): Verse | undefined {
      const chapter = findBook(bookName)?.chapters.find((c) => c.number === chapterNum);
      return chapter?.verses.find((v) => v.number === verseNum);
    },
    chapter(bookName: string, chapterNum: number): Chapter | undefined {
      return findBook(bookName)?.chapters.find((c) => c.number === chapterNum);
    },
    book(name: string): LoadedBook | undefined {
      return findBook(name);
    },
    slugs(): string[] {
      return books.map((b) => b.slug);
    },
  };
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
  const raw = await readFile(join(getDataDir(), id, 'metadata.json'), 'utf-8');
  return JSON.parse(raw) as TranslationMeta;
}

async function readTranslation(id: string): Promise<Bible> {
  const translationDir = join(getDataDir(), id);
  const meta = await loadMetadata(id);

  const booksDir = join(translationDir, 'books');
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
