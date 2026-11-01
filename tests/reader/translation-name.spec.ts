import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Which Bible is open, for someone who does not know the letters.
 *
 * From a tester: nothing said what the letters meant, or that the button
 * changes them. The button now has the arrow its neighbours, book and chapter,
 * have; the full name stands under the title.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function get(page: Page, id: string) {
  await page.getByTestId('library-open').click();
  await page.getByTestId(`library-get-${id}`).click();
  await expect(page.getByTestId(`library-read-${id}`)).toBeVisible({ timeout: 60_000 });
}

const name = (page: Page) => page.getByTestId('chapter-translation');

test.describe('which Bible is open', () => {
  test('the chapter names it in full', async ({ page }) => {
    await open(page);
    await expect(name(page)).toHaveText('King James Version');
    await expect(name(page)).toHaveAttribute('lang', 'en');
  });

  test('another Bible brings its own name, in its own language', async ({ page }) => {
    await open(page);
    await get(page, 'rv1909');
    await page.getByTestId('library-read-rv1909').click();
    await expect(name(page)).toHaveText('Reina Valera 1909');
    await expect(name(page)).toHaveAttribute('lang', 'es');
    await expect(page.getByTestId('library-open')).toHaveText('RV1909');
  });

  test('the button has an arrow that turns as its list opens, and its name is unchanged', async ({ page }) => {
    await open(page);
    const button = page.getByTestId('library-open');
    await expect(button.locator('svg[data-icon="chevron-down"]')).toBeVisible();
    await expect(button).toHaveText('KJV');
    await expect(button).toHaveAccessibleName('KJV — King James Version. Choose or add a translation');
    await button.click();
    await expect(button.locator('svg[data-icon="chevron-up"]')).toBeVisible();
  });

  test('a comparison leaves it to its columns, and it is back afterwards', async ({ page }) => {
    await open(page);
    await get(page, 'rv1909');
    await page.getByTestId('library-compare-rv1909').click();
    await expect(page.getByTestId('compare-drop-rv1909')).toBeVisible({ timeout: 30_000 });
    await expect(name(page)).toHaveCount(0);
    await page.getByTestId('compare-drop-rv1909').click();
    await expect(name(page)).toHaveText('King James Version');
  });

  test('it leaves with the text: the pinned strip keeps its size', async ({ page }) => {
    await open(page);
    await expect(page.locator('.chapter__head .chapter__translation')).toHaveCount(0);
    await expect(name(page)).toBeInViewport();
    await page.getByTestId('pane-bible').evaluate((el) => el.scrollTo(0, 900));
    await expect(name(page)).not.toBeInViewport();
    await expect(page.getByTestId('chapter-title')).toBeInViewport();
  });
});

test.describe('a device that was reading the old default', () => {
  /** A device as the update finds it: the BSB stored, and no stored choice. */
  async function asBefore(page: Page) {
    await open(page);
    await get(page, 'bsb');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const opened = indexedDB.open('scriptura');
          opened.onerror = () => reject(opened.error);
          opened.onsuccess = () => {
            const db = opened.result;
            const tx = db.transaction(['translations', 'settings'], 'readwrite');
            tx.objectStore('settings').delete('reading');
            tx.objectStore('translations').delete('kjv');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        })
    );
  }

  test('stays on it', async ({ page }) => {
    await asBefore(page);
    await page.reload();
    await expect(name(page)).toHaveText('Berean Standard Bible', { timeout: 30_000 });
    await expect(page.getByTestId('library-open')).toHaveText('BSB');
  });

  test('offline, it reads what it holds rather than failing on a default it never stored', async ({ page, context }) => {
    await asBefore(page);
    // The service worker must have the app, or the reload itself is what fails.
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 });
    await context.setOffline(true);
    await page.reload();
    await expect(name(page)).toHaveText('Berean Standard Bible', { timeout: 30_000 });
  });
});
