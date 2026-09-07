/**
 * Search, offline, over the translation already in memory.
 *
 * Matching comes from `@scriptura/search/matcher` — the server's own
 * implementation — so results are identical online and off, including the
 * diacritic folding that makes `amo` find `amó`. Only the query *grammar* is
 * added here: quoted phrases and boolean terms, which the spec asks for and
 * plain substring matching cannot express.
 */
import { foldText, parseReference } from '@scriptura/core/books';
import type { Bible, SearchResult } from '@scriptura/core/types';
import { searchBible } from '@scriptura/search/matcher';

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
 * folding are the shared implementation; the rest filter that candidate set.
 * Narrowing an already-small list beats scanning 31,000 verses once per term.
 *
 * Returns every match. A common word finds tens of thousands of verses, so the
 * caller slices — but it must report `results.length`, not the slice.
 */
export function runQuery(bible: Bible, input: string): SearchResult[] {
  const { required, excluded } = parseQuery(input);
  if (required.length === 0) return [];

  let results = searchBible(bible, required[0]);

  for (const term of required.slice(1)) {
    const needle = foldText(term);
    results = results.filter((r) => foldText(r.text).includes(needle));
  }
  for (const term of excluded) {
    const needle = foldText(term);
    results = results.filter((r) => !foldText(r.text).includes(needle));
  }

  // Every match, not a page of them. The caller slices for display, but the
  // count it reports has to be the real one — "200 matches" for both `God` and
  // `God -love` is the kind of confident wrong answer the spec is reacting to.
  return results;
}

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
