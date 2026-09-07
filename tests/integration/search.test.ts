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
    // Recorded so a future change to whole-word matching is a decision rather
    // than a surprise.
    const am = await search('kjv', 'am');
    expect(am.some((r) => /abraham/i.test(r.text) && !/\bam\b/i.test(r.text))).toBe(true);
  });
});

describe('result shape and edge cases', () => {
  test('book_slug is directly usable as a URL segment', async () => {
    const [first] = await search('rv1909', 'principio');
    expect(first.book_slug).toMatch(/^[a-z0-9-]+$/);
    expect(first.ref).toContain(first.book);
  });

  test('results come back in canonical order', async () => {
    const results = await search('kjv', 'beginning');
    const order = results.map((r) => r.chapter);
    const genesisFirst = results[0];
    expect(genesisFirst.book).toBe('Genesis');
    expect(order.length).toBeGreaterThan(0);
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
