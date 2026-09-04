import { loadTranslation } from '@scriptura/core';
import type { TranslationVerse } from '@scriptura/core';

/**
 * Compare a single verse across multiple translations.
 * Reference format: "Book Chapter:Verse" (e.g. "John 3:16").
 */
export async function compareVerse(
  reference: string,
  translationIds: string[]
): Promise<TranslationVerse[]> {
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!match) {
    throw new Error(`Invalid reference format: "${reference}". Expected "Book Chapter:Verse".`);
  }

  const [, bookName, chapterStr, verseStr] = match;
  const chapterNum = parseInt(chapterStr, 10);
  const verseNum = parseInt(verseStr, 10);

  const results: TranslationVerse[] = [];

  for (const id of translationIds) {
    const bible = await loadTranslation(id);
    const verse = bible.verse(bookName, chapterNum, verseNum);
    results.push({
      translation: id,
      text: verse?.text ?? '',
    });
  }

  return results;
}

/**
 * Compare a full chapter across multiple translations.
 * Returns an array of arrays — one per translation, containing all verses.
 */
export async function compareChapter(
  bookName: string,
  chapterNum: number,
  translationIds: string[]
): Promise<{ translation: string; verses: TranslationVerse[] }[]> {
  const results: { translation: string; verses: TranslationVerse[] }[] = [];

  for (const id of translationIds) {
    const bible = await loadTranslation(id);
    const chapter = bible.chapter(bookName, chapterNum);
    const verses: TranslationVerse[] = (chapter?.verses ?? []).map((v) => ({
      translation: id,
      text: v.text,
    }));
    results.push({ translation: id, verses });
  }

  return results;
}
