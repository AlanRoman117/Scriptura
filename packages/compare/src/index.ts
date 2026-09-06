import { loadTranslation } from '@scriptura/core';
import type { TranslationVerse } from '@scriptura/core';

const VERSE_REF = /^(.+?)\s+(\d+):(\d+)$/;

/**
 * Compare a single verse across multiple translations.
 * Reference format: "Book Chapter:Verse" (e.g. "John 3:16").
 *
 * The book may be given as its English slug, its name in any of the
 * translations being compared, its abbreviation, or its canonical number — so
 * one reference resolves across languages.
 *
 * A translation that cannot be read does not abort the comparison; it comes
 * back as a row with `found: false` and an `error`, so one bad id degrades a
 * single row rather than the whole request.
 */
export async function compareVerse(
  reference: string,
  translationIds: string[]
): Promise<TranslationVerse[]> {
  const match = reference.match(VERSE_REF);
  if (!match) {
    throw new Error(`Invalid reference format: "${reference}". Expected "Book Chapter:Verse".`);
  }

  const [, bookName, chapterStr, verseStr] = match;
  const chapterNum = parseInt(chapterStr, 10);
  const verseNum = parseInt(verseStr, 10);

  // Translations are cached, so loading them concurrently is cheap and keeps a
  // wide comparison from serialising 66-file reads one translation at a time.
  return Promise.all(
    translationIds.map(async (id): Promise<TranslationVerse> => {
      let bible;
      try {
        bible = await loadTranslation(id);
      } catch {
        return { translation: id, text: '', found: false, error: 'translation not found' };
      }

      const book = bible.book(bookName);
      const verse = book?.chapters
        .find((c) => c.number === chapterNum)
        ?.verses.find((v) => v.number === verseNum);

      if (!verse) return { translation: id, text: '', found: false };

      return {
        translation: id,
        text: verse.text,
        found: true,
        // Localized: "Juan 3:16" for rv1909, "ヨハネによる福音書 3:16" for bungo.
        reference: `${book!.name} ${chapterNum}:${verse.number}`,
      };
    })
  );
}

/**
 * Compare a full chapter across multiple translations.
 * Returns one entry per translation, each holding that chapter's verses.
 */
export async function compareChapter(
  bookName: string,
  chapterNum: number,
  translationIds: string[]
): Promise<{ translation: string; book?: string; verses: TranslationVerse[] }[]> {
  return Promise.all(
    translationIds.map(async (id) => {
      let bible;
      try {
        bible = await loadTranslation(id);
      } catch {
        return { translation: id, verses: [] };
      }

      const book = bible.book(bookName);
      const chapter = book?.chapters.find((c) => c.number === chapterNum);

      return {
        translation: id,
        book: book?.name,
        verses: (chapter?.verses ?? []).map((v) => ({
          translation: id,
          // Keep the verse number: without it callers can only align chapters
          // across translations by array index, which breaks wherever a
          // translation omits a verse.
          number: v.number,
          text: v.text,
          found: true,
        })),
      };
    })
  );
}
