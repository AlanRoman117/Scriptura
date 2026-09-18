import { devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';
import { describeSmall, tooSmall } from '../helpers/targets';
import { expect, open, test } from './fixture';

/**
 * The preview says what it is and where a correction goes.
 *
 * In every interface language, since the people it is for read those
 * languages; within the same gates as every other screen; and with the link
 * still in Help once the notice has been put away.
 */

const WORDS = {
  'en-US': {
    label: 'Preview',
    report: 'Report a translation correction on GitHub (opens in a new tab)',
    short: 'Report a correction',
    name: 'Report a correction (on GitHub, opens in a new tab)',
    heading: 'About this preview',
    form: 'translation-en.yml',
  },
  'es-MX': {
    label: 'Versión preliminar',
    report: 'Reportar una corrección de traducción en GitHub (se abre en una pestaña nueva)',
    short: 'Reportar una corrección',
    name: 'Reportar una corrección (en GitHub, se abre en una pestaña nueva)',
    heading: 'Acerca de esta versión preliminar',
    form: 'translation-es.yml',
  },
  'fr-FR': {
    label: 'Préversion',
    report: 'Signaler une correction de traduction sur GitHub (s’ouvre dans un nouvel onglet)',
    short: 'Signaler une correction',
    name: 'Signaler une correction (sur GitHub, s’ouvre dans un nouvel onglet)',
    heading: 'À propos de cette préversion',
    form: 'translation-fr.yml',
  },
  'ja-JP': {
    label: 'プレビュー版',
    report: 'GitHubで翻訳の修正を報告する（新しいタブで開きます）',
    short: '修正を報告する',
    name: '修正を報告する （GitHub、新しいタブで開きます）',
    heading: 'このプレビュー版について',
    form: 'translation-ja.yml',
  },
  'pt-BR': {
    label: 'Versão prévia',
    report: 'Relatar uma correção de tradução no GitHub (abre em uma nova aba)',
    short: 'Relatar uma correção',
    name: 'Relatar uma correção (no GitHub, abre em uma nova aba)',
    heading: 'Sobre esta versão prévia',
    form: 'translation-pt.yml',
  },
  'zh-Hans': {
    label: '预览版',
    report: '在 GitHub 上报告翻译问题（在新标签页中打开）',
    short: '报告翻译问题',
    name: '报告翻译问题 （在 GitHub 上，会在新标签页中打开）',
    heading: '关于这个预览版',
    form: 'translation-zh-hans.yml',
  },
  'zh-Hant': {
    label: '預覽版',
    report: '在 GitHub 上回報翻譯問題（會在新分頁中開啟）',
    short: '回報翻譯問題',
    name: '回報翻譯問題 （在 GitHub 上，會在新分頁中開啟）',
    heading: '關於這個預覽版',
    form: 'translation-zh-hant.yml',
  },
} as const;

/** The query a correction link carries. */
async function linkQuery(page: Page, testId: string): Promise<URLSearchParams> {
  const href = await page.getByTestId(testId).getAttribute('href');
  return new URL(href ?? '').searchParams;
}

/** A version the build script wrote: "0.1.0 (abc1234)" or "0.1.0-preview.1 (abc1234)". */
const VERSION = /^\d+\.\d+\.\d+\S* \([0-9a-f]{7,}\)$/;

for (const [locale, words] of Object.entries(WORDS)) {
  test.describe(`the preview, in ${locale}`, () => {
    test.use({ locale });

    test('says what it is, and links to the correction form for this language and build', async ({ page, site }) => {
      await open(page, site);
      await expect(page.getByRole('complementary', { name: words.label })).toBeVisible();

      const link = page.getByTestId('preview-feedback');
      // It shows short words and an arrow; its name starts with those words
      // and says where it goes and that a new tab opens (2.5.3, 2.4.9, 3.2.5).
      await expect(link).toContainText(words.short);
      await expect(link).toContainText('↗');
      await expect(link).toHaveAccessibleName(words.name);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
      const query = await linkQuery(page, 'preview-feedback');
      expect(query.get('template')).toBe(words.form);
      expect(query.get('language')).toBe(locale);
      expect(query.get('version')).toMatch(VERSION);
    });

    test('passes axe with the notice showing, and with its Help section open', async ({ page, site }) => {
      await open(page, site);
      await expect(page.getByTestId('preview-notice')).toBeVisible();
      const reading = await axeFor(page).analyze();
      expect(reading.violations.length, describeViolations(reading)).toBe(0);

      await page.getByTestId('help-open').click();
      const section = page.getByTestId('help-preview');
      await expect(section.getByRole('heading', { level: 2 })).toHaveText(words.heading);
      await expect(page.getByTestId('help-feedback')).toHaveText(words.report);
      const help = await axeFor(page).analyze();
      expect(help.violations.length, describeViolations(help)).toBe(0);
    });
  });
}

test.describe('putting the preview notice away', () => {
  test('is remembered, moves focus on, and leaves the link in Help', async ({ page, site }) => {
    await open(page, site);
    await page.getByTestId('preview-hide').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('preview-notice')).toHaveCount(0);
    // Focus goes on to what came next, not back to the top of the page (2.4.3).
    await expect
      .poll(() => page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null))
      .toBe(true);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('preview-notice')).toHaveCount(0);

    await page.getByTestId('help-open').click();
    expect((await linkQuery(page, 'help-feedback')).get('template')).toBe('translation-en.yml');
    await expect(page.getByTestId('help-preview')).toContainText(/Version: \d+\.\d+\.\d+/);
  });

  test('a newer preview shows the notice again', async ({ page, site }) => {
    await page.addInitScript(() => localStorage.setItem('scriptura-preview-hidden', '0.0.1 (0000000)'));
    await open(page, site);
    await expect(page.getByTestId('preview-notice')).toBeVisible();
  });
});

test('every pointer target is 44 × 44 or larger, with the notice and in Help', async ({ page, site }) => {
  await open(page, site);
  await expect(page.getByTestId('preview-notice')).toBeVisible();
  const reading = await tooSmall(page);
  expect(reading, describeSmall(reading)).toEqual([]);

  await page.getByTestId('help-open').click();
  await expect(page.getByTestId('help-preview')).toBeVisible();
  const help = await tooSmall(page);
  expect(help, describeSmall(help)).toEqual([]);
});

// A browser type cannot be set inside a describe; Pixel 7 is Chromium anyway.
const { defaultBrowserType: _chromium, ...pixel7 } = devices['Pixel 7'];

/** Horizontal overflow of the page, the notices and the panes, in px. */
const sideways = (page: Page) =>
  page.evaluate(() =>
    [document.documentElement, ...Array.from(document.querySelectorAll('.preview-notice, .durability, .pane'))]
      .filter((el) => el.scrollWidth - el.clientWidth > 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} overflows by ${el.scrollWidth - el.clientWidth}px`)
  );

for (const locale of Object.keys(WORDS)) {
  test.describe(`on a phone, in ${locale}`, () => {
    test.use({ ...pixel7, locale });

    test('the notice keeps its controls on one line, fits 320 CSS px, and every target is 44px', async ({ page, site }) => {
      await open(page, site);
      // At the phone's own width the link and Hide share a line, so the
      // notice costs the reading view as little height as it can.
      const top = async (id: string) => (await page.getByTestId(id).boundingBox())?.y;
      expect(await top('preview-feedback')).toBeCloseTo((await top('preview-hide'))!, -1);

      await page.setViewportSize({ width: 320, height: 640 });
      await expect(page.getByTestId('preview-notice')).toBeVisible();
      expect(await sideways(page)).toEqual([]);
      const small = await tooSmall(page);
      expect(small, describeSmall(small)).toEqual([]);
    });
  });
}
