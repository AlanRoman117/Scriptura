/**
 * Book addressing helpers.
 *
 * Every book file is named `NN-slug.json` (e.g. `43-john.json`). That slug is
 * the language-independent key: it stays `john` even in `data/bungo/`, where
 * the book's `name` is `ヨハネによる福音書`. It is what the REST routes use as
 * the `:book` segment, and what `scripts/build-static-api.mjs` builds its
 * static tree from.
 *
 * Because the slug already *is* the canonical English name in kebab-case, none
 * of this needs a book table — so it adds no fourth canon definition to keep in
 * sync with `packages/validate/src/canon.ts`, `scripts/validate.py` and
 * `scripts/ingest.py`.
 */

/**
 * Derive the URL slug from a book filename: `43-john.json` → `john`.
 *
 * Must stay identical to `slugFromFilename` in `scripts/build-static-api.mjs`,
 * or the static tree and the live API will address books differently. The
 * integration suite asserts the two agree.
 */
export function slugFromFilename(filename: string): string {
  return filename.replace(/\.json$/i, '').replace(/^\d+-/, '');
}

/**
 * Fold text for comparison: case and Latin diacritics only.
 *
 * Spacing and punctuation are left alone, so the result still supports
 * substring and phrase matching. This is *normalization*, not fuzzy matching —
 * `amó` and `amo` are the same word, so treating them as different is a bug,
 * not a strictness setting.
 *
 * ⚠️ Strips the Latin combining block **only**. A general `\p{M}` strip also
 * removes the Japanese dakuten (U+3099), silently turning ガラテヤ into
 * カラテヤ — a different word. There is a regression test; do not "simplify".
 */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase();
}

/**
 * Fold a book name or slug into a comparable key.
 *
 * `foldText` plus separator collapsing — so `Génesis`, `genesis` and `GENESIS`
 * all meet at `genesis`, and `1 Samuel` meets the `1-samuel` slug.
 */
export function normalizeBookKey(value: string): string {
  return foldText(value)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A parsed scripture reference.
 *
 * `verse` is undefined for a chapter-only reference (`John 3`); `endVerse` is
 * set only for a range (`Romans 8:28-39`).
 */
export interface ParsedReference {
  book: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
}

/**
 * Parse `Book Chapter[:Verse[-Verse]]`.
 *
 * One grammar, deliberately. `@scriptura/search` and `@scriptura/compare` each
 * carried their own regex and they disagreed: ranges parsed in one and 400'd in
 * the other, and chapter-only parsed in neither although the REST route serves
 * it. A note linking `[[Romans 8:28-39]]` then hitting "compare translations"
 * was an error for no reason a reader could see.
 *
 * The book part stays a raw string — resolving it needs a loaded translation,
 * since it may be a slug, a localized name, an abbreviation or a number.
 */
export function parseReference(reference: string): ParsedReference | null {
  const match = reference
    .trim()
    .match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!match) return null;

  const [, book, chapterStr, verseStr, endStr] = match;
  const parsed: ParsedReference = { book: book.trim(), chapter: parseInt(chapterStr, 10) };
  if (verseStr !== undefined) {
    parsed.verse = parseInt(verseStr, 10);
    if (endStr !== undefined) parsed.endVerse = parseInt(endStr, 10);
  }
  return parsed;
}
