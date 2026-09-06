/**
 * Response formatters.
 *
 * These shapes are the contract, and they are deliberately identical to what
 * `scripts/build-static-api.mjs` writes into the static CDN tree. A client must
 * be able to point at a local server or at the CDN and see the same JSON.
 *
 * The static builder is zero-dependency `.mjs` that runs without a TypeScript
 * build, so it cannot import this module — the two implementations are kept
 * honest by the parity test in `tests/integration/api.test.ts` instead. If you
 * change a shape here, change it there too.
 */
import type { Chapter, LoadedBook, TranslationMeta, Verse } from '@scriptura/core';

/** `/translations/:id` — metadata plus a navigable book index. */
export function formatTranslation(meta: TranslationMeta, books: LoadedBook[]) {
  return {
    ...meta,
    books: books.map((b) => ({
      number: b.number,
      name: b.name,
      slug: b.slug,
      chapters: b.chapters.length,
    })),
  };
}

/** `/translations/:id/:book` — chapter numbers and verse counts. */
export function formatBook(translationId: string, book: LoadedBook) {
  return {
    translation: translationId,
    book: book.name,
    slug: book.slug,
    number: book.number,
    abbreviation: book.abbreviation,
    testament: book.testament,
    chapters: book.chapters.map((c) => ({
      number: c.number,
      verses: c.verses.length,
    })),
  };
}

/** `/translations/:id/:book/:chapter` — the full chapter text. */
export function formatChapter(translationId: string, book: LoadedBook, chapter: Chapter) {
  return {
    translation: translationId,
    book: book.name,
    book_slug: book.slug,
    book_number: book.number,
    chapter: chapter.number,
    verses: chapter.verses.map((v) => ({ number: v.number, text: v.text })),
  };
}

/** `/translations/:id/:book/:chapter/:verse` — a single verse with its reference. */
export function formatVerse(
  translationId: string,
  book: LoadedBook,
  chapter: Chapter,
  verse: Verse
) {
  return {
    translation: translationId,
    book: book.name,
    book_slug: book.slug,
    book_number: book.number,
    chapter: chapter.number,
    verse: verse.number,
    reference: `${book.name} ${chapter.number}:${verse.number}`,
    text: verse.text,
  };
}

/**
 * A handful of real slugs to put in a 404 body.
 *
 * Spread across the canon rather than taken from the front, so the hint shows
 * both the plain (`john`) and the numbered (`1-samuel`) forms — the numbered
 * ones being exactly what people get wrong.
 */
export function sampleSlugs(slugs: string[], count = 4): string[] {
  if (slugs.length <= count) return [...slugs];

  const step = Math.floor(slugs.length / count);
  const picked = Array.from({ length: count }, (_, i) => slugs[i * step]);

  // Always show one numbered slug. `1-samuel` is the shape people get wrong —
  // an all-plain sample like [genesis, esther, micah] teaches them nothing
  // about how "1 Samuel" is spelled in a URL.
  if (!picked.some((s) => /^\d/.test(s))) {
    const numbered = slugs.find((s) => /^\d/.test(s));
    if (numbered) picked[picked.length - 1] = numbered;
  }
  return picked;
}
