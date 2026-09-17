import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * A board under fingers.
 *
 * Touch gestures are sent through the Chrome DevTools Protocol, because
 * `page.touchscreen` can only tap: one finger drags a card, two fingers pinch.
 * These are real touch events, which Chromium turns into pointer events — the
 * path the board's pointer capture and pinch tracking are written for.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** John 1:1 and 1:3 on a board, opened from the notes sheet. */
async function boardWithTwoVerses(page: Page) {
  for (const verse of [1, 3]) {
    await page.locator(`.verse[data-verse="${verse}"] .verse__text`).tap();
    await page.getByTestId(`canvas-${verse}`).tap();
  }
  await page.getByRole('button', { name: /expand notes/i }).tap();
  await page.getByTestId('canvas-open').tap();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(2);
}

type Touch = { x: number; y: number; id: number };

async function touches(page: Page, frames: Touch[][], pause = 16) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: frames[0] });
  for (const points of frames.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points });
    await page.waitForTimeout(pause);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const steps = (n: number, at: (t: number) => Touch[]) => Array.from({ length: n + 1 }, (_, i) => at(i / n));

test('a finger drags a card by its header', async ({ page }) => {
  await open(page);
  await boardWithTwoVerses(page);
  const card = page.locator('.card').first();
  const before = (await card.boundingBox())!;
  const grip = (await card.locator('.card__grip').boundingBox())!;
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };

  await touches(page, steps(12, (t) => [{ x: from.x + 60 * t, y: from.y + 140 * t, id: 1 }]));

  const after = (await card.boundingBox())!;
  expect(after.x - before.x).toBeGreaterThan(40);
  expect(after.y - before.y).toBeGreaterThan(100);
});

test('two fingers pinch to zoom, about where they touch', async ({ page }) => {
  await open(page);
  await boardWithTwoVerses(page);
  const frame = (await page.locator('.canvas__frame').boundingBox())!;
  const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  await expect(page.getByTestId('zoom-reset')).toHaveText('100%');

  // Spread from 60px apart to 120px apart: twice the distance, twice the zoom.
  await touches(
    page,
    steps(10, (t) => [
      { x: centre.x - 30 - 30 * t, y: centre.y, id: 1 },
      { x: centre.x + 30 + 30 * t, y: centre.y, id: 2 },
    ])
  );
  await expect(page.getByTestId('zoom-reset')).toHaveText('200%');

  // And pinching in zooms back out.
  await touches(
    page,
    steps(10, (t) => [
      { x: centre.x - 60 + 30 * t, y: centre.y, id: 1 },
      { x: centre.x + 60 - 30 * t, y: centre.y, id: 2 },
    ])
  );
  await expect(page.getByTestId('zoom-reset')).toHaveText('100%');
});

test('a second finger on a card being dragged turns the drag into a pinch', async ({ page }) => {
  await open(page);
  await boardWithTwoVerses(page);
  const card = page.locator('.card').first();
  const grip = (await card.locator('.card__grip').boundingBox())!;
  const a = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  const before = (await card.boundingBox())!;

  // Finger one lands on the card's header; finger two lands 100px below and
  // both spread apart vertically. The card must not be dragged by finger one.
  await touches(
    page,
    steps(10, (t) => [
      { x: a.x, y: a.y - 20 * t, id: 1 },
      { x: a.x, y: a.y + 100 + 20 * t, id: 2 },
    ])
  );
  await expect(page.getByTestId('zoom-reset')).not.toHaveText('100%');
  // Stored position unchanged: zooming moved it on screen, the board did not.
  const stored = await page.evaluate(
    () =>
      new Promise<{ x: number; y: number }[]>((resolve) => {
        const req = indexedDB.open('scriptura');
        req.onsuccess = () => {
          const all = req.result.transaction('boards').objectStore('boards').getAll();
          all.onsuccess = () =>
            resolve((all.result as { nodes: { x: number; y: number }[] }[])[0].nodes.map((n) => ({ x: n.x, y: n.y })));
        };
      })
  );
  expect(stored[0]).toEqual({ x: 40, y: 40 });
  expect(before.width).toBeGreaterThan(0);
});
