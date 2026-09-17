import { connect } from 'node:net';
import { expect, test } from '@playwright/test';

/**
 * Send a request line verbatim, bypassing URL normalisation.
 *
 * Every HTTP client — Playwright's included — parses and normalises a URL
 * before sending, so `/translations/%2e%2e` is decoded and collapsed to `/`
 * client-side and the server never sees the payload. An attacker writes the
 * bytes directly, so the test has to as well.
 */
function rawGet(path: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    socket.setTimeout(10_000, () => socket.destroy(new Error('timeout')));
    socket.on('data', (chunk) => (data += chunk));
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

/**
 * Error contract and security invariants, asserted over real HTTP.
 *
 * The traversal cases are duplicated from the jest suite deliberately: it is a
 * security invariant, and the bug it guards was an *adapter*-layer bug — query
 * strings are percent-decoded where path segments are not — so it must be
 * proven at the layer where that difference exists.
 */

test.describe('actionable errors', () => {
  test('an unresolvable book suggests real slugs', async ({ request }) => {
    const res = await request.get('/translations/kjv/songofsolomon/1/1');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.valid_examples.length).toBeGreaterThan(0);
    expect(body.valid_examples.some((s: string) => /^\d/.test(s))).toBe(true);
  });

  test('an out-of-range chapter reports the real range', async ({ request }) => {
    const body = await (await request.get('/translations/kjv/john/99')).json();
    expect(body.valid_range).toEqual([1, 21]);
  });

  test('missing query params are 400, not 500', async ({ request }) => {
    expect((await request.get('/search?q=love')).status()).toBe(400);
    expect((await request.get('/compare?ref=John+3:16')).status()).toBe(400);
    expect((await request.get('/compare/chapter?book=john')).status()).toBe(400);
  });

  test('a malformed reference is the caller\'s error', async ({ request }) => {
    expect((await request.get('/compare?ref=garbage&translations=kjv')).status()).toBe(400);
    expect((await request.get('/search?q=a&translation=kjv&limit=abc')).status()).toBe(400);
  });

  test('bracket query syntax is not supported under the Express 5 parser', async ({ request }) => {
    // Documented behaviour, not an accident: the default parser went
    // extended -> simple, and "extended" is qs, the package the advisories
    // that prompted the upgrade were in.
    expect((await request.get('/search?q[]=love&translation=kjv')).status()).toBe(400);
    expect((await request.get('/search?q=love&translation=kjv')).status()).toBe(200);
  });
});

test.describe('path traversal', () => {
  const ESCAPES = [
    '../../../../../../etc',
    '..',
    '/etc/passwd',
    'kjv/../../../etc',
    './kjv',
  ];

  for (const id of ESCAPES) {
    test(`?translation=${JSON.stringify(id)} is refused`, async ({ request }) => {
      const res = await request.get(
        `/search?q=a&translation=${encodeURIComponent(id)}`
      );
      expect(res.status()).not.toBe(200);
    });
  }

  test('percent-encoded traversal in the path is inert', async ({ baseURL }) => {
    const port = Number(new URL(baseURL!).port);
    for (const p of [
      '/translations/%2e%2e',
      '/translations/..%2f..%2fetc',
      '/translations/%2e%2e%2f%2e%2e%2fetc',
    ]) {
      const raw = await rawGet(p, port);
      // Express does not percent-decode req.path, so these arrive as literal
      // directory names containing '%' and resolve to nothing.
      expect(raw.split('\r\n')[0], `raw request line: GET ${p}`).toContain('404');
      expect(raw).not.toContain('/home/');
    }
  });

  test('rejections never disclose a filesystem path', async ({ request }) => {
    const res = await request.get('/search?q=a&translation=..%2F..%2F..%2Fetc');
    const text = await res.text();
    expect(text).not.toContain('/home/');
    expect(text).not.toMatch(/\/(usr|etc|var|root)\//);
  });

  test('unknown routes 404 rather than leaking anything', async ({ request }) => {
    const res = await request.get('/nope');
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain('/home/');
  });
});
