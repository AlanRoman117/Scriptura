import { expect, test } from '@playwright/test';

/**
 * Stage 5: the board.
 *
 * The spec asks for this for visual learners who otherwise export passages into
 * GoodNotes or Notability to lay them out — so the things worth proving are
 * that a board survives, that cards hold anchors rather than copied text, and
 * that the work leaves the app in a readable form.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** Put John 1:1 and 1:3 on a board, and end up looking at it. */
async function boardWithTwoVerses(page: import('@playwright/test').Page) {
  await page.getByTestId('verse-1').click();
  await page.getByTestId('canvas-1').click();
  await page.getByTestId('verse-3').click();
  await page.getByTestId('canvas-3').click();
  await page.getByTestId('canvas-open').click();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(2);
}

test.describe('a board', () => {
  test('a verse goes from the text to the board without leaving the reader', async ({ page }) => {
    await open(page);
    // No "make a board first": the first card creates one.
    await boardWithTwoVerses(page);
    await expect(page.locator('.card').first()).toContainText('John 1:1');
    await expect(page.locator('.card').first()).toContainText('In the beginning was the Word');
  });

  test('cards can be moved, and stay where they are put', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);

    const card = page.locator('.card').first();
    const before = (await card.boundingBox())!;
    await page.locator('.card').first().locator('.card__grip').hover();
    await page.mouse.down();
    await page.mouse.move(before.x + 260, before.y + 170, { steps: 10 });
    await page.mouse.up();

    const after = (await card.boundingBox())!;
    expect(after.x).toBeGreaterThan(before.x + 100);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('canvas-open').click();
    const restored = (await page.locator('.card').first().boundingBox())!;
    expect(Math.abs(restored.x - after.x)).toBeLessThan(4);
    expect(Math.abs(restored.y - after.y)).toBeLessThan(4);
  });

  test('two cards can be connected, and the connection cut', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);

    const ids = await page.locator('.card').evaluateAll((cards) =>
      cards.map((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''))
    );
    await page.getByTestId(`card-connect-${ids[0]}`).click();
    await page.getByTestId(`card-${ids[1]}`).click();
    await expect(page.locator('.canvas__edges line')).toHaveCount(1);

    // The midpoint is the cut.
    await page.locator('.canvas__edge-cut').click();
    await expect(page.locator('.canvas__edges line')).toHaveCount(0);
  });

  test('a card holds the passage, not a copy of the text', async ({ page }) => {
    // So a board built in one translation reads in another instead of becoming
    // a snapshot that quietly goes stale.
    await open(page);
    await page.getByTestId('verse-1').click();
    await page.getByTestId('canvas-1').click();

    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-rv1909').click();
    await expect(page.getByTestId('library-read-rv1909')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('library-read-rv1909').click();

    await page.getByTestId('canvas-open').click();
    const card = page.locator('.card').first();
    await expect(card).toContainText('Juan 1:1');
    await expect(card).toContainText('el principio era el Verbo');
  });

  test('a text card can be written on, and removed', async ({ page }) => {
    await open(page);
    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-new').click();
    await page.getByTestId('board-add-text').click();

    const card = page.locator('.card').first();
    const id = await card.evaluate((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''));
    await page.getByTestId(`card-text-${id}`).fill('The Word made flesh');
    await expect(page.getByTestId(`card-text-${id}`)).toHaveValue('The Word made flesh');

    // The resize grip lives in this corner; the remove button must still be
    // reachable rather than sitting underneath it.
    await page.getByTestId(`card-remove-${id}`).click();
    await expect(page.locator('.card')).toHaveCount(0);
  });

  test('removing a card takes its connections with it', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const ids = await page.locator('.card').evaluateAll((cards) =>
      cards.map((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''))
    );
    await page.getByTestId(`card-connect-${ids[0]}`).click();
    await page.getByTestId(`card-${ids[1]}`).click();
    await expect(page.locator('.canvas__edges line')).toHaveCount(1);

    // An edge to a card that no longer exists would draw to nowhere.
    await page.getByTestId(`card-remove-${ids[0]}`).click();
    await expect(page.locator('.canvas__edges line')).toHaveCount(0);
  });

  test('a card cannot be dragged off the plane, and reset finds them', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);

    // Drag hard past the top-left; the card stops at the origin rather than
    // disappearing in the one direction panning back from is least obvious.
    const grip = page.locator('.card').first().locator('.card__grip');
    const box = (await grip.boundingBox())!;
    await grip.hover();
    await page.mouse.down();
    await page.mouse.move(box.x - 900, box.y - 900, { steps: 10 });
    await page.mouse.up();

    await page.getByTestId('zoom-reset').click();
    const card = page.locator('.card').first();
    await expect(card).toBeInViewport();
  });

  test('the board leaves with the notes, in the export', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    await page.getByTestId('canvas-close').click();

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('note-export').click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    expect(await download.path()).toBeTruthy();
  });
});

test.describe('getting around the board', () => {
  test('dragging the background pans it', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);

    // The plane is absolutely positioned over the whole frame, so a press
    // always lands on it and never on the frame — comparing target with
    // currentTarget meant background dragging did nothing at all.
    const card = page.locator('.card').first();
    const before = (await card.boundingBox())!;

    await page.mouse.move(900, 600);
    await page.mouse.down();
    await page.mouse.move(700, 480, { steps: 10 });
    await page.mouse.up();

    const after = (await card.boundingBox())!;
    expect(Math.round(after.x - before.x)).toBe(-200);
    expect(Math.round(after.y - before.y)).toBe(-120);
  });

  test('the wheel moves the board, and ctrl-wheel zooms at the pointer', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const card = page.locator('.card').first();
    const before = (await card.boundingBox())!;

    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 200);
    const panned = (await card.boundingBox())!;
    expect(panned.y).toBeLessThan(before.y - 100);

    // ControlOrMeta, like the rest of the suite: a Mac user presses ⌘, and the
    // handler accepts either.
    await page.keyboard.down('ControlOrMeta');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('ControlOrMeta');
    await expect(page.getByTestId('zoom-reset')).not.toHaveText('100%');
  });

  test('a card can be resized, and holds a long note without clipping it', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('Long');
    await page.getByTestId('notes-surface').fill('word '.repeat(200));

    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-new').click();
    await page.getByTestId('board-add-note').click();

    const card = page.locator('.card').first();
    const id = await card.evaluate((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''));

    // The body scrolls rather than clipping: a whole note never fit any fixed
    // height, and clipping simply put the rest out of reach.
    const body = card.locator('.card__body');
    const overflows = await body.evaluate((el) => el.scrollHeight > el.clientHeight + 2);
    expect(overflows).toBe(true);
    await body.evaluate((el) => el.scrollBy(0, 200));
    expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    const before = (await card.boundingBox())!;
    const grip = page.getByTestId(`card-resize-${id}`);
    const at = (await grip.boundingBox())!;
    await page.mouse.move(at.x + 4, at.y + 4);
    await page.mouse.down();
    await page.mouse.move(at.x + 180, at.y + 140, { steps: 10 });
    await page.mouse.up();

    const after = (await card.boundingBox())!;
    expect(after.width).toBeGreaterThan(before.width + 100);
    expect(after.height).toBeGreaterThan(before.height + 80);
  });

  test('a card the reader wrote can be named', async ({ page }) => {
    await open(page);
    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-new').click();
    await page.getByTestId('board-add-text').click();

    const card = page.locator('.card').first();
    const id = await card.evaluate((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''));
    await page.getByTestId(`card-title-${id}`).fill('The argument');
    await page.getByTestId(`card-text-${id}`).fill('Light overcomes darkness.');

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('canvas-open').click();
    await expect(page.getByTestId(`card-title-${id}`)).toHaveValue('The argument');

    // Verse cards derive their title from what they point at, so there is
    // nothing to edit — and nothing to drift.
    await page.getByTestId('canvas-close').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('canvas-1').click();
    await page.getByTestId('canvas-open').click();
    const verseCard = page.locator('.card[data-kind="verse"]').first();
    const verseId = await verseCard.evaluate((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''));
    await expect(page.getByTestId(`card-title-${verseId}`)).toHaveCount(0);
  });
});
