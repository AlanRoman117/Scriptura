/**
 * Search, offline, over the translation already in memory.
 *
 * Matching comes from `@scriptura/search/matcher` — the server's own
 * implementation — so results are identical online and off, including the
 * diacritic folding that makes `amo` find `amó`. Only the query *grammar* is
 * added here: quoted phrases and boolean terms, which the spec asks for and
 * plain substring matching cannot express.
 */
import { foldDiacritics, foldText, parseReference } from '@scriptura/core/books';
import type { Bible, SearchResult } from '@scriptura/core/types';
import {
  matchScore,
  searchBible,
  SCORE_NONE,
  SCORE_WHOLE_WORD,
  type MatchOptions,
} from '@scriptura/search/matcher';

export type { MatchOptions } from '@scriptura/search/matcher';

export interface Query {
  /** Quoted groups and bare words that must all appear. */
  required: string[];
  /** Terms prefixed with `-`, which must not appear. */
  excluded: string[];
  /** Whether any quoted phrase was used, for explaining results back. */
  phrases: string[];
}

/**
 * Parse `"living water" river -stone` into terms.
 *
 * Deliberately small: quotes for a phrase, a leading `-` to exclude, and
 * everything else required. No OR, no parentheses — the spec's complaint about
 * search is that it returns *probabilistic* matches, so the grammar here favours
 * being predictable over being expressive.
 */
export function parseQuery(input: string): Query {
  const required: string[] = [];
  const excluded: string[] = [];
  const phrases: string[] = [];

  const pattern = /(-?)"([^"]+)"|(-?)(\S+)/g;
  for (const m of input.matchAll(pattern)) {
    const negated = (m[1] || m[3]) === '-';
    const term = (m[2] ?? m[4] ?? '').trim();
    if (!term) continue;
    if (m[2] !== undefined) phrases.push(term);
    (negated ? excluded : required).push(term);
  }
  return { required, excluded, phrases };
}

/**
 * Run a query against a loaded translation.
 *
 * The first required term goes through `searchBible` so the corpus scan and its
 * folding are the shared implementation; the rest narrow that candidate set.
 * Narrowing an already-small list beats scanning 31,000 verses once per term.
 *
 * Every term is scored through the same `matchScore` the engine uses — the
 * later terms used to re-fold the text and call `includes` directly, which
 * meant that with `mode: 'word'` the first term matched whole words and the
 * rest matched anywhere.
 *
 * A result keeps its **worst** term's score: "every word matched cleanly" is a
 * better result than "one of them landed inside a longer word", and that is
 * what the ranking is for.
 *
 * Returns every match. A common word finds tens of thousands of verses, so the
 * caller slices — but it must report `results.length`, not the slice.
 */
export function runQuery(
  bible: Bible,
  input: string,
  options: MatchOptions = {}
): SearchResult[] {
  const { required, excluded } = parseQuery(input);
  if (required.length === 0) return [];

  const fold = options.caseSensitive ? foldDiacritics : foldText;
  let results = searchBible(bible, required[0], options);

  for (const term of required.slice(1)) {
    const needle = fold(term);
    results = results.flatMap((r) => {
      const score = matchScore(fold(r.text), needle);
      if (score === SCORE_NONE) return [];
      if (options.mode === 'word' && score !== SCORE_WHOLE_WORD) return [];
      return [{ ...r, score: Math.min(r.score, score) }];
    });
  }
  for (const term of excluded) {
    const needle = fold(term);
    // Exclusion is deliberately substring even in word mode: asking to drop
    // `love` should also drop `loveth`, or the term reads as a promise it
    // does not keep.
    results = results.filter((r) => !fold(r.text).includes(needle));
  }

  // Re-sorted because a later term can demote a result the first term ranked
  // highly. Stable, so equal scores stay in canonical order.
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Where the good matches stop and the incidental ones begin.
 *
 * Shared by both search surfaces so they cannot disagree about where the rule
 * is drawn — a short query like `Tito` never reaches the full results view,
 * because all 17 of its matches fit in the dropdown.
 */
export const startsWeakMatches = (
  previous: SearchResult | undefined,
  current: SearchResult
): boolean =>
  previous !== undefined &&
  previous.score === SCORE_WHOLE_WORD &&
  current.score !== SCORE_WHOLE_WORD;

export interface ResolvedReference {
  book_slug: string;
  book: string;
  chapter: number;
  verse?: number;
}

/**
 * Interpret the query as a reference, if it is one.
 *
 * `John 3:16`, `Juan 3:16`, `jn 3`, `43 3:16` all resolve — the grammar and the
 * book index are both the server's, so anything the API accepts works here. A
 * reference jumps you there; anything else is a text search. This is what the
 * verse dropdown would have been, without a third control in the bar.
 */
export function resolveReference(bible: Bible, input: string): ResolvedReference | null {
  const parsed = parseReference(input);
  if (!parsed) return null;

  const book = bible.book(parsed.book);
  if (!book) return null;

  const chapter = book.chapters.find((c) => c.number === parsed.chapter);
  if (!chapter) return null;

  return {
    book_slug: book.slug,
    book: book.name,
    chapter: parsed.chapter,
    verse: parsed.verse !== undefined && chapter.verses.some((v) => v.number === parsed.verse)
      ? parsed.verse
      : undefined,
  };
}
