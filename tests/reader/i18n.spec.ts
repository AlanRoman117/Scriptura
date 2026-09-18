import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The interface language: which one a reader gets, and what a screen reader is
 * told about it.
 *
 * The page's `lang` is a BCP 47 tag from the IANA registry (`en-US`, `es-MX`,
 * `fr-FR`, `ja-JP`, `pt-BR`, `zh-Hans`, `zh-Hant`) and is set before the app
 * runs, so the first thing read is read in the right voice (3.1.1). The
 * reader's choice wins; otherwise the first of the browser's languages the app
 * has; otherwise English. Chinese is chosen by script, so a Taiwanese browser
 * gets Traditional rather than whichever Chinese is listed first.
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
  ['pt-BR', 'pt-BR'],
  ['pt-PT', 'pt-BR'],
  ['zh-CN', 'zh-Hans'],
  ['zh-TW', 'zh-Hant'],
  ['zh-HK', 'zh-Hant'],
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
      ['pt-BR', 'pt-BR', 'Português (Brasil)'],
      ['zh-Hans', 'zh-Hans', '中文（简体）'],
      ['zh-Hant', 'zh-Hant', '中文（繁體）'],
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

test.describe('in French (France)', () => {
  test.use({ locale: 'fr-FR' });

  test('a French browser opens in French, with French spacing', async ({ page }) => {
    await open(page);
    expect(await lang(page)).toBe('fr-FR');
    await expect(page.getByTestId('marks-open')).toContainText('Marques');
    await page.getByTestId('settings-open').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paramètres');
    await expect(page.getByTestId('announcer')).toHaveText('Panneau Paramètres ouvert');
    // The question carries no-break spaces inside « » and a narrow one before ?.
    await page.getByTestId('settings-close').click();
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-delete').click();
    await expect(page.getByTestId('confirm-title')).toHaveText('Supprimer la note «\u00a0Sans titre\u00a0»\u202f?');
    await expect(page.getByTestId('confirm-accept')).toHaveText('Supprimer la note');
  });
});

test.describe('in Japanese (Japan)', () => {
  test.use({ locale: 'ja-JP' });

  test('a Japanese browser opens in Japanese, in Japanese type', async ({ page }) => {
    await open(page);
    expect(await lang(page)).toBe('ja-JP');
    await expect(page.getByTestId('marks-open')).toContainText('マーク');
    await page.getByTestId('settings-open').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('設定');
    await expect(page.getByTestId('announcer')).toHaveText('設定を開きました');

    const fonts = await page.evaluate(() => ({
      interface: getComputedStyle(document.body).fontFamily,
    }));
    expect(fonts.interface).toMatch(/Hiragino Sans/);
  });

  test('English scripture inside a Japanese page keeps its Latin type', async ({ page }) => {
    await open(page);
    const scripture = await page.locator('[lang="en"]').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(scripture).toMatch(/Iowan Old Style/);
    expect(scripture).not.toMatch(/Mincho/);
  });
});

test.describe('in Portuguese (Brazil)', () => {
  test.use({ locale: 'pt-BR' });

  test('a Brazilian browser opens in Portuguese, and counts as Brazil counts', async ({ page }) => {
    await open(page);
    expect(await lang(page)).toBe('pt-BR');
    await expect(page.getByTestId('marks-open')).toContainText('Marcas');
    await page.getByTestId('settings-open').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Configurações');
    await expect(page.getByTestId('announcer')).toHaveText('Painel Configurações aberto');
    await page.getByTestId('settings-close').click();
    // Brazilian Portuguese groups thousands with a full stop, not a comma.
    await page.getByTestId('search-input').fill('the');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'the');
    // The count is followed by how many are shown, so this anchors at the start.
    await expect(page.getByTestId('search-count')).toHaveText(/^\d{1,3}(\.\d{3})+ resultados/);
  });
});

/**
 * Chinese, in both scripts. They are separate texts, not a character
 * conversion, so each is checked for a word the other does not use.
 */
for (const [locale, words] of [
  ['zh-Hans', { marks: '标记', settings: '设置', opened: '已打开设置面板' }],
  ['zh-Hant', { marks: '標記', settings: '設定', opened: '已開啟設定面板' }],
] as const) {
  test.describe(`in ${locale}`, () => {
    test.use({ locale: locale === 'zh-Hans' ? 'zh-CN' : 'zh-TW' });

    test('opens in its own script, in Chinese type', async ({ page }) => {
      await open(page);
      expect(await lang(page)).toBe(locale);
      await expect(page.getByTestId('marks-open')).toContainText(words.marks);
      await page.getByTestId('settings-open').click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(words.settings);
      await expect(page.getByTestId('announcer')).toHaveText(words.opened);

      // The :lang() stack, and no slanted emphasis for Han characters.
      const face = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(face).toMatch(locale === 'zh-Hans' ? /PingFang SC/ : /PingFang TC/);
    });

    test('English scripture inside a Chinese page keeps its Latin type', async ({ page }) => {
      await open(page);
      const scripture = await page.locator('[lang="en"]').first().evaluate((el) => getComputedStyle(el).fontFamily);
      expect(scripture).toMatch(/Iowan Old Style/);
      expect(scripture).not.toMatch(/PingFang/);
    });
  });
}

test.describe('counts are grouped as each language groups them', () => {
  for (const [locale, pattern] of [
    ['en-US', /^\d{1,3}(,\d{3})+ matches for “the”$/],
    ['fr-FR', /^\d{1,3}( \d{3})+ résultats pour « the »$/],
  ] as const) {
    test(locale, async ({ page }) => {
      await page.addInitScript((language) => {
        localStorage.setItem('scriptura-display', JSON.stringify({ language }));
      }, locale);
      await open(page);
      await page.getByTestId('search-input').fill('the');
      await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'the');
      await page.getByTestId('search-input').press('Enter');
      await expect(page.getByTestId('search-results').getByRole('heading', { level: 1 })).toHaveText(pattern);
    });
  }
});
