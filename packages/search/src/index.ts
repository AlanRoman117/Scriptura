import { loadTranslation } from '@scriptura/core';
import type { SearchResult } from '@scriptura/core';

/**
 * Full-text search within a single translation.
 * Returns verses whose text contains the query string (case-insensitive).
 */
export async function search(translationId: string, query: string): Promise<SearchResult[]> {
  const bible = await loadTranslation(translationId);
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (verse.text.toLowerCase().includes(lowerQuery)) {
          results.push({
            ref: `${book.name} ${chapter.number}:${verse.number}`,
            book: book.name,
            chapter: chapter.number,
            verse: verse.number,
            text: verse.text,
            score: 1,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Reference-based lookup within a translation.
 * Supports single verses ("John 3:16") and ranges ("Romans 8:28-39").
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

  const chapter = bible.chapter(bookName, chapterNum);
  if (!chapter) {
    return [];
  }

  return chapter.verses
    .filter((v) => v.number >= startVerse && v.number <= endVerse)
    .map((v) => ({
      ref: `${bookName} ${chapterNum}:${v.number}`,
      book: bookName,
      chapter: chapterNum,
      verse: v.number,
      text: v.text,
      score: 1,
    }));
}
