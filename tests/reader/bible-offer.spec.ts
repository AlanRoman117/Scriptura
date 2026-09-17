import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * A reader whose browser is in another language is offered a Bible in it.
 *
 * The bundled Bible is English, so a Spanish interface over English scripture
 * is only half the job. The offer lists every Bible in the interface language
 * with its size; nothing downloads until the reader presses, and "Not now" is
 * remembered for that language.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test.describe('a Spanish browser', () => {
  test.use({ locale: 'es-MX' });

  test('is offered both Spanish Bibles, and one press downloads and opens one', async ({ page }) => {
    await open(page);
    const offer = page.getByTestId('bible-offer');
    await expect(offer).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Biblias en español' })).toBeVisible();
    await expect(offer.getByTestId('offer-rv1909')).toContainText('Reina Valera 1909');
    await expect(offer.getByTestId('offer-vbl')).toContainText('Versión Biblia Libre');
    await expect(offer.locator('li')).toHaveCount(2);
    // Its size is shown before anything is fetched.
    await expect(offer.getByTestId('offer-rv1909')).toContainText('MB');

    const get = page.getByRole('button', { name: 'Descargar y leer Reina Valera 1909' });
    await get.click();
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1', { timeout: 60_000 });
    await expect(page).toHaveTitle('Juan 1 · RV1909 · Scriptura');
    // A Spanish Bible is here now, so there is nothing left to offer.
    await expect(offer).toHaveCount(0);
  });

  test('"Not now" puts it away for Spanish, and a reload keeps it away', async ({ page }) => {
    await open(page);
    await page.getByTestId('offer-dismiss').click();
    await expect(page.getByTestId('bible-offer')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('bible-offer')).toHaveCount(0);

    // Only Spanish was put away: switching the interface to French offers French.
    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-language').selectOption('fr-FR');
    await page.getByTestId('settings-close').click();
    await expect(page.getByRole('complementary', { name: 'Bibles en français' })).toBeVisible();
  });

  test('"All translations" opens the library', async ({ page }) => {
    await open(page);
    await page.getByTestId('offer-library').click();
    await expect(page.getByTestId('library-panel')).toBeVisible();
    // A panel covers the chapter, and the offer goes with it.
    await expect(page.getByTestId('bible-offer')).toHaveCount(0);
  });

  test('offline, the failure is said on the Bible that failed', async ({ page, context }) => {
    await open(page);
    await context.setOffline(true);
    await page.getByTestId('offer-get-vbl').click();
    await expect(page.getByTestId('offer-error-vbl')).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('offer-error-vbl')).toContainText('Sin conexión');
    await expect(page.getByTestId('bible-offer')).toBeVisible();
  });
});

test.describe('a Japanese browser', () => {
  test.use({ locale: 'ja-JP' });

  test('is offered the Japanese Bible', async ({ page }) => {
    await open(page);
    const offer = page.getByTestId('bible-offer');
    await expect(page.getByRole('complementary', { name: '日本語の聖書' })).toBeVisible();
    await expect(offer.locator('li')).toHaveCount(1);
    await expect(offer.getByTestId('offer-bungo')).toBeVisible();
  });
});

test.describe('an English browser', () => {
  test('is offered nothing: the Bible it opens with is English', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('chapter-title')).toContainText('John 1');
    await expect(page.getByTestId('bible-offer')).toHaveCount(0);
  });
});
