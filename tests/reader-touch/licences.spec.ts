import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';

/** The licence words on a phone: readable, and no wider than the screen (1.4.10). */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

async function noViolations(page: Page) {
  const results = await axeFor(page).analyze();
  expect(results.violations, describeViolations(results)).toEqual([]);
}

const pageFits = (page: Page) =>
  page.evaluate(() => {
    const footer = document.querySelector('.attribution')!.getBoundingClientRect();
    return (
      document.documentElement.scrollWidth <= window.innerWidth &&
      footer.right <= window.innerWidth + 0.5
    );
  });

for (const [state, media] of [
  ['light', { colorScheme: 'light' }],
  ['dark', { colorScheme: 'dark' }],
  ['forced colours', { forcedColors: 'active' }],
] as const) {
  test(`the King James notice can be read on a phone in ${state}`, async ({ page }) => {
    await page.emulateMedia(media);
    await open(page);
    const notice = page.getByTestId('rights-notice');
    await notice.scrollIntoViewIfNeeded();
    await expect(notice).toBeInViewport();
    expect(await pageFits(page)).toBe(true);
    await noViolations(page);
  });
}

test('an attribution’s bare addresses still fit at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page);
  await page.getByTestId('library-open').click();
  await page.getByTestId('library-get-vbl').click();
  await expect(page.getByTestId('library-read-vbl')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('library-read-vbl').click();

  const footer = page.getByTestId('attribution');
  await expect(footer).toContainText('https://creativecommons.org/licenses/by-sa/4.0/');
  await footer.getByRole('link', { name: /licence/ }).scrollIntoViewIfNeeded();
  await expect(footer.getByRole('link', { name: /licence/ })).toBeInViewport();
  expect(await pageFits(page)).toBe(true);
  await noViolations(page);
});
