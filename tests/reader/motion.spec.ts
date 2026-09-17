import { expect, test } from '@playwright/test';

/**
 * Animation from interactions (2.3.3): the jump-to-verse flash and the smooth
 * scroll are the reader's only motion, and both must stand down when asked —
 * by the operating system or by the switch in Settings.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function jumpToPsalm(page: import('@playwright/test').Page) {
  await page.getByTestId('search-input').fill('Psalms 119:105');
  await expect(page.getByTestId('search-jump')).toContainText('Psalms 119:105');
  await page.getByTestId('search-jump').click();
  const verse = page.locator('.verse[data-verse="105"]');
  await expect(verse).toHaveClass(/verse--flash/);
  return verse;
}

const animation = (verse: import('@playwright/test').Locator) =>
  verse.evaluate((el) => getComputedStyle(el).animationName);

test('with no preference, the jumped-to verse flashes', async ({ page }) => {
  await open(page);
  const verse = await jumpToPsalm(page);
  expect(await animation(verse)).toBe('verse-flash');
});

test('the operating system asking for less motion is honoured', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const verse = await jumpToPsalm(page);
  expect(await animation(verse)).toBe('none');
  // Pointed out, not animated.
  expect(await verse.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
});

test('the switch in Settings is honoured without any system preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await page.getByTestId('settings-open').click();
  await page.getByTestId('pref-motion').selectOption('reduce');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.getByTestId('settings-close').click();

  const verse = await jumpToPsalm(page);
  expect(await animation(verse)).toBe('none');
});
