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
