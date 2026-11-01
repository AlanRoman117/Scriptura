import { readdirSync } from 'node:fs';
import { clearCache, getDataDir, loadTranslation } from '@scriptura/core';
import { createBible } from '@scriptura/core/bible';
import { foldDiacritics, foldText } from '@scriptura/core/books';
import type { Bible, SearchResult, TranslationMeta } from '@scriptura/core/types';
import {
  matchScore,
  searchBible,
  searchBibleTerms,
  SCORE_NONE,
  SCORE_WHOLE_WORD,
  type MatchOptions,
} from '@scriptura/search/matcher';
import { parseQuery, runQuery } from '../../apps/reader/src/lib/search';

/**
 * A multi-word search, one pass over the folded index.
 *
 * `runQuery` used to scan for the first term and then re-fold the text of every
 * candidate for each further term, which cost 89-158ms a key on a 4x CPU
 * throttle. The speed is not asserted here, since a clock would make this flaky:
 * the number of folds is. The rest of the file holds the results to what they
 * were, because a faster search that ranks differently is a different search.
 */

/**
 * Folding, remembered. Only so that the old logic below can be run thousands of
 * times: re-folding every candidate is the very cost being removed, and took this
 * file past two minutes. Folding is pure, so remembering it changes no result.
 */
const remembered = (fold: (s: string) => string) => {
  const known = new Map<string, string>();
  return (s: string): string => {
    let folded = known.get(s);
    if (folded === undefined) known.set(s, (folded = fold(s)));
    return folded;
  };
};
let foldCased = remembered(foldDiacritics);
let foldCaseless = remembered(foldText);

/**
 * ⚠️ What `runQuery` did before the one pass, verbatim but for the remembered
 * folds, and the reference for every comparison below. Do not tidy it, and do not
 * route it through the new function: it is here to be the old behaviour.
 */
function narrowingRunQuery(
  bible: Bible,
  input: string,
  options: MatchOptions = {}
): SearchResult[] {
  const { required, excluded } = parseQuery(input);
  if (required.length === 0) return [];

  const fold = options.caseSensitive ? foldCased : foldCaseless;
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
    results = results.filter((r) => !fold(r.text).includes(needle));
  }

  return results.sort((a, b) => b.score - a.score);
}

const EVERY_OPTION: MatchOptions[] = [
  {},
  { mode: 'word' },
  { caseSensitive: true },
  { mode: 'word', caseSensitive: true },
];

/** A space between combining accents: `trim()` keeps it all, folding leaves the space. */
const FOLDS_TO_SPACE = '\u0301 \u0301';
/** A combining accent alone: not whitespace, so a term, but it folds to nothing. */
const FOLDS_TO_NOTHING = '\u0301';

/** Queries that decide something, in every script the library holds. */
const WORD_QUERIES = [
  // Latin: common words, which keep the most candidates and tie the most often.
  'love god',
  'god love',
  'the and',
  'and the',
  'in the beginning',
  'jesus wept',
  'lord god of',
  'e a',
  'a e i o u',
  // Case: what `match case` splits, and a term repeated.
  'God god',
  'LORD Lord',
  'Love love',
  'the the',
  // Diacritics, in the query and in the text.
  'amor dios',
  'amó dios',
  'AMÓ Dios',
  'dios -amó',
  'dieu amour',
  'Dieu péché',
  'péché -dieu',
  'deus amor',
  'coração senhor',
  'tito apetito',
  // Phrases.
  '"in the beginning" god',
  '"the lord" -"the lord god"',
  'god "of israel" -jacob',
  '"el señor" dios',
  // Exclusions alone, and exclusions that take everything.
  '-love',
  '-love -god',
  'love -love',
  'love -lov',
  'love -e',
  'the -love',
  'the -and -of',
  // Japanese, whose characters have no word boundaries; dakuten must survive.
  '神',
  '神 イエス',
  'イエス 神',
  'イエス -神',
  '"イエス" ヨハネ',
  'ガラテヤ',
  'カラテヤ',
  'ガラテヤ 神',
  '神 の',
  '-神 の',
  // Two scripts in one query: one term has boundaries and the other has none.
  '神 love',
  'god 神',
];

/**
 * Queries about the grammar and the folding rather than about a language, so one
 * Bible per kind of text will do; `kjv`, accents and bare Japanese below.
 */
const CORNER_QUERIES = [
  // The grammar's corners.
  '-',
  '--',
  '- love',
  'love -',
  '--love',
  'love --god',
  '"',
  '""',
  '-""',
  '" "',
  'love "',
  '"love',
  'a-b',
  "lord's god",
  // Terms that fold to nothing, or to a space, wherever they stand.
  FOLDS_TO_NOTHING,
  `love ${FOLDS_TO_NOTHING}`,
  `${FOLDS_TO_NOTHING} love`,
  `love -${FOLDS_TO_NOTHING}`,
  `"${FOLDS_TO_SPACE}"`,
  `love "${FOLDS_TO_SPACE}"`,
  `"${FOLDS_TO_SPACE}" love`,
  `love -"${FOLDS_TO_SPACE}"`,
  // Characters a careless matcher would treat as syntax, and ones that change
  // length when folded.
  '.* (',
  '[a-z] $',
  '\\ god',
  'İ god',
  'ß god',
  'ﬁ god',
  '𝔘 god',
];

/**
 * Queries built from a translation's own text, so that every language finds
 * something and all three score tiers turn up: a whole word, the start of one,
 * and the inside of one. Sampled by a fixed stride, so a failure reproduces.
 */
function queriesFrom(bible: Bible, samples: number): string[] {
  const verses = bible.books.flatMap((b) => b.chapters.flatMap((c) => c.verses));
  const queries: string[] = [];
  const counts = new Map<string, number>();

  for (let i = 0; i < samples; i++) {
    const { text } = verses[Math.floor(((i + 0.5) * verses.length) / samples)];
    const spaced = text.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    // A translation with no spaces is cut into pairs of characters instead.
    const words = spaced.length > 2 ? spaced : (text.match(/[\p{L}\p{N}\p{M}]{1,2}/gu) ?? []);
    if (words.length < 3) continue;
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);

    const middle = Math.floor(words.length / 2);
    const [a, b, c] = [words[middle], words[middle + 1] ?? words[0], words[0]];
    queries.push(
      [
        `${a} ${c}`,
        `${a.slice(0, 3)} ${c}`,
        `${c} ${a.slice(0, 3)}`,
        `${a.slice(1, 4)} ${b.slice(0, 2)}`,
        `"${a} ${b}" ${c.slice(0, 2)}`,
        `${a.slice(0, 2)} -${b.slice(0, 2)}`,
        `${a.toUpperCase()} ${c}`,
        `${c.slice(0, 1)} ${b.slice(0, 1)} -${a.slice(1, 3)}`,
      ][i % 8]
    );
  }

  // The most frequent words are the worst case: most of the corpus is a candidate.
  const [top, next] = [...counts].sort((x, y) => y[1] - x[1]).map(([w]) => w);
  queries.push(`${top} ${next}`, `${next} ${top}`, `${top} -${next}`, `${top.slice(0, 1)} ${next.slice(0, 1)}`);
  return queries;
}

const RESULT_FIELDS = ['ref', 'book', 'book_slug', 'chapter', 'verse', 'text', 'score'] as const;

/** What differs, briefly: a difference in 30,000 verses must not print them all. */
function difference(expected: SearchResult[], actual: SearchResult[]): string | null {
  if (expected.length !== actual.length) return `${expected.length} results became ${actual.length}`;
  for (let at = 0; at < expected.length; at++) {
    const [was, now] = [expected[at], actual[at]];
    if (Object.keys(now).length !== RESULT_FIELDS.length || RESULT_FIELDS.some((f) => was[f] !== now[f])) {
      return `at ${at}: ${was.ref} (${was.score}) became ${now.ref} (${now.score})`;
    }
  }
  return null;
}

/** Whether results of equal score left canonical order: the tie the first term breaks. */
function tiesOutOfCanonicalOrder(results: SearchResult[], bible: Bible): boolean {
  const canonical = new Map(bible.books.map((b, i) => [b.slug, i]));
  const position = (r: SearchResult) =>
    (canonical.get(r.book_slug) ?? 0) * 1e6 + r.chapter * 1e3 + r.verse;
  return results.some(
    (r, i) => i > 0 && results[i - 1].score === r.score && position(results[i - 1]) > position(r)
  );
}

describe('runQuery and the narrowing it replaced, on every translation', () => {
  /** Kept across the translations, to prove below that the comparison had teeth. */
  const seen = { runs: 0, found: 0, multiTerm: 0, reordered: 0, tiers: new Set<number>() };
  afterAll(() => clearCache());

  // Read off the disk, so a translation added later is compared without asking.
  test.each(readdirSync(getDataDir()).sort())(
    '%s returns the same results, in the same order, with the same scores',
    async (id) => {
      const bible = await loadTranslation(id);
      const corners = ['kjv', 'rv1909', 'bungo'].includes(id) ? CORNER_QUERIES : [];
      const queries = [...WORD_QUERIES, ...corners, ...queriesFrom(bible, 16)];
      const drifted: string[] = [];

      for (const query of queries) {
        for (const options of EVERY_OPTION) {
          const expected = narrowingRunQuery(bible, query, options);
          const actual = runQuery(bible, query, options);
          const drift = difference(expected, actual);
          if (drift) drifted.push(`${JSON.stringify(query)} ${JSON.stringify(options)}: ${drift}`);

          seen.runs++;
          if (expected.length > 0) seen.found++;
          if (expected.length > 0 && parseQuery(query).required.length > 1) {
            seen.multiTerm++;
            if (tiesOutOfCanonicalOrder(expected, bible)) seen.reordered++;
          }
          if (seen.tiers.size < 3) for (const r of expected) seen.tiers.add(r.score);
        }
      }

      expect(drifted).toEqual([]);
      // The index, the folds and the Bible are a lot to hold for eleven of them.
      clearCache();
      foldCased = remembered(foldDiacritics);
      foldCaseless = remembered(foldText);
    },
    180_000
  );

  /**
   * ⚠️ A comparison that finds nothing passes too. This is what makes the above
   * mean something: it did reach the case a one-pass rewrite gets wrong, ties
   * that are not in canonical order, and all three tiers.
   */
  test('the comparison reached the cases that could drift', () => {
    expect(seen.runs).toBeGreaterThan(2500);
    expect(seen.found).toBeGreaterThan(1000);
    expect(seen.multiTerm).toBeGreaterThan(500);
    expect(seen.reordered).toBeGreaterThan(50);
    expect([...seen.tiers].sort()).toEqual([1, 2, 3]);
  });
});

describe('a multi-word search does not re-fold the text', () => {
  /**
   * The audited cost, as a count: folding is two `normalize` calls, so this says
   * how many strings a search folded without timing anything. The query's own
   * terms must be folded; the verses, already folded in the index, must not be.
   */
  function normalizesDuring(run: () => void): number {
    const original = String.prototype.normalize;
    let calls = 0;
    String.prototype.normalize = function (this: string, form?: string) {
      calls++;
      return original.call(this, form);
    };
    try {
      run();
    } finally {
      String.prototype.normalize = original;
    }
    return calls;
  }

  let kjv: Bible;
  beforeAll(async () => {
    kjv = await loadTranslation('kjv');
  });
  afterAll(() => clearCache());

  test.each([
    ['later required terms', 'the and of', 3],
    ['excluded terms', 'the -love', 2],
    ['both together', '"in the" lord -love -god', 4],
  ])('%s fold the query, not the candidates', (_name, query, terms) => {
    for (const options of EVERY_OPTION) {
      // The first search builds the index, once per case setting, and is allowed to.
      const found = runQuery(kjv, query, options).length;
      expect(found).toBeGreaterThan(0);
      expect(normalizesDuring(() => runQuery(kjv, query, options))).toBe(2 * terms);
    }
  });
});

describe('the rules a one-pass search must keep', () => {
  const meta = { id: 'test', name: 'Test' } as TranslationMeta;
  const bibleOf = (...texts: string[]) =>
    createBible(meta, [
      {
        number: 1,
        slug: 'genesis',
        name: 'Genesis',
        abbreviation: 'Gen',
        testament: 'OT',
        chapters: [{ number: 1, verses: texts.map((text, i) => ({ number: i + 1, text })) }],
      },
    ]);
  const verses = (results: SearchResult[]) => results.map((r) => r.verse);

  /** Checks the old logic as well: a rule stated here is a rule it had. */
  const both = (bible: Bible, query: string, options?: MatchOptions) => {
    const results = runQuery(bible, query, options);
    expect(results).toEqual(narrowingRunQuery(bible, query, options));
    return results;
  };

  test('among equal scores the better first term comes first, then canonical order', () => {
    const bible = bibleOf('loved god', 'love godly', 'lovely godly', 'love godly again');

    // Verse 1 and 2 both end on 2, the worst of their terms. Verse 2's first term
    // was the whole word, so it leads though verse 1 is read first.
    const results = both(bible, 'love god');
    expect(verses(results)).toEqual([2, 4, 1, 3]);
    expect(results.map((r) => r.score)).toEqual([2, 2, 2, 2]);

    // Swap the terms and verse 1 has the better first term instead.
    expect(verses(both(bible, 'god love'))).toEqual([1, 2, 3, 4]);
  });

  test('a result keeps the score of its worst term', () => {
    const results = both(bibleOf('love god', 'loved god', 'gloves god'), 'love god');
    expect(results.map((r) => [r.verse, r.score])).toEqual([[1, 3], [2, 2], [3, 1]]);
  });

  test('word mode holds every term to whole words, and exclusion stays substring', () => {
    const bible = bibleOf('love god', 'love godly', 'loved god', 'love god lovely', 'love god gloves');
    expect(verses(both(bible, 'love god', { mode: 'word' }))).toEqual([1, 4, 5]);
    expect(verses(both(bible, 'love god -lovel', { mode: 'word' }))).toEqual([1, 5]);
  });

  test('a term that folds to nothing finds nothing, wherever it stands', () => {
    const bible = bibleOf('love god', 'lovegod');
    expect(both(bible, `love ${FOLDS_TO_NOTHING}`)).toEqual([]);
    expect(both(bible, `${FOLDS_TO_NOTHING} love`)).toEqual([]);
    // `includes('')` is true, so this one excludes every verse.
    expect(both(bible, `love -${FOLDS_TO_NOTHING}`)).toEqual([]);
  });

  test('a term that folds to a space is blank only when it comes first', () => {
    const bible = bibleOf('love god', 'lovegod');
    expect(both(bible, `"${FOLDS_TO_SPACE}" love`)).toEqual([]);
    expect(verses(both(bible, `love "${FOLDS_TO_SPACE}"`))).toEqual([1]);
    expect(verses(both(bible, `love -"${FOLDS_TO_SPACE}"`))).toEqual([2]);
  });

  test('with no required term there is nothing to search for', () => {
    const bible = bibleOf('love god');
    expect(searchBibleTerms(bible, [])).toEqual([]);
    expect(searchBibleTerms(bible, [], ['love'])).toEqual([]);
  });

  test('one term is exactly the server\'s search', () => {
    const bible = bibleOf('Tito', 'apetito', 'titos', 'gran apetito, y tito');
    for (const options of EVERY_OPTION) {
      expect(searchBibleTerms(bible, ['tito'], [], options)).toEqual(searchBible(bible, 'tito', options));
    }
  });
});
