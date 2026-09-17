import { expect, failures, open, test } from './fixture';

/**
 * The published site, as GitHub Pages serves it.
 *
 * Every other suite runs the app at the root of a preview server with the API
 * behind it — how it is developed, and never how it is published. These are
 * the things that differ: every path under the site's own base, a manifest
 * and a worker that belong to it, downloads that are plain files, and nothing
 * asked of a host that only has the files it was given.
 */

test.describe('the published site', () => {
  test('opens under its path and asks for nothing the host does not have', async ({ page, site }) => {
    const failed = failures(page);
    const list = page.waitForResponse((r) => r.url() === `${site}api/translations.json`);
    await open(page, site);
    // The library refreshes its list from the site's own file.
    expect((await list).status()).toBe(200);
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    expect(failed).toEqual([]);
  });

  test('its manifest, icons and service worker belong to the path', async ({ page, site }) => {
    const path = new URL(site).pathname;
    await open(page, site);

    const manifestUrl = new URL((await page.locator('link[rel="manifest"]').getAttribute('href'))!, site);
    expect(manifestUrl.pathname.startsWith(path)).toBe(true);
    const manifest = await (await page.request.get(manifestUrl.href)).json();
    // A start_url of "/" would open the account's root site from the home screen.
    expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(path);
    expect(new URL(manifest.scope, manifestUrl).pathname).toBe(path);
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await page.request.get(new URL(icon.src, manifestUrl).href)).status(), icon.src).toBe(200);
    }

    const favicon = new URL((await page.locator('link[rel="icon"]').getAttribute('href'))!, site);
    expect(favicon.pathname.startsWith(path)).toBe(true);
    expect((await page.request.get(favicon.href)).status()).toBe(200);

    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe(path);
  });

  test('a preview asks search engines to leave it out', async ({ page, site }) => {
    await open(page, site);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /\bnoindex\b/);
  });
});

test.describe('a Spanish reader on the published site', () => {
  test.use({ locale: 'es-MX' });

  test('downloads a Bible from the site’s own files, and reads it offline', async ({ page, context, site }) => {
    const failed = failures(page);
    await open(page, site);
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 });

    const download = page.waitForResponse((r) => r.url().endsWith('/translations/rv1909/full.json'));
    await page.getByTestId('offer-get-rv1909').click();
    const response = await download;
    expect(response.status()).toBe(200);
    expect(response.url()).toBe(`${site}api/translations/rv1909/full.json`);
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1', { timeout: 60_000 });
    expect(failed).toEqual([]);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1', { timeout: 30_000 });
    await expect(page.getByTestId('chapter')).toContainText('el principio era el Verbo');
    await context.setOffline(false);
  });
});
