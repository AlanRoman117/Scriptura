import { loadTranslation, parseReference } from '@scriptura/core';
import type { SearchResult } from '@scriptura/core';
import { searchBible } from './matcher.js';

export { searchBible } from './matcher.js';

/**
 * Full-text search within a single translation.
 *
 * Matching is a **substring** match on **case- and diacritic-folded** text —
 * see `searchBible` in ./matcher.ts, which is the whole of it. This wrapper
 * only adds the disk read, so the browser can use the matcher directly and get
 * identical results.
 *
 * Returns every match. Callers that serve this over HTTP should paginate —
 * a common word like "the" matches ~28,000 verses in the KJV.
 */
export async function search(translationId: string, query: string): Promise<SearchResult[]> {
  return searchBible(await loadTranslation(translationId), query);
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

  const parsed = parseReference(reference);
  if (!parsed) {
    throw new Error(`Invalid reference format: "${reference}". Expected "Book Chapter", "Book Chapter:Verse" or "Book Chapter:Start-End".`);
  }

  const { book: bookName, chapter: chapterNum } = parsed;
  // A chapter-only reference means the whole chapter, which is what the REST
  // route at /translations/:id/:book/:chapter already serves.
  const startVerse = parsed.verse ?? 1;
  const endVerse = parsed.endVerse ?? (parsed.verse ?? Number.MAX_SAFE_INTEGER);

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
