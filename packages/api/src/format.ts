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
  SearchResult,
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

/** A whole translation in one payload — every book, chapter and verse. */
export interface FullBookEntry {
  number: number;
  name: string;
  slug: string;
  abbreviation: string;
  testament: 'OT' | 'NT';
  chapters: Array<{ number: number; verses: Array<{ number: number; text: string }> }>;
}

export interface FullTranslationPayload extends TranslationMeta {
  books: FullBookEntry[];
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

export interface SearchPayload {
  query: string;
  translation: string;
  /** `substring` (the default) or `word`. */
  mode: string;
  match_case: boolean;
  total: number;
  limit: number;
  offset: number;
  results: SearchResult[];
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

/**
 * `/translations/:id/full` — the whole translation in one payload.
 *
 * What an offline client fetches. Per-chapter endpoints are right for a CDN
 * reader and wrong for a PWA: precaching a translation chapter-by-chapter is
 * ~1,189 requests and as many cache entries, against one fetch of ~1.25MB
 * gzipped here. Carries `license` and `attribution` because a client holding
 * the text offline still owes the notice CC BY-SA requires it to display.
 *
 * Kept in step with `writeEndpoint(join("translations", id, "full"), …)` in
 * scripts/build-static-api.mjs; tests/integration/static-parity.test.ts diffs
 * the two.
 */
export function formatFullTranslation(
  meta: TranslationMeta,
  books: LoadedBook[]
): FullTranslationPayload {
  return {
    ...meta,
    books: books.map((b) => ({
      number: b.number,
      name: b.name,
      slug: b.slug,
      abbreviation: b.abbreviation,
      testament: b.testament,
      chapters: b.chapters.map((c) => ({
        number: c.number,
        verses: c.verses.map((v) => ({ number: v.number, text: v.text })),
      })),
    })),
  };
}

/**
 * `/search` — a page of matches, with the total behind it.
 *
 * The matching options are echoed because they change what `total` means: a
 * client showing "1,382 matches" needs to be able to say what was counted.
 * Results carry `score` — 3 for a whole-word match, 2 for a word starting with
 * the query, 1 for a match inside a longer word — and arrive sorted by it.
 */
export function formatSearch(
  query: string,
  translation: string,
  results: SearchResult[],
  page: { limit: number; offset: number; mode: string; matchCase: boolean }
): SearchPayload {
  return {
    query,
    translation,
    mode: page.mode,
    match_case: page.matchCase,
    total: results.length,
    limit: page.limit,
    offset: page.offset,
    results: results.slice(page.offset, page.offset + page.limit),
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
