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
import type {
  Chapter,
  License,
  LoadedBook,
  TranslationMeta,
  TranslationVerse,
  Verse,
} from '@scriptura/core';

/**
 * Response envelopes.
 *
 * Declared and exported so a TypeScript consumer imports them rather than
 * redeclaring them by hand. Inferred return types were not enough: they are not
 * nameable, and `ScripturaResponse.body` is `unknown`, so nothing kept a
 * client's own copy honest. A compile error beats a failing test.
 */
export interface BookIndexEntry {
  number: number;
  name: string;
  slug: string;
  abbreviation: string;
  testament: 'OT' | 'NT';
  chapters: number;
}

export interface TranslationPayload extends TranslationMeta {
  books: BookIndexEntry[];
}

export interface BookPayload {
  translation: string;
  book: string;
  slug: string;
  number: number;
  abbreviation: string;
  testament: 'OT' | 'NT';
  chapters: Array<{ number: number; verses: number }>;
}

export interface ChapterPayload {
  translation: string;
  license: License;
  attribution: string;
  book: string;
  book_slug: string;
  book_number: number;
  chapter: number;
  verses: Array<{ number: number; text: string }>;
}

export interface VersePayload {
  translation: string;
  license: License;
  attribution: string;
  book: string;
  book_slug: string;
  book_number: number;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
}

export interface CompareVersePayload {
  reference: string;
  results: TranslationVerse[];
}

export interface CompareChapterPayload {
  book: string;
  chapter: number;
  results: Array<{
    translation: string;
    book?: string;
    verses: TranslationVerse[];
  }>;
}

/** `/translations/:id` — metadata plus a navigable book index. */
export function formatTranslation(
  meta: TranslationMeta,
  books: LoadedBook[]
): TranslationPayload {
  return {
    ...meta,
    books: books.map((b) => ({
      number: b.number,
      name: b.name,
      slug: b.slug,
      // abbreviation and testament are what a book picker needs to render the
      // standard OT/NT-grouped, abbreviation-labelled grid. Without them a
      // client needs 66 requests or a hardcoded canon.
      abbreviation: b.abbreviation,
      testament: b.testament,
      chapters: b.chapters.length,
    })),
  };
}

/** `/translations/:id/:book` — chapter numbers and verse counts. */
export function formatBook(translationId: string, book: LoadedBook): BookPayload {
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
export function formatChapter(
  translationId: string,
  meta: TranslationMeta,
  book: LoadedBook,
  chapter: Chapter
): ChapterPayload {
  return {
    translation: translationId,
    // Carried on every payload, not just the translation endpoint: a client that
    // caches chapters offline still owes CC BY-SA attribution for `vbl`.
    license: meta.license,
    attribution: meta.attribution,
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
  meta: TranslationMeta,
  book: LoadedBook,
  chapter: Chapter,
  verse: Verse
): VersePayload {
  return {
    translation: translationId,
    license: meta.license,
    attribution: meta.attribution,
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
