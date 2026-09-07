import { loadTranslation, parseReference } from '@scriptura/core';
import type { Bible, TranslationVerse } from '@scriptura/core';
import { compareChapterOf, type ChapterComparison } from './chapters.js';

export { alignChapters, compareChapterOf } from './chapters.js';
export type { ChapterComparison, ComparisonRow } from './chapters.js';

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
  const parsed = parseReference(reference);
  // Shares the grammar with `lookup` so a reference that resolves in one cannot
  // 400 in the other — a note linking [[Romans 8:28-39]] used to do exactly that.
  if (!parsed || parsed.verse === undefined) {
    throw new Error(`Invalid reference format: "${reference}". Expected "Book Chapter:Verse".`);
  }

  const { book: bookName, chapter: chapterNum, verse: verseNum } = parsed;

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
 *
 * Loading is all this does. The comparison itself lives in the I/O-free
 * `chapters.ts`, which the reader PWA calls directly against the translations
 * it holds in IndexedDB — so a side-by-side chapter is the same computation
 * online and off rather than two implementations that drift apart.
 */
export async function compareChapter(
  bookName: string,
  chapterNum: number,
  translationIds: string[]
): Promise<ChapterComparison[]> {
  const loaded = await Promise.all(
    translationIds.map(async (id): Promise<Bible | null> => {
      try {
        return await loadTranslation(id);
      } catch {
        return null;
      }
    })
  );

  // A translation that cannot be read degrades to an empty row rather than
  // failing the whole comparison, exactly as compareVerse does.
  return loaded.map((bible, i) =>
    bible
      ? compareChapterOf([bible], bookName, chapterNum)[0]
      : { translation: translationIds[i], verses: [] as TranslationVerse[] }
  );
}
