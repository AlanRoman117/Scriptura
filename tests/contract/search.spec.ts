import { expect, test } from '@playwright/test';

/**
 * Search semantics over HTTP.
 *
 * The jest suite proves the matching rules; this proves they survive the
 * adapter — query strings are percent-decoded, and accented characters have to
 * round-trip through URL encoding intact.
 */

test('an accented query survives URL encoding', async ({ request }) => {
  // ?q=amó — the byte the front-end's search box will actually send.
  const accented = await request.get('/search?q=am%C3%B3&translation=rv1909&limit=5');
  expect(accented.status()).toBe(200);
  const a = await accented.json();
  expect(a.total).toBeGreaterThan(0);

  // …and returns the same set as the unaccented spelling.
  const plain = await (await request.get('/search?q=amo&translation=rv1909&limit=5')).json();
  expect(a.total).toBe(plain.total);
});

test('folding actually widens the result set', async ({ request }) => {
  // Guards the specific regression: before folding, this returned 1,102.
  const body = await (await request.get('/search?q=amo&translation=rv1909&limit=1')).json();
  expect(body.total).toBeGreaterThan(1200);
});

test('non-Latin queries work over HTTP', async ({ request }) => {
  const body = await (
    await request.get(`/search?q=${encodeURIComponent('神')}&translation=bungo&limit=3`)
  ).json();
  expect(body.total).toBeGreaterThan(100);
  expect(body.results[0].text).toContain('神');
});

test('an empty query returns nothing, not the whole corpus', async ({ request }) => {
  // `q=` is present-but-empty, which the router treats as missing.
  expect((await request.get('/search?q=&translation=kjv')).status()).toBe(400);
  // Whitespace-only gets through the router and must be caught by the search.
  const ws = await (await request.get('/search?q=%20%20&translation=kjv&limit=1')).json();
  expect(ws.total).toBe(0);
});

test('a no-match query is an empty page, not an error', async ({ request }) => {
  const res = await request.get('/search?q=zzzzqqqq&translation=kjv');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.total).toBe(0);
  expect(body.results).toEqual([]);
});

test.describe('matching options', () => {
  /**
   * The Tito problem, over HTTP. Searching a Spanish translation for Titus
   * returned `apetito` mixed in with him, because every match looked alike.
   */
  test('ranking puts the person above the words containing his name', async ({ request }) => {
    const body = await (await request.get('/search?q=Tito&translation=rv1909&limit=50')).json();
    expect(body.mode).toBe('substring');
    expect(body.match_case).toBe(false);

    const scores = body.results.map((r: { score: number }) => r.score);
    expect(Math.max(...scores)).toBeGreaterThan(Math.min(...scores));
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));
    expect(/apetito/i.test(body.results[0].text)).toBe(false);
  });

  test('word mode narrows, and says that it did', async ({ request }) => {
    const loose = await (await request.get('/search?q=Tito&translation=rv1909')).json();
    const strict = await (
      await request.get('/search?q=Tito&translation=rv1909&mode=word')
    ).json();

    expect(strict.mode).toBe('word');
    expect(strict.total).toBeLessThan(loose.total);
    expect(strict.total).toBeGreaterThan(0);
  });

  test('word mode leaves Japanese exactly as it was', async ({ request }) => {
    // Japanese is written without spaces, so a naive whole-word rule takes 神
    // from thousands of verses to a handful. The toggle must be a no-op there.
    const loose = await (await request.get('/search?q=%E7%A5%9E&translation=bungo')).json();
    const strict = await (
      await request.get('/search?q=%E7%A5%9E&translation=bungo&mode=word')
    ).json();
    expect(strict.total).toBe(loose.total);
    expect(loose.total).toBeGreaterThan(1000);
  });

  test('match_case is honoured, and diacritics stay folded regardless', async ({ request }) => {
    const sensitive = await (
      await request.get('/search?q=Abraham&translation=kjv&match_case=1')
    ).json();
    const insensitive = await (
      await request.get('/search?q=Abraham&translation=kjv')
    ).json();
    expect(sensitive.match_case).toBe(true);
    expect(sensitive.total).toBeGreaterThan(0);
    expect(sensitive.total).toBeLessThanOrEqual(insensitive.total);

    // Folding is normalization, not strictness: it does not switch off.
    const accented = await (
      await request.get('/search?q=Josu%C3%A9&translation=rv1909&match_case=1')
    ).json();
    expect(accented.total).toBeGreaterThan(0);
  });

  test('an unusable option is a 400, not a quietly different answer', async ({ request }) => {
    for (const bad of ['mode=fuzzy', 'match_case=yes']) {
      const res = await request.get(`/search?q=love&translation=kjv&${bad}`);
      expect(res.status(), bad).toBe(400);
    }
  });
});
