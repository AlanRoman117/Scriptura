/**
 * Chapter comparison over Bibles that are already in memory.
 *
 * **No I/O.** `index.ts` loads translations off disk and delegates here; the
 * reader PWA holds its translations in IndexedDB and calls the same functions,
 * so a side-by-side chapter reads identically online and off. Same reason
 * `@scriptura/search/matcher` exists — a second implementation in the browser
 * would drift, and the drift would be invisible until someone noticed two
 * columns disagreeing.
 *
 * Import only `@scriptura/core/types`. The barrel reaches for `node:fs`.
 */
import type { Bible, TranslationVerse } from '@scriptura/core/types';

export interface ChapterComparison {
  translation: string;
  /** The book's name *in that translation* — "Juan", "ヨハネによる福音書". */
  book?: string;
  verses: TranslationVerse[];
}

/** One row of a side-by-side view: a verse number and each translation's text. */
export interface ComparisonRow {
  number: number;
  /** Indexed to match the comparisons passed in; `null` where a verse is absent. */
  cells: (string | null)[];
}

/** Compare one chapter across Bibles that are already loaded. */
export function compareChapterOf(
  bibles: Bible[],
  bookRef: string,
  chapterNum: number
): ChapterComparison[] {
  return bibles.map((bible) => {
    const book = bible.book(bookRef);
    const chapter = book?.chapters.find((c) => c.number === chapterNum);

    return {
      translation: bible.meta.id,
      book: book?.name,
      verses: (chapter?.verses ?? []).map((v) => ({
        translation: bible.meta.id,
        // Keep the verse number: without it callers can only align chapters by
        // array index, which breaks wherever a translation omits a verse.
        number: v.number,
        text: v.text,
        found: true,
      })),
    };
  });
}

/**
 * Align comparisons into rows, keyed on the verse number.
 *
 * Aligning by array index is the obvious wrong answer: critical-text
 * translations legitimately omit verses — Acts 8:37 is the standard example —
 * so from the omission onward every row would be off by one and each column
 * would quietly show a different verse. Numbers are the only shared key.
 */
export function alignChapters(comparisons: ChapterComparison[]): ComparisonRow[] {
  const numbers = new Set<number>();
  for (const c of comparisons) for (const v of c.verses) numbers.add(v.number ?? 0);

  return [...numbers]
    .sort((a, b) => a - b)
    .map((number) => ({
      number,
      cells: comparisons.map(
        (c) => c.verses.find((v) => v.number === number)?.text ?? null
      ),
    }));
}
