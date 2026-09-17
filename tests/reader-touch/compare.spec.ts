import { expect, test } from '@playwright/test';

/**
 * Comparing translations on a phone.
 *
 * A table of two or three columns does not fit 412px; it scrolled sideways,
 * which meant reading one translation at a time and losing the verse number
 * off the left edge (1.4.10). On a narrow pane the same rows are a list:
 * each verse, then each translation under its name, still aligned on the verse
 * number rather than the position in the list.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test('a comparison is a list of verses, each with every translation, and nothing scrolls sideways', async ({ page }) => {
  await open(page);
  await page.getByTestId('library-open').tap();
  await page.getByTestId('library-get-rv1909').tap();
  await expect(page.getByTestId('library-read-rv1909')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('library-compare-rv1909').tap();

  const compare = page.getByTestId('compare');
  await expect(compare).toHaveAttribute('data-layout', 'stack');
  const stack = page.getByTestId('compare-stack');
  await expect(stack).toBeVisible();

  const first = stack.locator('li').first();
  await expect(first).toHaveAttribute('data-verse', '1');
  await expect(first).toContainText('In the beginning was the Word');
  await expect(first).toContainText('el principio era el Verbo');
  // Each translation's words in its own language.
  await expect(first.locator('.compare__text').nth(1)).toHaveAttribute('lang', 'es');

  const overflow = await page.getByTestId('pane-bible').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  for (const button of await first.locator('button').all()) {
    const box = (await button.boundingBox())!;
    expect.soft(box.width).toBeGreaterThanOrEqual(44);
    expect.soft(box.height).toBeGreaterThanOrEqual(44);
  }

  // Dropping the second translation ends the comparison.
  await page.getByTestId('compare-drop-rv1909').tap();
  await expect(compare).toHaveCount(0);
});
