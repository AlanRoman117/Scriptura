/**
 * Search matching, with no I/O.
 *
 * Imports only the pure subpaths of `@scriptura/core`, never the barrel — the
 * barrel re-exports `loader.js`, which reaches for `node:fs`, `process.env` and
 * `__dirname` and cannot load in a browser. Keeping this module clean is what
 * lets the PWA search offline with byte-for-byte the API's semantics instead of
 * a second implementation that drifts from the folding rules.
 *
 * Do not import `@scriptura/core` here. Use `@scriptura/core/books` and
 * `@scriptura/core/types`.
 */
import { foldText } from '@scriptura/core/books';
import type { Bible, SearchResult } from '@scriptura/core/types';

/** One verse, with its text pre-folded for matching. */
interface IndexedVerse {
  book: string;
  bookSlug: string;
  chapter: number;
  verse: number;
  text: string;
  folded: string;
}

/**
 * Folded search indexes, keyed by the `Bible` they came from.
 *
 * Folding all ~31,000 verses costs ~23ms and roughly doubles the text held for
 * a translation, so it is built on first search rather than at load: most
 * requests read a chapter and never search. A WeakMap means the index is
 * collected with its Bible and needs no separate invalidation — `clearCache()`
 * in the loader drops both.
 *
 * Folding at query time instead would cost ~25ms on *every* search; this way a
 * search runs at the same ~4ms it did before diacritics were handled at all.
 */
const indexes = new WeakMap<Bible, IndexedVerse[]>();

function searchIndex(bible: Bible): IndexedVerse[] {
  let index = indexes.get(bible);
  if (index) return index;

  index = [];
  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        index.push({
          book: book.name,
          bookSlug: book.slug,
          chapter: chapter.number,
          verse: verse.number,
          text: verse.text,
          folded: foldText(verse.text),
        });
      }
    }
  }
  indexes.set(bible, index);
  return index;
}

/**
 * Search an already-loaded `Bible`. Does no I/O.
 *
 * This is the half a browser needs: the PWA holds a `Bible` rebuilt from
 * IndexedDB and gets byte-for-byte the same matching the API performs, instead
 * of a second implementation that drifts from the folding rules. `search()`
 * above is now just this plus a disk read.
 */
export function searchBible(bible: Bible, query: string): SearchResult[] {
  // Fold the query the same way the corpus was folded, or the two never meet.
  const needle = foldText(query);
  // Guard the empty query: `''.includes('')` is true, so this would otherwise
  // return the entire corpus.
  if (!needle.trim()) return [];

  const results: SearchResult[] = [];
  for (const v of searchIndex(bible)) {
    if (v.folded.includes(needle)) {
      results.push({
        ref: `${v.book} ${v.chapter}:${v.verse}`,
        book: v.book,
        book_slug: v.bookSlug,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
        score: 1,
      });
    }
  }

  return results;
}
