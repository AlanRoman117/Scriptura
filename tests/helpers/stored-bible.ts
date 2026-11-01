import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { FixtureBible } from './chinese-bible';

/**
 * Put a Bible on the device as an earlier visit would have left it.
 *
 * The only way to hold a translation the catalog no longer lists is to have
 * downloaded it before it left, so it is written straight to IndexedDB. The app
 * must have opened once for the database to exist; `reload` afterwards so that
 * what is stored decides how it opens.
 */
export async function storeBible(page: Page, bible: FixtureBible, reading?: { active?: string; compareWith?: string[] }) {
  await page.evaluate(
    ([full, prefs]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('scriptura');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(['translations', 'settings'], 'readwrite');
          tx.objectStore('translations').put(full, (full as { id: string }).id);
          if (prefs) tx.objectStore('settings').put(prefs, 'reading');
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [bible, reading] as const
  );
}

/** Which translations the device holds, read from the database itself. */
export const storedIds = (page: Page): Promise<string[]> =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('scriptura');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('translations').objectStore('translations').getAllKeys();
          req.onsuccess = () => {
            open.result.close();
            resolve(req.result.map(String));
          };
          req.onerror = () => reject(req.error);
        };
      })
  );

/** Open the app, store the Bible and come back to it, as a returning reader does. */
export async function returnWith(page: Page, bible: FixtureBible, reading?: { active?: string; compareWith?: string[] }) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await storeBible(page, bible, reading);
  await page.reload();
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}
