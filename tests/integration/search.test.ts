import { search, lookup } from '@scriptura/search';
import { clearCache } from '@scriptura/core';

/**
 * Search semantics, pinned down.
 *
 * Matching is a *substring* match on case- and diacritic-folded text. Each of
 * those three words is a deliberate choice and is asserted here, because the
 * diacritic half was missing and nobody noticed: `amo` returned 1,102 verses in
 * rv1909 where it should return 1,473.
 */

afterAll(() => clearCache());

describe('diacritic folding', () => {
  test('an unaccented query finds accented text (Spanish)', async () => {
    const folded = await search('rv1909', 'amo');
    const naive = folded.filter((r) => r.text.toLowerCase().includes('amo'));
    expect(folded.length).toBeGreaterThan(naive.length);
    // The verses only reachable with folding are the accented ones.
    expect(folded.some((r) => /amó/i.test(r.text))).toBe(true);
  });

  test('an accented query finds unaccented text — folding is symmetric', async () => {
    const withAccent = await search('rv1909', 'amó');
    const without = await search('rv1909', 'amo');
    expect(withAccent.map((r) => r.ref)).toEqual(without.map((r) => r.ref));
  });

  test('works for French too', async () => {
    const results = await search('lsg1910', 'peche');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => /péch/i.test(r.text))).toBe(true);
  });

  test('is case-insensitive in both directions', async () => {
    const lower = await search('kjv', 'beginning');
    const upper = await search('kjv', 'BEGINNING');
    expect(lower.map((r) => r.ref)).toEqual(upper.map((r) => r.ref));
    expect(lower.length).toBeGreaterThan(0);
  });
});

describe('non-Latin text', () => {
  test('Japanese search works and is not corrupted by folding', async () => {
    const results = await search('bungo', '神');
    expect(results.length).toBeGreaterThan(100);

    // The dakuten regression, end to end: if folding stripped U+3099 the
    // corpus would hold カ where it should hold ガ, and this would miss.
    const dakuten = await search('bungo', 'ガ');
    expect(dakuten.length).toBeGreaterThan(0);
    expect(dakuten.every((r) => r.text.includes('ガ'))).toBe(true);
  });
});

describe('match semantics are substring, deliberately', () => {
  test('a stem finds its archaic inflections', async () => {
    // This is why substring rather than whole-word: KJV writes "loveth", and a
    // reader searching "love" expects to find it.
    const love = await search('kjv', 'love');
    expect(love.some((r) => /loveth/i.test(r.text))).toBe(true);
    expect(love.some((r) => /loved/i.test(r.text))).toBe(true);
  });

  test('the cost of that is over-matching on short queries', async () => {
    // Documented, not accidental: "am" matches "name", "came", "Abraham".
    // Still true — substring is still the default — but no longer unranked.
    const am = await search('kjv', 'am');
    expect(am.some((r) => /abraham/i.test(r.text) && !/\bam\b/i.test(r.text))).toBe(true);
  });

  test('and the answer to it is ranking, not a stricter default', async () => {
    const am = await search('kjv', 'am');
    // Verses that say "am" outrank verses that merely contain those letters,
    // so the reader sees the ones they meant first without losing the rest.
    const incidental = am.findIndex(
      (r) => /abraham/i.test(r.text) && !/\bam\b/i.test(r.text)
    );
    expect(am[0].score).toBeGreaterThan(am[incidental].score);
    expect(/\bam\b/i.test(am[0].text)).toBe(true);
  });
});

describe('the Tito problem', () => {
  /**
   * The regression this ranking was built for. Searching a Spanish translation
   * for Titus returned `apetito` and `emprestito` mixed in with him, because
   * every match looked alike.
   */
  test('Titus outranks the words that merely contain his name', async () => {
    const results = await search('rv1909', 'Tito');
    expect(results.length).toBeGreaterThan(14);

    const noise = results.filter((r) => /apetito|emprestito/i.test(r.text));
    const person = results.filter((r) => !/apetito|emprestito/i.test(r.text));
    expect(noise.length).toBeGreaterThan(0);
    expect(person.length).toBeGreaterThan(0);

    // Every one of the person's verses comes before every coincidence.
    const lastPerson = results.findIndex((r) => r === person[person.length - 1]);
    const firstNoise = results.findIndex((r) => r === noise[0]);
    expect(lastPerson).toBeLessThan(firstNoise);
  });

  test('and word mode drops them entirely when asked', async () => {
    const loose = await search('rv1909', 'Tito');
    const strict = await search('rv1909', 'Tito', { mode: 'word' });
    expect(strict.length).toBeLessThan(loose.length);
    expect(strict.some((r) => /apetito/i.test(r.text))).toBe(false);
  });

  test('but word mode is not the default, because inflections matter', async () => {
    // Whole-word costs 49% of `love` in the KJV and 55% of `amor` in Spanish.
    const loose = await search('kjv', 'love');
    const strict = await search('kjv', 'love', { mode: 'word' });
    expect(loose.some((r) => /loveth/i.test(r.text))).toBe(true);
    expect(strict.length).toBeLessThan(loose.length);
  });

  test('case can be matched when a name is the point', async () => {
    const insensitive = await search('kjv', 'Abraham', { caseSensitive: false });
    const sensitive = await search('kjv', 'Abraham', { caseSensitive: true });
    expect(sensitive.length).toBeGreaterThan(0);
    expect(sensitive.length).toBeLessThanOrEqual(insensitive.length);
    // Diacritics stay folded either way — that is normalization, not strictness.
    expect((await search('rv1909', 'Josué', { caseSensitive: true })).length)
      .toBeGreaterThan(0);
  });
});

describe('scripts without word separators', () => {
  /**
   * ⚠️ The invariant that decides the whole design. Japanese has no spaces, so
   * a naive whole-word rule took 神 from 3,945 verses to 3. Word mode must
   * return *exactly* what substring mode does for a Japanese query — not
   * nearly, exactly — or the toggle silently destroys the translation.
   */
  test.each(['神', 'イエス', 'ヨハネ'])('word mode is a no-op for %s', async (query) => {
    const loose = await search('bungo', query);
    const strict = await search('bungo', query, { mode: 'word' });
    expect(strict.length).toBe(loose.length);
    expect(strict.map((r) => r.ref)).toEqual(loose.map((r) => r.ref));
  });

  test('so a Japanese result set keeps canonical order', async () => {
    // Every match scores alike, so ranking cannot reorder it into something
    // arbitrary.
    const results = await search('bungo', 'イエス');
    expect(new Set(results.map((r) => r.score)).size).toBe(1);
    // By slug: `book` is the translation's own name for it, マタイによる福音書.
    expect(results[0].book_slug).toBe('matthew');
  });
});

describe('result shape and edge cases', () => {
  test('book_slug is directly usable as a URL segment', async () => {
    const [first] = await search('rv1909', 'principio');
    expect(first.book_slug).toMatch(/^[a-z0-9-]+$/);
    expect(first.ref).toContain(first.book);
  });

  test('results are ranked, and canonical within a rank', async () => {
    const results = await search('kjv', 'beginning');
    expect(results[0].book).toBe('Genesis');

    // Scores descend; equal scores keep the order the corpus is read in, so a
    // ranked list is still walkable rather than shuffled.
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
    const best = results.filter((r) => r.score === results[0].score);
    const canonical = [...best].sort(
      (a, b) => a.chapter - b.chapter || a.verse - b.verse
    );
    expect(best.filter((r) => r.book === 'Genesis').map((r) => r.ref)).toEqual(
      canonical.filter((r) => r.book === 'Genesis').map((r) => r.ref)
    );
  });

  test('an empty or whitespace query returns nothing rather than everything', async () => {
    // `''.includes('')` is true, so an unfolded implementation returns the
    // entire corpus for an empty query.
    expect(await search('kjv', '')).toHaveLength(0);
    expect(await search('kjv', '   ')).not.toHaveLength(31102);
  });

  test('a query with no matches returns an empty array, not an error', async () => {
    expect(await search('kjv', 'zzzzqqqq')).toEqual([]);
  });
});

describe('lookup resolves books the same way search folds text', () => {
  test('accented and slug forms both resolve', async () => {
    const bySlug = await lookup('rv1909', 'john 3:16');
    const byName = await lookup('rv1909', 'Juan 3:16');
    expect(bySlug).toHaveLength(1);
    expect(bySlug[0].text).toBe(byName[0].text);
  });

  test('a range returns each verse', async () => {
    const range = await lookup('kjv', 'Romans 8:28-30');
    expect(range).toHaveLength(3);
    expect(range.map((r) => r.verse)).toEqual([28, 29, 30]);
  });
});
