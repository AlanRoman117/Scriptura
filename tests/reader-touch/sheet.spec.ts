import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The notes sheet under a finger, and above a keyboard.
 *
 * `page.touchscreen` can only tap, so drags are sent through the Chrome
 * DevTools Protocol as real touch events — the same events a phone produces,
 * converted to pointer events by the browser, which is the path the grip's
 * pointer capture and `touch-action: none` exist for. The software keyboard
 * cannot be shown at all; it is simulated the way the app itself sees one,
 * by shrinking `--vvh`, the visual viewport height.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** A touch drag in steps, with a pause between them like a finger moving at a steady pace. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 16) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const gripCentre = async (page: Page) => {
  const box = (await page.getByRole('button', { name: /(expand|collapse) notes/i }).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('dragging the grip up opens the sheet, and a further drag makes it full', async ({ page }) => {
  await open(page);
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');

  const start = await gripCentre(page);
  await touchDrag(page, start, { x: start.x, y: start.y - 300 });
  await expect(sheet).toHaveAttribute('data-sheet', 'half');
  // The drag ended; the release did not also count as a tap that cycles on.
  await page.waitForTimeout(100);
  await expect(sheet).toHaveAttribute('data-sheet', 'half');

  const again = await gripCentre(page);
  await touchDrag(page, again, { x: again.x, y: 20 });
  await expect(sheet).toHaveAttribute('data-sheet', 'full');

  // And back down to the bottom.
  const top = await gripCentre(page);
  await touchDrag(page, top, { x: top.x, y: 830 });
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');
});

test('a tap on the grip still cycles', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /expand notes/i }).tap();
  await expect(page.getByTestId('pane-notes')).toHaveAttribute('data-sheet', 'half');
});

test('with the keyboard up the sheet stays above it, and the note is visible to type into', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /expand notes/i }).tap();
  await page.getByTestId('note-new').tap();
  await page.getByTestId('notes-surface').tap();

  // Writing needs the room: focusing the note makes the sheet full.
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'full');
  // And the text behind it is out of reach while it is covered (2.4.12).
  await expect(page.getByTestId('pane-bible')).toHaveAttribute('inert', '');

  // A keyboard taking the lower half of the screen.
  await page.addStyleTag({ content: ':root { --vvh: 420px !important; }' });
  await expect.poll(async () => (await sheet.boundingBox())!.y + (await sheet.boundingBox())!.height).toBeLessThanOrEqual(421);
  // Room to write: at least five lines of the note above the keyboard. The
  // note bar steps aside while the note is being edited in a sheet this short.
  await expect(page.getByTestId('note-new')).toBeHidden();
  const surface = (await page.getByTestId('notes-surface').boundingBox())!;
  expect(surface.y).toBeLessThan(420);
  const lineHeight = await page.getByTestId('notes-surface').evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(Math.min(surface.y + surface.height, 420) - surface.y).toBeGreaterThanOrEqual(lineHeight * 5);
  // Every tool is still reachable, in one scrolling row.
  await expect(page.getByTestId('tool-link')).toBeAttached();
  const tools = await page.getByTestId('editor-tools').evaluate((el) => ({
    wraps: getComputedStyle(el).flexWrap,
    scrolls: el.scrollWidth > el.clientWidth,
  }));
  expect(tools.wraps).toBe('nowrap');
  expect(tools.scrolls).toBe(true);

  // Leaving the note brings the bar back.
  await page.getByTestId('note-title').focus();
  await expect(page.getByTestId('note-new')).toBeVisible();

  // Collapsing gives the text back.
  await page.getByRole('button', { name: /collapse notes/i }).tap();
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');
  await expect(page.getByTestId('pane-bible')).not.toHaveAttribute('inert', /.*/);
});

test('the grip is a full-width, finger-sized target clear of the bottom edge, and the chapter scrolls clear of the sheet', async ({ page }) => {
  await open(page);
  const grip = (await page.getByRole('button', { name: /expand notes/i }).boundingBox())!;
  expect(grip.height).toBeGreaterThanOrEqual(44);
  expect(grip.width).toBeGreaterThan(400);
  expect(grip.y + grip.height).toBeLessThanOrEqual(839 + 1);

  // The published height is the sheet's real height, and the pane leaves that
  // much room below the last verse.
  await page.getByRole('button', { name: /expand notes/i }).tap();
  const sheetBox = (await page.getByTestId('pane-notes').boundingBox())!;
  const published = await page.evaluate(() =>
    parseFloat(document.documentElement.style.getPropertyValue('--sheet-h'))
  );
  expect(Math.abs(published - sheetBox.height)).toBeLessThan(2);

  const pane = page.getByTestId('pane-bible');
  await pane.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const last = (await page.locator('.verse').last().boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(sheetBox.y + 1);
});
