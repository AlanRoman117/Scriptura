import { expect, test } from '@playwright/test';

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
  await expect(page.getByTestId('notes-surface')).toContainText('He was with God in the beginning.');
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
