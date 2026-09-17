/**
 * Search matching, with no I/O.
 *
 * Imports only the pure subpaths of `@scriptura/core`, never the barrel — the
 * barrel re-exports `loader.js`, which reaches for `node:fs`, `process.env` and
 * `__dirname` and cannot load in a browser. Keeping this module clean is what
 * lets the PWA search offline with byte-for-byte the API's semantics instead of
 * a second implementation that drifts from the folding rules.
 *
 * Do not import `@scriptura/core` here. Use `@scriptura/core/books` and
 * `@scriptura/core/types`.
 */
import { foldDiacritics, foldText } from '@scriptura/core/books';
import type { Bible, SearchResult } from '@scriptura/core/types';

/** One verse, with its text pre-folded for matching. */
interface IndexedVerse {
  book: string;
  bookSlug: string;
  chapter: number;
  verse: number;
  text: string;
  folded: string;
}

/**
 * Folded search indexes, keyed by the `Bible` they came from.
 *
 * Folding all ~31,000 verses costs ~23ms and roughly doubles the text held for
 * a translation, so it is built on first search rather than at load: most
 * requests read a chapter and never search. A WeakMap means the index is
 * collected with its Bible and needs no separate invalidation — `clearCache()`
 * in the loader drops both.
 *
 * Folding at query time instead would cost ~25ms on *every* search; this way a
 * search runs at the same ~4ms it did before diacritics were handled at all.
 */
const indexes = new WeakMap<Bible, IndexedVerse[]>();

/**
 * The same index with case preserved, for `caseSensitive` searches.
 *
 * A second map rather than a third column on the first, because it is built
 * only if someone actually asks for a case-sensitive search — which most never
 * will, and which would otherwise cost every reader a further copy of the whole
 * corpus. Re-folding per search instead would put that ~23ms on every keystroke
 * in the reader.
 */
const casedIndexes = new WeakMap<Bible, IndexedVerse[]>();

function buildIndex(bible: Bible, fold: (s: string) => string): IndexedVerse[] {
  const index: IndexedVerse[] = [];
  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        index.push({
          book: book.name,
          bookSlug: book.slug,
          chapter: chapter.number,
          verse: verse.number,
          text: verse.text,
          folded: fold(verse.text),
        });
      }
    }
  }
  return index;
}

function searchIndex(bible: Bible, caseSensitive: boolean): IndexedVerse[] {
  const cache = caseSensitive ? casedIndexes : indexes;
  let index = cache.get(bible);
  if (index) return index;
  index = buildIndex(bible, caseSensitive ? foldDiacritics : foldText);
  cache.set(bible, index);
  return index;
}

/* ── Match quality ─────────────────────────────────────────────────────── */

/**
 * How well a query met the text. Higher is a better match.
 *
 * The reason this exists: searching `Tito` in Spanish returned `apetito`
 * alongside Titus, and `am` in English returns most of the corpus. Substring
 * matching is still right — the KJV writes `loveth`, and a reader searching
 * `love` expects to find it — but a match inside a longer word is not as good
 * as a match on the word itself, and until now nothing said so.
 */
export const SCORE_WHOLE_WORD = 3;
/** `love` in `loveth` — an inflection of the word searched for. */
export const SCORE_WORD_START = 2;
/** `tito` in `apetito` — a different word that happens to contain it. */
export const SCORE_INSIDE_WORD = 1;
/** Not present at all. */
export const SCORE_NONE = 0;

/**
 * Letters and digits, excluding the scripts that do not separate words.
 *
 * ⚠️ Han, Hiragana and Katakana are deliberately **not** word characters here.
 * Japanese is written without spaces, so treating its characters as word-
 * forming makes every match an interior one: whole-word matching on `bungo`
 * took 神 from 3,945 verses to 3. Excluding them makes each character its own
 * word, which is the convention search engines use for CJK.
 */
const WORDISH = /[\p{L}\p{N}]/u;
const CJK = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u;

const isWordChar = (ch: string | undefined): boolean =>
  ch !== undefined && WORDISH.test(ch) && !CJK.test(ch);

/**
 * Whether word boundaries mean anything for this query.
 *
 * A query with no word-forming character — an all-Japanese one, say — has no
 * boundaries to match on, so word mode degrades to substring mode rather than
 * returning almost nothing. Deciding this per *query* rather than per
 * occurrence is what makes the degradation exact: a per-occurrence rule still
 * quietly dropped 52 of 3,945 matches for 神, and "almost all of them" is not a
 * property worth shipping when "all of them" is available.
 */
export function hasWordBoundaries(query: string): boolean {
  for (const ch of query) if (isWordChar(ch)) return true;
  return false;
}

/**
 * Score `needle` against `haystack`. Both must already be folded the same way.
 *
 * Returns the **best** tier across every occurrence: a verse containing both
 * `Tito` and `apetito` is a whole-word match, because the good match is the one
 * the reader is looking for.
 */
export function matchScore(haystack: string, needle: string): number {
  if (!needle) return SCORE_NONE;

  const boundaried = hasWordBoundaries(needle);
  let best = SCORE_NONE;

  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    // Without boundaries every occurrence is as good as any other, so the first
    // hit settles it and the scan stops.
    if (!boundaried) return SCORE_WHOLE_WORD;

    const before = isWordChar(haystack[at - 1]);
    const after = isWordChar(haystack[at + needle.length]);

    if (!before && !after) return SCORE_WHOLE_WORD;
    best = Math.max(best, before ? SCORE_INSIDE_WORD : SCORE_WORD_START);
  }

  return best;
}

export type MatchMode = 'substring' | 'word';

export interface MatchOptions {
  /**
   * `substring` (the default) finds `love` in `loveth`; `word` finds only whole
   * words. Substring stays the default because whole-word costs 49% of `love`
   * in the KJV and 55% of `amor` in Spanish — the inflections are wanted.
   */
  mode?: MatchMode;
  /** Diacritics are always folded; only case is optional. */
  caseSensitive?: boolean;
}

/**
 * Search an already-loaded `Bible`. Does no I/O.
 *
 * This is the half a browser needs: the PWA holds a `Bible` rebuilt from
 * IndexedDB and gets byte-for-byte the same matching the API performs, instead
 * of a second implementation that drifts from the folding rules.
 *
 * Results come back **ranked by match quality, canonical within a rank**. The
 * sort is stable and the index is already in canonical order, so equal-scoring
 * verses keep the order they are read in without carrying a book number around.
 */
export function searchBible(
  bible: Bible,
  query: string,
  options: MatchOptions = {}
): SearchResult[] {
  const { mode = 'substring', caseSensitive = false } = options;
  const fold = caseSensitive ? foldDiacritics : foldText;

  // Fold the query the same way the corpus was folded, or the two never meet.
  const needle = fold(query);
  // Guard the empty query: `''.includes('')` is true, so this would otherwise
  // return the entire corpus.
  if (!needle.trim()) return [];

  const results: SearchResult[] = [];
  for (const v of searchIndex(bible, caseSensitive)) {
    const score = matchScore(v.folded, needle);
    if (score === SCORE_NONE) continue;
    if (mode === 'word' && score !== SCORE_WHOLE_WORD) continue;

    results.push({
      ref: `${v.book} ${v.chapter}:${v.verse}`,
      book: v.book,
      book_slug: v.bookSlug,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
