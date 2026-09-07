import { expect, test } from '@playwright/test';

/**
 * Cross-cutting HTTP behaviour: headers, methods, CORS.
 *
 * None of this is observable through `createRouter`, which returns
 * `{status, body}` and knows nothing about headers by design. That blind spot
 * is where the query-decoding path traversal hid — the router was correct, the
 * Express adapter around it was not.
 */

const BROWSER_ORIGIN = 'http://localhost:5173'; // a Vite dev server

test.describe('CORS', () => {
  test('a browser on another origin can read a success response', async ({ request }) => {
    const res = await request.get('/translations', { headers: { Origin: BROWSER_ORIGIN } });
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('CORS headers are present on errors too', async ({ request }) => {
    // Without this a browser cannot read the body of a 404 and just sees an
    // opaque network failure.
    const res = await request.get('/translations/nosuch', { headers: { Origin: BROWSER_ORIGIN } });
    expect(res.status()).toBe(404);
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('preflight is answered without falling through to the router', async ({ request }) => {
    const res = await request.fetch('/translations', {
      method: 'OPTIONS',
      headers: { Origin: BROWSER_ORIGIN, 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.status()).toBe(204);
    expect(res.headers()['access-control-allow-methods']).toContain('GET');
    expect(await res.text()).toBe('');
  });
});

test.describe('methods', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    test(`${method} is rejected with 405 and an Allow header`, async ({ request }) => {
      // This returned 200 with the chapter data before the method allowlist.
      const res = await request.fetch('/translations/kjv', { method });
      expect(res.status()).toBe(405);
      expect(res.headers()['allow']).toContain('GET');
      expect((await res.json()).error).toContain(method);
    });
  }

  test('HEAD returns headers and no body', async ({ request }) => {
    const res = await request.fetch('/translations/kjv/john/3/16', { method: 'HEAD' });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    expect(await res.text()).toBe('');
  });
});

test.describe('headers', () => {
  test('JSON is served as UTF-8 — non-Latin text depends on it', async ({ request }) => {
    const res = await request.get('/translations/bungo/john/3/16');
    expect(res.headers()['content-type']).toBe('application/json; charset=utf-8');
    expect((await res.json()).text).toContain('神');
  });

  test('successful responses are cacheable, errors are not', async ({ request }) => {
    const ok = await request.get('/translations/kjv/john/3/16');
    expect(ok.headers()['cache-control']).toContain('max-age');

    const missing = await request.get('/translations/kjv/john/999');
    expect(missing.headers()['cache-control']).toBe('no-store');
  });

  test('the server does not advertise itself', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-powered-by']).toBeUndefined();
  });
});
