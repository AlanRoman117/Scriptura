import { expect, test } from '@playwright/test';

/**
 * The reader on a phone, with a finger.
 *
 * This project is Chromium's Pixel 7 emulation: `hasTouch`, `isMobile`, a
 * coarse pointer and no hover. Every `(hover: none)` and `(pointer: coarse)`
 * rule in styles.css is only reachable from here — Desktop Chrome never
 * matches them — and `.tap()` dispatches real touch events rather than a
 * mouse click, which is the difference the whole project exists to test.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test('boots into the narrow layout with a coarse pointer and no hover', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('layout')).toHaveAttribute('data-mode', 'narrow');

  const media = await page.evaluate(() => ({
    coarse: matchMedia('(pointer: coarse)').matches,
    noHover: matchMedia('(hover: none)').matches,
    touchPoints: navigator.maxTouchPoints,
  }));
  expect(media.coarse).toBe(true);
  expect(media.noHover).toBe(true);
  expect(media.touchPoints).toBeGreaterThan(0);
});

test('a tap, not a click, opens the notes sheet', async ({ page }) => {
  await open(page);
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');

  await page.getByRole('button', { name: /expand notes/i }).tap();
  await expect(sheet).toHaveAttribute('data-sheet', 'half');

  // The text stays on screen while the sheet is open — the reason it is a
  // sheet and not a tab.
  await expect(page.getByTestId('chapter')).toBeVisible();
});

test('publishes the visual viewport and never scrolls sideways', async ({ page }) => {
  await open(page);
  const shell = await page.evaluate(() => ({
    vvh: document.documentElement.style.getPropertyValue('--vvh'),
    inner: window.innerHeight,
    meta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    paneOverflow: (() => {
      const pane = document.querySelector('.pane--bible') as HTMLElement;
      return pane.scrollWidth - pane.clientWidth;
    })(),
  }));
  // At rest, with no keyboard, the visual viewport is the whole window.
  expect(shell.vvh).toBe(`${shell.inner}px`);
  // Android Chrome shrinks the layout viewport for the keyboard when asked.
  expect(shell.meta).toContain('interactive-widget=resizes-content');
  // Reflow (1.4.10): the page and the reading pane fit the phone's width.
  expect(shell.docOverflow).toBeLessThanOrEqual(0);
  expect(shell.paneOverflow).toBeLessThanOrEqual(0);
});
