import { expect, test } from '@playwright/test';

/**
 * Narrow screens.
 *
 * A PWA is mostly a phone app, and two panes on a phone is neither. The Bible
 * takes the screen; notes become a sheet that can be pulled up — so the verse
 * stays visible while writing, which tabs would lose.
 */

test.use({ viewport: { width: 390, height: 844 } });

test('notes become a bottom sheet, and the Bible keeps the screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });

  await expect(page.getByTestId('layout')).toHaveAttribute('data-mode', 'narrow');

  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');

  const bible = (await page.getByTestId('pane-bible').boundingBox())!;
  expect(bible.width).toBeGreaterThan(380);

  const grip = page.getByRole('button', { name: /expand notes/i });
  await grip.click();
  await expect(sheet).toHaveAttribute('data-sheet', 'half');

  // Scripture is still on screen while the sheet is open — the reason for a
  // sheet rather than tabs.
  await expect(page.getByTestId('chapter')).toBeVisible();

  await grip.click();
  await expect(sheet).toHaveAttribute('data-sheet', 'full');
});

test('there is no divider to drag on a phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('divider')).toHaveCount(0);
});
