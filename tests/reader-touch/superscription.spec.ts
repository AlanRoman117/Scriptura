import { expect, test, type Page } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';

/**
 * A Psalm's title on a phone: before verse 1 in the single column, and in the
 * stacked comparison as its own entry above the verses, listing only the
 * Bibles that have one. Nothing scrolls sideways for it.
 */

const TITLE = 'A Psalm by David, when he fled from Absalom his son.';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function install(page: Page, id: string) {
  await page.getByTestId('library-open').tap();
  await page.getByTestId(`library-get-${id}`).tap();
  await expect(page.getByTestId(`library-read-${id}`)).toBeVisible({ timeout: 60_000 });
}

async function toPsalm(page: Page, chapter: number) {
  await page.getByTestId('book-select').selectOption('psalms');
  await page.getByTestId('chapter-select').selectOption(String(chapter));
  await expect(page.getByTestId('chapter-title')).toContainText(`Psalms ${chapter}`);
}

test('reads before verse 1, and a tap on it selects nothing', async ({ page }) => {
  await open(page);
  await install(page, 'web');
  await page.getByTestId('library-read-web').tap();
  await expect(page.getByTestId('chapter-translation')).toHaveText('World English Bible');
  await toPsalm(page, 3);
  const title = page.getByTestId('chapter-superscription');
  await expect(title).toHaveText(TITLE);
  const [t, v1] = [(await title.boundingBox())!, (await page.locator('.verse[data-verse="1"]').boundingBox())!];
  expect(t.y + t.height).toBeLessThanOrEqual(v1.y + 1);
  await title.tap();
  await expect(page.getByTestId('verse-actions')).toHaveCount(0);
  const overflow = await page.getByTestId('pane-bible').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await axeFor(page).analyze();
  expect(results.violations, describeViolations(results)).toEqual([]);
});

test('in the stacked comparison, lists only the Bibles that have one, above the verses', async ({ page }) => {
  await open(page);
  await install(page, 'web');
  await page.getByTestId('library-compare-web').tap();
  const compare = page.getByTestId('compare');
  await expect(compare).toHaveAttribute('data-layout', 'stack');
  await toPsalm(page, 3);

  const entry = page.getByTestId('compare-superscriptions');
  await expect(entry).toBeVisible();
  // The King James has no title, so only the World English Bible is listed.
  await expect(entry.locator('.compare__reading')).toHaveCount(1);
  await expect(entry.locator('.compare__reading-id')).toContainText('WEB');
  const text = entry.locator('.compare__text');
  await expect(text).toHaveText(TITLE);
  await expect(text).toHaveAttribute('lang', 'en');
  await expect(entry.locator('button')).toHaveCount(0);
  await expect(entry).not.toHaveAttribute('data-verse', /.*/);

  const stack = page.getByTestId('compare-stack');
  const firstVerse = stack.locator('li[data-verse]').first();
  await expect(firstVerse).toHaveAttribute('data-verse', '1');
  const [e, v] = [(await entry.boundingBox())!, (await firstVerse.boundingBox())!];
  expect(e.y + e.height).toBeLessThanOrEqual(v.y + 1);
  await expect(stack.locator('li[data-verse]')).toHaveCount(8);

  const overflow = await page.getByTestId('pane-bible').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await axeFor(page).analyze();
  expect(results.violations, describeViolations(results)).toEqual([]);
});
