import { expect, test } from '@playwright/test';

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
