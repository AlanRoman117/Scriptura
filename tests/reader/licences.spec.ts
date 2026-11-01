import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';

/**
 * What a licence owes the reader, and what a public-domain Bible does not.
 *
 * Three cases that must not blur: a licensed text carries its credit and a link
 * to the licence; the King James, public domain everywhere but the UK, carries
 * one line of plain text; every other public-domain Bible shows no footer.
 */

const KJV_NOTICE =
  'Public domain outside the UK; in the UK, rights are vested in the Crown and administered by Cambridge University Press.';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function install(page: Page, id: string) {
  await page.getByTestId('library-open').click();
  await page.getByTestId(`library-get-${id}`).click();
  await expect(page.getByTestId(`library-read-${id}`)).toBeVisible({ timeout: 60_000 });
}

/** Install a translation and read it, waiting for its own name on the page. */
async function read(page: Page, id: string, name: string) {
  await install(page, id);
  await page.getByTestId(`library-read-${id}`).click();
  await expect(page.getByTestId('chapter-translation')).toHaveText(name);
}

async function noViolations(page: Page) {
  const results = await axeFor(page).analyze();
  expect(results.violations, describeViolations(results)).toEqual([]);
}

test.describe('the King James notice', () => {
  test('is the metadata’s words, as plain text with nothing to follow', async ({ page }) => {
    await open(page);
    const footer = page.getByTestId('translation-footer');
    await expect(footer).toHaveText(KJV_NOTICE);
    // A link would suggest that there is a permission to be had.
    await expect(footer.locator('a')).toHaveCount(0);
    await expect(page.getByTestId('attribution')).toHaveCount(0);
    // The interface is already English, so nothing needs marking.
    await expect(page.getByTestId('rights-notice')).not.toHaveAttribute('lang', /.*/);
  });

  test('goes while a panel covers the text', async ({ page }) => {
    await open(page);
    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('rights-notice')).toHaveCount(0);
  });

  test('stays English under another interface, marked as such (3.1.2)', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'ja-JP' });
    const page = await context.newPage();
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja-JP');
    const notice = page.getByTestId('rights-notice');
    await expect(notice).toHaveText(KJV_NOTICE);
    await expect(notice).toHaveAttribute('lang', 'en');
    await context.close();
  });

  test('reaches a reader whose stored copy predates it, and is written back', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('rights-notice')).toBeVisible();
    // A copy downloaded before the notice existed, with the old metadata.
    const edit = (drop: boolean) =>
      page.evaluate(
        (drop) =>
          new Promise<string | undefined>((resolve, reject) => {
            const req = indexedDB.open('scriptura');
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const store = req.result.transaction('translations', 'readwrite').objectStore('translations');
              const got = store.get('kjv');
              got.onsuccess = () => {
                const notice = got.result.rights_notice as string | undefined;
                if (!drop) return resolve(notice);
                delete got.result.rights_notice;
                store.put(got.result, 'kjv').onsuccess = () => resolve(undefined);
              };
            };
          }),
        drop
      );
    await edit(true);
    await page.reload();
    await expect(page.getByTestId('rights-notice')).toHaveText(KJV_NOTICE);
    await expect.poll(() => edit(false)).toBe(KJV_NOTICE);
  });

  for (const [state, media] of [
    ['light', { colorScheme: 'light' }],
    ['dark', { colorScheme: 'dark' }],
    ['forced colours', { forcedColors: 'active' }],
  ] as const) {
    test(`passes axe in ${state}, where it can be read`, async ({ page }) => {
      await page.emulateMedia(media);
      await open(page);
      await page.getByTestId('rights-notice').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('rights-notice')).toBeInViewport();
      await noViolations(page);
    });
  }
});

test('a plain public-domain Bible shows no footer at all', async ({ page }) => {
  await open(page);
  await read(page, 'asv', 'American Standard Version');
  await expect(page.locator('.attribution')).toHaveCount(0);
  await expect(page.getByTestId('rights-notice')).toHaveCount(0);
});

test.describe('a licensed Bible', () => {
  test('VBL names its holders and changes, and links to its licence', async ({ page }) => {
    await open(page);
    await read(page, 'vbl', 'Versión Biblia Libre');
    const footer = page.getByTestId('attribution');
    await expect(footer).toContainText('v5.2 (Oct 2025) © Jonathan Gallagher, Shelly Barrios de Avila');
    await expect(footer).toContainText('not endorsed by the licensor');
    // The name starts with the visible words, and says how it opens.
    const licence = footer.getByRole('link', { name: 'Versión Biblia Libre licence (opens in a new tab)' });
    await expect(licence).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
    await expect(licence).toHaveAttribute('target', '_blank');
    await expect(footer.getByRole('link', { name: 'Versión Biblia Libre source (opens in a new tab)' })).toHaveCount(1);
    // The words are mostly English under a Spanish name; the links are the interface's.
    await expect(footer.locator('span[lang="en"]')).toContainText('Scriptura omits footnotes');
    await expect(licence.locator('xpath=ancestor-or-self::*[@lang][1]')).toHaveAttribute('lang', 'en-US');
    await noViolations(page);
  });

  test('Bíblia Livre is CC BY 3.0 Brasil, as its authors say', async ({ page }) => {
    await open(page);
    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-blivre')).toContainText('CC BY 3.0 Brasil');
    await page.getByTestId('library-open').click();

    await read(page, 'blivre', 'Bíblia Livre');
    const footer = page.getByTestId('attribution');
    await expect(footer).toContainText('Licença CC BY 3.0 Brasil');
    await expect(footer).toContainText('166 citações incorporadas aos versículos');
    await expect(footer.locator('span[lang="pt-BR"]')).toContainText('Modificado pela Scriptura');
    await expect(footer.getByRole('link', { name: /^Bíblia Livre licence/ })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/3.0/br/'
    );
    await expect(footer.getByRole('link', { name: /^Bíblia Livre source/ })).toHaveAttribute(
      'href',
      'https://sites.google.com/site/biblialivre/'
    );
  });

  test('its stored copy’s old words give way to the catalogue’s', async ({ page }) => {
    await open(page);
    await read(page, 'blivre', 'Bíblia Livre');
    await expect(page.getByTestId('attribution').getByRole('link', { name: /licence/ })).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('scriptura');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const store = req.result.transaction('translations', 'readwrite').objectStore('translations');
            const got = store.get('blivre');
            got.onsuccess = () => {
              Object.assign(got.result, { license: 'cc-by-4.0', attribution: 'Bíblia Livre — CC BY 4.0' });
              delete got.result.license_url;
              store.put(got.result, 'blivre').onsuccess = () => resolve();
            };
          };
        })
    );
    await page.reload();
    const footer = page.getByTestId('attribution');
    await expect(footer).toContainText('CC BY 3.0 Brasil');
    await expect(footer).not.toContainText('CC BY 4.0');
    await expect(footer.getByRole('link', { name: /licence/ })).toBeVisible();
  });
});

test.describe('in a comparison', () => {
  test('each Bible’s credit and notice appear once, each named', async ({ page }) => {
    await open(page);
    await install(page, 'vbl');
    await page.getByTestId('library-compare-vbl').click();
    await expect(page.getByTestId('compare')).toBeVisible();

    const footer = page.getByTestId('compare-attribution');
    await expect(footer.getByRole('link', { name: /^Versión Biblia Libre licence/ })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/'
    );
    await expect(page.getByTestId('compare-rights-kjv')).toHaveText(`King James Version · ${KJV_NOTICE}`);
    await expect(page.getByTestId('compare-rights-kjv').locator('a')).toHaveCount(0);
    // The pane's own footer steps aside rather than saying it all again.
    await expect(page.locator('.attribution')).toHaveCount(1);
    await noViolations(page);
  });

  test('two plain public-domain Bibles show no footer', async ({ page }) => {
    await open(page);
    await read(page, 'asv', 'American Standard Version');
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-ylt').click();
    await expect(page.getByTestId('library-compare-ylt')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('library-compare-ylt').click();
    await expect(page.getByTestId('compare')).toBeVisible();
    await expect(page.locator('.attribution')).toHaveCount(0);
  });
});
