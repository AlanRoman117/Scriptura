import { expect, test, type Page } from '@playwright/test';

/**
 * A `[[link]]` in the live editor, tapped. Found on an iPad: a touch screen
 * has no Ctrl or ⌘, so a tap only put the caret in the link and raised the
 * keyboard, and the passage never opened.
 *
 * The rule is the live preview's: a link that is *drawn* is a link, and a tap
 * follows it; on the line being edited, where its brackets show, it is text,
 * and a tap places the caret so it can be changed.
 */

const NOTE = 'a thought about [[psalms 23:1]] here\nnext line';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** A note holding a link on its first line, written through the sheet (or the pane, when wide). */
async function writeNote(page: Page) {
  if ((await page.getByTestId('layout').getAttribute('data-mode')) === 'narrow') {
    await page.getByTestId('sheet-grip').tap();
  }
  await page.getByTestId('note-new').tap();
  const surface = page.getByTestId('notes-surface');
  await surface.tap();
  await page.keyboard.type(NOTE);
  await expect(surface).toHaveJSProperty('value', NOTE);
  return surface;
}

const link = (page: Page) => page.getByTestId('notes-surface').locator('.md-link:not(.md-mark)');
const focusedIsNote = (page: Page) =>
  page.evaluate(() => document.activeElement === document.getElementById('notes-surface'));

/** One finger, pressed at `from` and lifted at `to`, through the DevTools protocol. */
async function touch(page: Page, from: { x: number; y: number }, to = from) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 6; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / 6, y: from.y + ((to.y - from.y) * i) / 6, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const centre = async (page: Page) => {
  const box = (await link(page).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('a tap on a drawn link opens its passage, without raising the keyboard', async ({ page }) => {
  await open(page);
  await writeNote(page);
  // Done writing: the reader lifts the keyboard, and every line is drawn.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(link(page)).toHaveText('psalms 23:1');

  await link(page).tap();
  await expect(page.getByTestId('chapter-title')).toContainText('Psalms 23');
  // No caret was placed, so no keyboard came up, and nothing was typed.
  expect(await focusedIsNote(page)).toBe(false);
  await expect(page.getByTestId('notes-surface')).toHaveJSProperty('value', NOTE);
});

test('a tap on a link opens it from another line of the note being written', async ({ page }) => {
  await open(page);
  const surface = await writeNote(page);
  // The caret is on "next line", so the link's line is drawn.
  await link(page).tap();
  await expect(page.getByTestId('chapter-title')).toContainText('Psalms 23');
  await expect(surface).toHaveJSProperty('value', NOTE);
});

test('on the line being edited, a tap on the link places the caret to change it', async ({ page }) => {
  await open(page);
  const surface = await writeNote(page);
  // Put the caret on the link's own line: its brackets show, and it is text.
  await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(5, 5));
  await expect(surface.locator('.live-line').first()).toHaveClass(/is-active/);

  await link(page).tap();
  await expect(page.getByTestId('notes-follow-link')).toContainText('Psalms 23:1');
  await expect(page.getByTestId('chapter-title')).not.toContainText('Psalms 23');
  const caret = await surface.evaluate((el) => (el as HTMLTextAreaElement).selectionStart);
  expect(caret).toBeGreaterThan(NOTE.indexOf('[['));
  expect(caret).toBeLessThan(NOTE.indexOf(']]') + 2);
});

test('a swipe that starts on a link is a scroll, not a tap', async ({ page }) => {
  await open(page);
  await writeNote(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const from = await centre(page);
  await touch(page, from, { x: from.x, y: from.y - 80 });
  await expect(page.getByTestId('chapter-title')).not.toContainText('Psalms 23');
});

test.describe('on a tablet, the Bible and the note side by side', () => {
  // An iPad in landscape: wide enough for both panes, and touch all the same.
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });

  test('a tap on a drawn link opens its passage beside the note', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('layout')).toHaveAttribute('data-mode', 'split');
    await writeNote(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await link(page).tap();
    await expect(page.getByTestId('chapter-title')).toContainText('Psalms 23');
    expect(await focusedIsNote(page)).toBe(false);
  });
});
