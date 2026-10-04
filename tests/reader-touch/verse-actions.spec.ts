import { expect, test } from '@playwright/test';
import { noteValue } from '../helpers/note';

/**
 * Marking a verse with a thumb.
 *
 * On a phone the actions dock above the notes sheet rather than opening inside
 * the text: in reach, and without pushing the chapter down. These are real
 * touch events (`.tap()`), under Chromium's Pixel 7 emulation.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test('a tap on the text docks the actions above the sheet, every one finger-sized', async ({ page }) => {
  await open(page);
  await page.locator('.verse[data-verse="2"] .verse__text').tap();
  const row = page.getByTestId('verse-actions');
  await expect(row).toBeVisible();
  expect(await row.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');

  const rowBox = (await row.boundingBox())!;
  const sheet = (await page.getByTestId('pane-notes').boundingBox())!;
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(sheet.y + 1);

  for (const button of await row.locator('button').all()) {
    const box = (await button.boundingBox())!;
    expect.soft(box.width, await button.getAttribute('data-testid') ?? '').toBeGreaterThanOrEqual(44);
    expect.soft(box.height, await button.getAttribute('data-testid') ?? '').toBeGreaterThanOrEqual(44);
  }

  // The verse stays in view, above the docked row.
  const verse = (await page.locator('.verse[data-verse="2"]').boundingBox())!;
  expect(verse.y).toBeGreaterThanOrEqual(0);
  expect(verse.y).toBeLessThan(rowBox.y);
});

test('a quote with the notes folded away is confirmed on the grip, until they are opened', async ({ page }) => {
  await open(page);
  await page.locator('.verse[data-verse="2"] .verse__text').tap();
  await page.getByTestId('quote-2').tap();

  // The sheet stays where the reader left it: they are still reading.
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');
  await expect(page.getByTestId('verse-actions')).toHaveCount(0);

  // So the grip — the way to the note — says what went into it…
  await expect(page.getByTestId('sheet-done')).toHaveText('✓ Quoted John 1:2');
  // …in its name as well as on screen, since the words are visible on the button (2.5.3)…
  const grip = page.getByRole('button', { name: /expand notes/i });
  await expect(grip).toHaveAccessibleName('Expand notes, Quoted John 1:2');
  // …and says it aloud, naming the note.
  await expect(page.getByTestId('announcer')).toHaveText('Quoted John 1:2 in a new note');

  // Opening the notes shows the quote itself; the stand-in goes.
  await grip.tap();
  await expect(sheet).toHaveAttribute('data-sheet', 'half');
  await expect.poll(() => noteValue(page.getByTestId('notes-surface'))).toContain('He was with God in the beginning.');
  await expect(page.getByTestId('sheet-done')).toHaveCount(0);
  await expect(grip).toHaveAccessibleName('Expand notes');
});

test('a tap marks the verse; a tap elsewhere closes the row', async ({ page }) => {
  await open(page);
  await page.locator('.verse[data-verse="3"] .verse__text').tap();
  await page.getByTestId('swatch-mint').tap();
  await expect(page.locator('.verse[data-verse="3"]')).toHaveAttribute('data-highlight', 'mint');
  await expect(page.getByTestId('verse-actions')).toHaveCount(0);

  await page.locator('.verse[data-verse="4"] .verse__text').tap();
  await expect(page.getByTestId('verse-actions')).toBeVisible();
  await page.getByTestId('chapter-title').tap();
  await expect(page.getByTestId('verse-actions')).toHaveCount(0);
});

test('read as running text without numbers, a tap on a sentence mid-line docks that verse’s actions', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('scriptura-display', JSON.stringify({ verseLines: false, verseNumbers: false })));
  await open(page);
  // Verse 3 begins partway along the line verse 2 ends on; tap its first words.
  const [two, three] = await Promise.all(
    [2, 3].map((n) =>
      page.locator(`.verse[data-verse="${n}"]`).evaluate((el) => [...el.getClientRects()].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })))
    )
  );
  expect(three[0].y).toBeCloseTo(two.at(-1)!.y, 0);
  await page.touchscreen.tap(three[0].x + three[0].width / 2, three[0].y + three[0].height / 2);

  await expect(page.getByTestId('verse-actions')).toBeVisible();
  await expect(page.locator('.verse[data-verse="3"]')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.verse[data-open]')).toHaveCount(1);
  await page.getByTestId('quote-3').tap();
  await expect(page.getByTestId('sheet-done')).toContainText('1:3');
});

/*
 * Several verses under a thumb. A tap adds a verse and a second tap takes it
 * out; the one docked row acts on all of them and says what it holds.
 */
test('more taps add verses to the one docked row, which says what it holds', async ({ page }) => {
  await open(page);
  for (const n of [2, 3, 7]) await page.locator(`.verse[data-verse="${n}"] .verse__text`).tap();
  await expect(page.locator('.verse[data-open]')).toHaveCount(3);

  const row = page.getByTestId('verse-actions');
  await expect(row).toHaveCount(1);
  expect(await row.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  await expect(page.getByTestId('verse-summary')).toHaveText('3 verses · John 1:2-3, 7');
  await expect(page.getByTestId('verse-fill')).toHaveText('Select 2-7');

  const rowBox = (await row.boundingBox())!;
  const sheet = (await page.getByTestId('pane-notes').boundingBox())!;
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(sheet.y + 1);
  for (const button of await row.locator('button').all()) {
    const box = (await button.boundingBox())!;
    expect.soft(box.width, await button.getAttribute('data-testid') ?? '').toBeGreaterThanOrEqual(44);
    expect.soft(box.height, await button.getAttribute('data-testid') ?? '').toBeGreaterThanOrEqual(44);
  }

  // A second tap takes one out; the fill button takes in the rest.
  await page.locator('.verse[data-verse="3"] .verse__text').tap();
  await expect(page.getByTestId('verse-summary')).toHaveText('2 verses · John 1:2, 7');
  await page.getByTestId('verse-fill').tap();
  await expect(page.locator('.verse[data-open]')).toHaveCount(6);
  await expect(page.getByTestId('verse-summary')).toHaveText('6 verses · John 1:2-7');
});

test('a group quoted with the notes folded away is confirmed as one on the grip', async ({ page }) => {
  await open(page);
  for (const n of [2, 3, 4]) await page.locator(`.verse[data-verse="${n}"] .verse__text`).tap();
  await page.getByTestId('quote-2').tap();

  await expect(page.getByTestId('pane-notes')).toHaveAttribute('data-sheet', 'peek');
  await expect(page.getByTestId('verse-actions')).toHaveCount(0);
  await expect(page.getByTestId('sheet-done')).toHaveText('✓ Quoted John 1:2-4');
  await expect(page.getByTestId('announcer')).toHaveText('Quoted John 1:2-4 in a new note');

  await page.getByTestId('sheet-grip').tap();
  const note = await noteValue(page.getByTestId('notes-surface'));
  expect(note).toContain('> — John 1:2-4 (BSB)\n\n[[john 1:2-4@bsb]]');
  expect(note.match(/— John/g)).toHaveLength(1);
});

// A finger that starts a scroll between two verses, or a tap that misses,
// must not throw away a group chosen one verse at a time. (One verse still
// closes on a tap elsewhere: "a tap marks the verse; a tap elsewhere closes
// the row", above.)
test('a tap elsewhere and a scroll with a finger both keep the group', async ({ page }) => {
  await open(page);
  for (const n of [2, 3]) await page.locator(`.verse[data-verse="${n}"] .verse__text`).tap();
  await page.getByTestId('chapter-title').tap();
  await expect(page.locator('.verse[data-open]')).toHaveCount(2);
  const pane = page.getByTestId('pane-bible');
  const before = await pane.evaluate((el) => el.scrollTop);

  const cdp = await page.context().newCDPSession(page);
  const [x, from, to] = [200, 520, 220];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: from + ((to - from) * i) / 12 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();

  await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(before + 100);
  await expect(page.locator('.verse[data-open]')).toHaveCount(2);
  await expect(page.getByTestId('verse-summary')).toHaveText('2 verses · John 1:2-3');
  // Still docked and still in reach.
  const rowBox = (await page.getByTestId('verse-actions').boundingBox())!;
  const sheet = (await page.getByTestId('pane-notes').boundingBox())!;
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(sheet.y + 1);
});

// One verse closes when the notes are opened. A group does not, and with the
// sheet at full height its row, docked above the sheet, showed its last line
// of buttons over the top of it — on a text that is covered and inert there.
test('a group waits out of sight while the notes cover the text, and is back when they fold', async ({ page }) => {
  await open(page);
  for (const n of [1, 2, 4]) await page.locator(`.verse[data-verse="${n}"] .verse__text`).tap();
  const row = page.getByTestId('verse-actions');
  await expect(row).toBeVisible();

  // The grip moves with the sheet: it is pressed where it is once the sheet
  // has stopped, or the tap lands where it was.
  const grip = async (to: string) => {
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
    const box = (await page.getByTestId('sheet-grip').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('[data-sheet]')).toHaveAttribute('data-sheet', to);
  };
  await grip('half');
  // Half open, the text is still there to press, and so is the row.
  await expect(row).toBeVisible();
  await grip('full');
  await expect(page.getByTestId('pane-bible')).toHaveAttribute('inert', '');
  await expect(row).toBeHidden();

  await grip('peek');
  await expect(row).toBeVisible();
  await expect(page.locator('.verse[data-open]')).toHaveCount(3);
  await expect(page.getByTestId('verse-summary')).toHaveText('3 verses · John 1:1-2, 4');
});
