import { expect, test } from '@playwright/test';

/**
 * Search on a phone, with the keyboard up.
 *
 * Playwright cannot show a software keyboard, so the keyboard is simulated
 * the way the app itself sees it: `--vvh` (the visual viewport height, from
 * lib/viewport.ts) set to what remains above the keys. The suggestions used to
 * be 60vh of the *layout* viewport and to exist only while the input had focus
 * — on a phone that meant results behind the keyboard, and dismissing the
 * keyboard dismissed them too.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test('the suggestions fit above the keyboard and every row is a finger-sized target', async ({ page }) => {
  await open(page);
  // A keyboard taking the lower half of an 839px screen.
  await page.addStyleTag({ content: ':root { --vvh: 420px !important; }' });
  await page.getByTestId('search-input').tap();
  await page.getByTestId('search-input').fill('love');
  await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'love');

  // Whatever sits above the pane (the storage notice shows on a first visit)
  // pushes the panel down; its room is measured from the top of the screen.
  const panel = (await page.getByTestId('search-panel').boundingBox())!;
  expect(panel.y + panel.height).toBeLessThanOrEqual(420 + 1);
  // And it is not squeezed to nothing: several suggestions still show.
  expect(panel.height).toBeGreaterThan(120);

  const row = (await page.locator('.search__ref').first().boundingBox())!;
  expect(row.height).toBeGreaterThanOrEqual(44);
  const insert = (await page.locator('.search__insert').first().boundingBox())!;
  expect(insert.width).toBeGreaterThanOrEqual(44);
  expect(insert.height).toBeGreaterThanOrEqual(44);
});

test('a tap on a suggestion opens the passage', async ({ page }) => {
  await open(page);
  await page.getByTestId('search-input').fill('In the beginning God created');
  const first = page.getByTestId('search-panel').locator('.search__ref').first();
  await expect(first).toContainText('Genesis 1:1');
  await first.tap();
  await expect(page.getByTestId('chapter-title')).toContainText('Genesis 1');
});

test('the keyboard\'s Go key on a text query opens every match', async ({ page }) => {
  await open(page);
  await page.getByTestId('search-input').fill('living water');
  await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'living water');
  await page.getByTestId('search-input').press('Enter');
  await expect(page.getByTestId('search-results')).toBeVisible();
});
