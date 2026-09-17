import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The interface language: which one a reader gets, and what a screen reader is
 * told about it.
 *
 * The page's `lang` is a BCP 47 tag from the IANA registry (`en-US`, `es-MX`,
 * `fr-FR`, `ja-JP`) and is set before the app runs, so the first thing read
 * is read in the right voice (3.1.1). The reader's choice wins; otherwise the
 * first of the browser's languages the app has; otherwise English.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

const lang = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('lang'));

/** Store display preferences before the page loads, the way the app itself stores them. */
async function preferLanguage(page: Page, language: string) {
  await page.addInitScript((value) => {
    localStorage.setItem('scriptura-display', JSON.stringify({ language: value }));
  }, language);
}

test.describe('before the app runs', () => {
  test.use({ locale: 'fr-CA' });

  test('the inline script alone sets lang, from the device', async ({ page }) => {
    // With the app's script blocked, only index.html's inline script can have
    // set this. A fr-CA browser gets the French interface we have.
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/');
    expect(await lang(page)).toBe('fr-FR');
  });

  test('and from a stored choice, which beats the device', async ({ page }) => {
    await preferLanguage(page, 'ja-JP');
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/');
    expect(await lang(page)).toBe('ja-JP');
  });
});

for (const [device, expected] of [
  ['en-US', 'en-US'],
  ['en-GB', 'en-US'],
  ['es-MX', 'es-MX'],
  ['es-AR', 'es-MX'],
  ['fr-FR', 'fr-FR'],
  ['ja-JP', 'ja-JP'],
  ['de-DE', 'en-US'],
  ['pt-BR', 'en-US'],
] as const) {
  test.describe(`a ${device} browser`, () => {
    test.use({ locale: device });

    test(`gets ${expected}`, async ({ page }) => {
      await open(page);
      expect(await lang(page)).toBe(expected);
    });
  });
}

test.describe('choosing a language', () => {
  test('the picker names each language in itself, in its own lang', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    const picker = page.getByTestId('pref-language');
    await expect(picker).toHaveValue('system');
    const options = await picker.locator('option').evaluateAll((all) =>
      all.map((o) => [(o as HTMLOptionElement).value, o.getAttribute('lang'), o.textContent])
    );
    expect(options).toEqual([
      ['system', null, 'Match this device'],
      ['en-US', 'en-US', 'English (United States)'],
      ['es-MX', 'es-MX', 'Español (México)'],
      ['fr-FR', 'fr-FR', 'Français (France)'],
      ['ja-JP', 'ja-JP', '日本語 (日本)'],
    ]);
  });

  test('a choice changes lang at once, and is kept across a reload', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-language').selectOption('ja-JP');
    expect(await lang(page)).toBe('ja-JP');

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    expect(await lang(page)).toBe('ja-JP');

    // And "Match this device" goes back to the browser's language.
    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-language').selectOption('system');
    expect(await lang(page)).toBe('en-US');
  });
});

test.describe('in Spanish (Mexico)', () => {
  test.use({ locale: 'es-MX' });

  test('a Spanish browser opens in Spanish, and says so to a screen reader', async ({ page }) => {
    await open(page);
    expect(await lang(page)).toBe('es-MX');
    // The passage keeps the open Bible's own book name: BSB is English.
    await expect(page).toHaveTitle('John 1 · BSB · Scriptura');
    await expect(page.getByTestId('marks-open')).toContainText('Marcas');
    await expect(page.getByTestId('search-input')).toHaveAttribute('placeholder', 'Busca, o ve a “John 3:16”');
    await expect(page.getByRole('main', { name: 'Escrituras' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Configuración/ })).toBeVisible();
  });

  test('panels, titles and announcements are Spanish', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Configuración');
    await expect(page).toHaveTitle('Configuración · Scriptura');
    await expect(page.getByTestId('announcer')).toHaveText('Se abrió Configuración');
    await expect(page.getByTestId('pref-language').locator('option').first()).toHaveText('Igual que este dispositivo');
  });

  test('switching to English changes the words and announces it in English', async ({ page }) => {
    await open(page);
    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-language').selectOption('en-US');
    expect(await lang(page)).toBe('en-US');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await expect(page.getByTestId('announcer')).toHaveText('The interface is now in English.');
    // The panel stayed open: changing the name alone announces nothing else.
    await expect(page.getByTestId('settings-panel')).toBeVisible();

    await page.getByTestId('pref-language').selectOption('es-MX');
    await expect(page.getByTestId('announcer')).toHaveText('La interfaz ahora está en español.');
  });

  test('a quote is confirmed in Spanish', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    await expect(page.getByTestId('note-done')).toHaveText('✓ Se citó John 1:1');
    await expect(page.getByTestId('announcer')).toHaveText('Se citó John 1:1 en una nota sin título');
    // Nothing English was stored: the untitled note reads as untitled in Spanish too.
    await expect(page.getByTestId('note-select').locator('option:checked')).toHaveText('Sin título');
    await expect(page.getByTestId('note-title')).toHaveAttribute('placeholder', 'Sin título');
  });
});
