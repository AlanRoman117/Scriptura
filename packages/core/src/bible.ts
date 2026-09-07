/**
 * The in-memory `Bible` model and its book-resolution index.
 *
 * Deliberately free of `node:fs`, `process` and `__dirname` so a browser can
 * import it: the PWA reconstructs a `Bible` from IndexedDB and gets exactly the
 * server's book-resolution rules rather than reimplementing them and drifting.
 * `loader.ts` is the Node-only half that reads the corpus off disk.
 *
 * Nothing here does I/O. Keep it that way.
 */
import { normalizeBookKey } from './books.js';
import type { Bible, Chapter, LoadedBook, TranslationMeta, Verse } from './types.js';

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
export function buildIndex(books: LoadedBook[]): Map<string, LoadedBook> {
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

export function createBible(meta: TranslationMeta, books: LoadedBook[]): Bible {
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
