import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The pictures in docs/human-language-review — not a test.
 *
 * One cropped screenshot for each section of a reviewer's guide, in each
 * interface language, with a Bible in that language open: a reviewer reads
 * "Juan 1:3-5" where a Spanish reader would, not "John". Cropped to the part
 * of the page a section is about, so the words are their real size where
 * GitHub shows the guide. `npm run review:guide` runs this and then writes
 * the guides around the pictures (scripts/language-review.ts).
 */

/** Each interface language, the Bible a reader of it is offered first, and a word to search for in it. */
const LOCALES = {
  'en-US': { bible: null, other: 'kjv', word: 'light' },
  'es-MX': { bible: 'rv1909', other: 'bsb', word: 'luz' },
  'fr-FR': { bible: 'lsg1910', other: 'bsb', word: 'lumière' },
  'ja-JP': { bible: 'bungo', other: 'bsb', word: '光' },
  'pt-BR': { bible: 'blivre', other: 'bsb', word: 'luz' },
  'zh-Hans': { bible: 'cuvs', other: 'bsb', word: '光' },
  'zh-Hant': { bible: 'cuvt', other: 'bsb', word: '光' },
} as const;
type Locale = keyof typeof LOCALES;

const DESKTOP = { viewport: { width: 1160, height: 760 }, deviceScaleFactor: 1 };
// The phone's own settings, without the browser type a describe cannot change.
const PHONE = { ...(({ defaultBrowserType: _browser, ...phone }) => phone)(devices['Pixel 7']), deviceScaleFactor: 1.5 };

const text = (page: Page, n: number) => page.locator(`.verse[data-verse="${n}"] .verse__text`);

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** Take the offer of a Bible in the interface language, as a new reader would. */
async function readInLanguage(page: Page, locale: Locale) {
  const { bible } = LOCALES[locale];
  if (!bible) return;
  await page.getByTestId(`offer-get-${bible}`).click();
  await expect(page.getByTestId('library-open')).toHaveText(bible.toUpperCase(), { timeout: 90_000 });
  await expect(page.getByTestId('bible-offer')).toHaveCount(0);
}

/** Everything has stopped moving: no transition is half way. */
const settled = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

for (const locale of Object.keys(LOCALES) as Locale[]) {
  const folder = (testDir: string) => {
    const dir = join(testDir, '..', '..', 'docs', 'human-language-review', 'img', locale);
    mkdirSync(dir, { recursive: true });
    return dir;
  };

  test.describe(`${locale} desktop`, () => {
    test.use({ ...DESKTOP, locale });

    /** A picture of one element, or of the box around several. */
    const shoot = async (page: Page, dir: string, name: string, selectors: string[], pad = 8) => {
      await settled(page);
      const boxes = [];
      for (const selector of selectors) {
        const box = await page.locator(selector).first().boundingBox();
        if (box) boxes.push(box);
      }
      const view = page.viewportSize()!;
      const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
      const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
      const right = Math.min(view.width, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
      const bottom = Math.min(view.height, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
      await page.screenshot({ path: join(dir, `${name}.png`), clip: { x, y, width: right - x, height: bottom - y } });
    };
    const BIBLE = '[data-testid="pane-bible"]';
    const SIDE = '[data-testid="pane-notes"]';

    test('first visit, verses, a note', async ({ page }, info) => {
      test.setTimeout(180_000);
      const dir = folder(info.project.testDir);
      await open(page);
      // What a new reader in this language sees first, the offer of a Bible in it included.
      await shoot(page, dir, '01-first-visit', [BIBLE], 0);
      await readInLanguage(page, locale);

      await text(page, 2).click();
      await shoot(page, dir, '02-one-verse', ['.chapter__head', '.verse[data-verse="4"]']);
      await page.keyboard.press('Escape');

      for (const n of [1, 2, 4]) await text(page, n).click();
      await expect(page.getByTestId('verse-fill')).toBeVisible();
      await shoot(page, dir, '03-several-verses', ['.chapter__head', '.verse[data-verse="5"]']);
      await page.keyboard.press('Escape');

      await page.getByTestId('note-new').click();
      for (const n of [3, 4, 5]) await text(page, n).click();
      await page.getByTestId('quote-3').click();
      await expect(page.getByTestId('note-done')).toBeVisible();
      await shoot(page, dir, '04-note', [SIDE], 0);

      await page.getByTestId('note-delete').click();
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();
      await shoot(page, dir, '13-delete-confirm', ['.confirm-dialog__box'], 16);
    });

    test('search and marks', async ({ page }, info) => {
      test.setTimeout(180_000);
      const dir = folder(info.project.testDir);
      const { word } = LOCALES[locale];
      await open(page);
      await readInLanguage(page, locale);
      await page.getByTestId('search-input').fill(word);
      await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', word);
      await shoot(page, dir, '05-search-suggestions', [BIBLE], 0);
      await page.getByTestId('search-input').press('Enter');
      await expect(page.getByTestId('search-results')).toBeVisible();
      await shoot(page, dir, '06-search-results', [BIBLE], 0);
      await page.getByTestId('search-input').fill('');

      await page.reload();
      await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
      for (const [n, colour] of [[1, 'amber'], [3, 'rose'], [4, 'rose']] as const) {
        await text(page, n).click();
        await page.getByTestId(`swatch-${colour}`).click();
        await expect(page.locator(`.verse[data-verse="${n}"]`)).toHaveAttribute('data-highlight', colour);
      }
      await page.getByTestId('marks-open').click();
      await shoot(page, dir, '07-marks', [BIBLE], 0);
    });

    test('translations, comparison, settings, help', async ({ page }, info) => {
      test.setTimeout(240_000);
      const dir = folder(info.project.testDir);
      const { other } = LOCALES[locale];
      await open(page);
      await readInLanguage(page, locale);
      await page.getByTestId('library-open').click();
      await shoot(page, dir, '08-translations', [BIBLE], 0);

      // Beside another translation: the bundled English one, or for English a second English one.
      if (locale === 'en-US') {
        await page.getByTestId(`library-get-${other}`).click();
        await expect(page.getByTestId(`library-read-${other}`)).toBeVisible({ timeout: 90_000 });
      }
      // Comparing closes the panel and shows the chapter side by side.
      await page.getByTestId(`library-compare-${other}`).click();
      await expect(page.getByTestId('chapter')).toBeVisible();
      await expect(page.getByTestId(`compare-drop-${other}`)).toBeVisible({ timeout: 30_000 });
      await shoot(page, dir, '09-comparison', [BIBLE], 0);

      await page.getByTestId('settings-open').click();
      await page.getByTestId('pane-bible').evaluate((el) => el.scrollTo(0, 0));
      await shoot(page, dir, '10-settings', [BIBLE], 0);
      await page.getByTestId('pane-bible').evaluate((el) => el.scrollTo(0, el.scrollHeight / 2 - el.clientHeight / 2));
      await shoot(page, dir, '10-settings-middle', [BIBLE], 0);
      await page.getByTestId('pane-bible').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await shoot(page, dir, '10-settings-end', [BIBLE], 0);
      await page.getByTestId('settings-open').click();

      await page.getByTestId('help-open').click();
      await shoot(page, dir, '11-help', [BIBLE], 0);
    });

    test('a board', async ({ page }, info) => {
      test.setTimeout(180_000);
      const dir = folder(info.project.testDir);
      await open(page);
      await readInLanguage(page, locale);
      for (const n of [1, 3]) {
        await text(page, n).click();
        await page.getByTestId(`canvas-${n}`).click();
      }
      await page.getByTestId('side-board').click();
      await expect(page.locator('.card')).toHaveCount(2);
      await page.getByTestId('board-connections').click();
      await shoot(page, dir, '12-board', [SIDE], 0);
    });
  });

  test.describe(`${locale} phone`, () => {
    test.use({ ...PHONE, locale });

    test('reading, several verses, a note', async ({ page }, info) => {
      test.setTimeout(180_000);
      const dir = folder(info.project.testDir);
      const whole = async (name: string) => {
        await settled(page);
        await page.screenshot({ path: join(dir, `${name}.png`) });
      };
      await open(page);
      await readInLanguage(page, locale);
      await whole('14-phone-reading');
      for (const n of [1, 2, 4]) await text(page, n).tap();
      await expect(page.getByTestId('verse-fill')).toBeVisible();
      await whole('15-phone-several-verses');
      await page.getByTestId('quote-1').tap();
      await expect(page.getByTestId('sheet-done')).toBeVisible();
      const grip = (await page.getByTestId('sheet-grip').boundingBox())!;
      await page.touchscreen.tap(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await expect(page.locator('[data-sheet]')).toHaveAttribute('data-sheet', 'half');
      await whole('16-phone-note');
    });
  });
}
