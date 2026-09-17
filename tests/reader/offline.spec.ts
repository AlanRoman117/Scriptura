import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import { serveStatic, type StaticServer } from '../helpers/static-server';

/**
 * The offline promise.
 *
 * "Instant load and offline reliability" is the first line of the design spec.
 * A reader that needs the network to show a verse it already downloaded has
 * failed at the thing it exists for.
 */

test('reads scripture with the network cut', async ({ page, context }) => {
  // First visit: service worker installs, translation lands in IndexedDB.
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
    timeout: 30_000,
  });

  // The translation must be in IndexedDB, not merely in memory.
  const cached = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('scriptura');
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('translations').objectStore('translations').getAllKeys();
          req.onsuccess = () => resolve(req.result.includes('bsb'));
          req.onerror = () => resolve(false);
        };
        open.onerror = () => resolve(false);
      })
  );
  expect(cached).toBe(true);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('chapter')).toContainText('In the beginning was the Word');

  // And navigation still works offline — the whole book is local.
  await page.getByTestId('book-select').selectOption('genesis');
  await expect(page.getByTestId('chapter')).toContainText('In the beginning God created');

  await context.setOffline(false);
});

test.describe('a new version waits for the reader (2.2.4, 3.2.5)', () => {
  /**
   * A real update, not a stub.
   *
   * Playwright's request routing never sees the browser's own check for a
   * newer service worker, so the update cannot be faked on the shared preview
   * server — and changing the built file there would hand every test running
   * in parallel an update it did not ask for. Instead this suite serves the
   * built app from a small server of its own, on its own origin, and changes
   * only what that server says `sw.js` is. The browser finds a byte-different
   * worker, installs it, and — because the app no longer lets a new worker
   * take the page by itself — leaves it waiting for the reader.
   */
  let server: StaticServer;
  let origin = '';
  let swSuffix = '';

  test.beforeAll(async ({}, testInfo) => {
    server = await serveStatic({
      // Resolved from the project's test directory: these specs are compiled as
      // CommonJS, where import.meta does not exist, and __dirname would break
      // the day the root package becomes ESM.
      root: join(testInfo.project.testDir, '..', '..', 'apps', 'reader', 'dist'),
      // The app is a single page; anything that is not a file is the app.
      // /api is not served here, and the reader reads its bundled text.
      fallback: 'index',
      alwaysMissing: (path) => path.startsWith('/api/'),
      transform: (path, body) => (path === '/sw.js' ? `${body.toString('utf8')}${swSuffix}` : body),
    });
    origin = server.origin;
  });

  test.afterAll(() => server.close());

  test.beforeEach(() => {
    swSuffix = '';
  });

  async function newVersionArrives(page: Page) {
    await page.goto(`${origin}/`);
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 });

    swSuffix = `\n// a newer build, ${Date.now()}\n`;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    await expect(page.getByTestId('update-notice')).toBeVisible({ timeout: 30_000 });
  }

  test('the app is not reloaded under the reader; Later puts the notice away', async ({ page }) => {
    await newVersionArrives(page);
    // A marker on the window: had the page reloaded by itself, it would be gone.
    await page.evaluate(() => ((window as unknown as { __stillHere: boolean }).__stillHere = true));
    await expect(page.getByTestId('announcer')).toContainText(/new version/i);
    await page.waitForTimeout(1_000);
    expect(await page.evaluate(() => (window as unknown as { __stillHere?: boolean }).__stillHere)).toBe(true);
    // A worker is waiting, not controlling.
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);

    const reload = (await page.getByTestId('update-reload').boundingBox())!;
    expect(reload.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId('update-later').click();
    await expect(page.getByTestId('update-notice')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __stillHere?: boolean }).__stillHere)).toBe(true);
  });

  test('Reload saves the words typed a moment ago, then switches versions', async ({ page }) => {
    await newVersionArrives(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').fill('Written just before the update.');
    await page.evaluate(() => ((window as unknown as { __before: boolean }).__before = true));
    // No wait for the autosave: Reload itself must write what is pending.
    await page.getByTestId('update-reload').click();

    await page.waitForFunction(() => !(window as unknown as { __before?: boolean }).__before, null, { timeout: 30_000 });
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('notes-surface')).toHaveValue('Written just before the update.');
    await expect(page.getByTestId('update-notice')).toHaveCount(0);
  });
});
