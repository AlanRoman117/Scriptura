import { foldText, loadTranslation } from '@scriptura/core';
import type { Bible, SearchResult } from '@scriptura/core';

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
 * Full-text search within a single translation.
 *
 * Matching is a **substring** match on **case- and diacritic-folded** text.
 * All three words are deliberate:
 *
 * - *folded* — `amo` finds `amó`, because they are the same word. Without this
 *   Spanish and French search silently missed about a third of its matches
 *   (`amo` in rv1909: 1,102 hits before, 1,473 after).
 * - *substring* — a stem finds its archaic inflections, which matters for the
 *   KJV: searching `love` finds `loveth`. The cost is over-matching on short
 *   queries (`am` matches `Abraham`), which is why ranking, not stricter
 *   matching, is the right next step.
 *
 * Returns every match. Callers that serve this over HTTP should paginate —
 * a common word like "the" matches ~28,000 verses in the KJV.
 */
export async function search(translationId: string, query: string): Promise<SearchResult[]> {
  const bible = await loadTranslation(translationId);

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

/**
 * Reference-based lookup within a translation.
 * Supports single verses ("John 3:16") and ranges ("Romans 8:28-39").
 *
 * The book may be given as its English slug, its localized name, its
 * abbreviation, or its canonical number.
 */
export async function lookup(translationId: string, reference: string): Promise<SearchResult[]> {
  const bible = await loadTranslation(translationId);

  const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid reference format: "${reference}". Expected "Book Chapter:Verse" or "Book Chapter:Start-End".`);
  }

  const [, bookName, chapterStr, startStr, endStr] = match;
  const chapterNum = parseInt(chapterStr, 10);
  const startVerse = parseInt(startStr, 10);
  const endVerse = endStr ? parseInt(endStr, 10) : startVerse;

  const book = bible.book(bookName);
  const chapter = book?.chapters.find((c) => c.number === chapterNum);
  if (!book || !chapter) {
    return [];
  }

  return chapter.verses
    .filter((v) => v.number >= startVerse && v.number <= endVerse)
    .map((v) => ({
      // Report the translation's own name for the book, not the string the
      // caller happened to type — "john", "43" and "Juan" should all come back
      // as whatever rv1909 actually calls it.
      ref: `${book.name} ${chapterNum}:${v.number}`,
      book: book.name,
      book_slug: book.slug,
      chapter: chapterNum,
      verse: v.number,
      text: v.text,
      score: 1,
    }));
}
