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

  test('putting a verse on the board says so, since the board is out of sight', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-1').click();
    await page.getByTestId('canvas-1').click();
    await expect(page.getByTestId('note-done')).toHaveText('✓ Added John 1:1 to “Study board”');
    await expect(page.getByTestId('announcer')).toHaveText('Added John 1:1 to “Study board”');

    // Asking twice changes nothing, and says that instead of saying nothing.
    await page.getByTestId('verse-1').click();
    await page.getByTestId('canvas-1').click();
    await expect(page.getByTestId('note-done')).toHaveText('✓ John 1:1 is already on “Study board”');
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
    // reachable rather than sitting underneath it. Removing asks first.
    await page.getByTestId(`card-remove-${id}`).click();
    await expect(page.getByTestId(`card-remove-${id}`)).toHaveText('Sure?');
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

test.describe('the board without a mouse, and without dragging (2.1.1, 2.5.7)', () => {
  const firstCardId = (page: import('@playwright/test').Page) =>
    page.locator('.card').first().evaluate((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''));

  test('a card takes focus; the arrow keys move it and Alt with an arrow resizes it', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const card = page.locator('.card').first();
    await expect(card).toHaveAccessibleName(/Verse card: John 1:1/);

    await card.focus();
    const before = (await card.boundingBox())!;
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const moved = (await card.boundingBox())!;
    expect(Math.round(moved.x - before.x)).toBe(30);
    expect(Math.round(moved.y - before.y)).toBe(50);

    // Alt+Right is the browser's "forward" outside a page that claims it; the
    // board claims it, so the reader stays on the board.
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Alt+ArrowDown');
    const resized = (await card.boundingBox())!;
    expect(Math.round(resized.width - moved.width)).toBe(10);
    expect(Math.round(resized.height - moved.height)).toBe(10);
    await expect(page.getByTestId('canvas')).toBeVisible();
    await expect(page.getByTestId('announcer')).toContainText(/John 1:1.*wide/);
  });

  test('a single pointer moves and resizes a card with buttons', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const id = await firstCardId(page);
    const card = page.getByTestId(`card-${id}`);
    const before = (await card.boundingBox())!;

    await page.getByTestId(`card-adjust-${id}`).click();
    const panel = page.getByTestId('card-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('adjust-left')).toBeFocused();
    await page.getByTestId('adjust-right').click();
    await page.getByTestId('adjust-right').click();
    await page.getByTestId('adjust-down').click();
    await page.getByTestId('adjust-wider').click();
    const after = (await card.boundingBox())!;
    expect(Math.round(after.x - before.x)).toBe(40);
    expect(Math.round(after.y - before.y)).toBe(20);
    expect(Math.round(after.width - before.width)).toBe(20);

    // Done closes it and gives focus back to the button that opened it.
    await page.getByTestId('card-panel-close').click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId(`card-adjust-${id}`)).toBeFocused();

    // The size never goes below what the card's own controls need.
    await page.getByTestId(`card-adjust-${id}`).click();
    for (let i = 0; i < 12; i++) await page.getByTestId('adjust-narrower').click();
    expect((await card.boundingBox())!.width).toBeGreaterThanOrEqual(272);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('the view moves with buttons, and with the arrow keys on the board itself', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const card = page.locator('.card').first();
    const start = (await card.boundingBox())!;

    // "Move the view right" shows what is to the right, so the card moves left.
    await page.getByTestId('pan-right').click();
    expect(Math.round((await card.boundingBox())!.x - start.x)).toBe(-80);
    await page.getByTestId('pan-down').click();
    expect(Math.round((await card.boundingBox())!.y - start.y)).toBe(-80);

    const frame = page.locator('.canvas__frame');
    await frame.focus();
    await page.keyboard.press('ArrowLeft');
    expect(Math.round((await card.boundingBox())!.x - start.x)).toBe(-40);
    await page.keyboard.press('+');
    await expect(page.getByTestId('zoom-reset')).toHaveText('120%');
    await page.keyboard.press('-');
    await expect(page.getByTestId('zoom-reset')).toHaveText('100%');
  });

  test('a card is coloured from a panel, and its colour is named in words', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const id = await firstCardId(page);
    await page.getByTestId(`card-colour-${id}`).click();
    await expect(page.getByTestId('card-swatch-none')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('card-swatch-rose').click();

    const card = page.getByTestId(`card-${id}`);
    await expect(card).toHaveAttribute('data-color', 'rose');
    await expect(card).toHaveAccessibleName(/Rose \(rose\)/);
    await expect(page.getByTestId(`card-colour-${id}`)).toHaveAccessibleName(/Colour: Rose \(rose\)/);

    await page.getByTestId('card-swatch-none').click();
    await expect(card).not.toHaveAttribute('data-color', /./);
  });

  test('a connection is made from the keyboard', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const ids = await page.locator('.card').evaluateAll((cards) =>
      cards.map((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''))
    );
    await page.getByTestId(`card-connect-${ids[0]}`).focus();
    await page.keyboard.press('Enter');
    await page.getByTestId(`card-${ids[1]}`).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.canvas__edges line')).toHaveCount(1);
    await expect(page.getByTestId('announcer')).toContainText(/Connected John 1:1 .* to John 1:3/);
  });
});

test.describe('connections in words, and removals that can be taken back (1.1.1, 3.3.6)', () => {
  const cardIds = (page: import('@playwright/test').Page) =>
    page.locator('.card').evaluateAll((cards) => cards.map((c) => (c as HTMLElement).dataset.testid!.replace('card-', '')));

  async function connected(page: import('@playwright/test').Page) {
    await open(page);
    await boardWithTwoVerses(page);
    const ids = await cardIds(page);
    await page.getByTestId(`card-connect-${ids[0]}`).click();
    await page.getByTestId(`card-${ids[1]}`).click();
    await expect(page.locator('.canvas__edges line')).toHaveCount(1);
    return ids;
  }

  test('the connection chip is always drawn, not only on hover', async ({ page }) => {
    await connected(page);
    const chip = page.locator('.canvas__edge-chip');
    await expect(chip).toHaveCount(1);
    const stroke = await chip.evaluate((el) => getComputedStyle(el).stroke);
    expect(stroke).not.toMatch(/none|transparent|rgba\(0, 0, 0, 0\)/);
  });

  test('the Connections list names each connection, removes one, and the removal can be undone', async ({ page }) => {
    await connected(page);
    await page.getByTestId('board-connections').click();
    const list = page.locator('#board-connections-list');
    await expect(list).toContainText('John 1:1 (BSB) → John 1:3 (BSB)');

    await list.getByRole('button', { name: /Remove the connection John 1:1/ }).click();
    await expect(page.locator('.canvas__edges line')).toHaveCount(0);
    await expect(page.getByTestId('announcer')).toContainText(/removed\. Undo/);

    await page.getByTestId('board-undo').click();
    await expect(page.locator('.canvas__edges line')).toHaveCount(1);
    await expect(page.getByTestId('board-undo')).toHaveCount(0);
  });

  test('removing a card asks first, and puts back the card and its connections on undo', async ({ page }) => {
    const ids = await connected(page);
    await page.getByTestId(`card-remove-${ids[0]}`).click();
    await expect(page.getByTestId(`card-remove-${ids[0]}`)).toHaveText('Sure?');
    await page.getByTestId(`card-remove-${ids[0]}-cancel`).click();
    await expect(page.locator('.card')).toHaveCount(2);

    await page.getByTestId(`card-remove-${ids[0]}`).click();
    await page.getByTestId(`card-remove-${ids[0]}`).click();
    await expect(page.locator('.card')).toHaveCount(1);
    await expect(page.locator('.canvas__edges line')).toHaveCount(0);

    await page.getByTestId('board-undo').click();
    await expect(page.locator('.card')).toHaveCount(2);
    await expect(page.locator('.canvas__edges line')).toHaveCount(1);
  });

  test('any other change ends the chance to undo', async ({ page }) => {
    const ids = await connected(page);
    await page.locator('.canvas__edge-cut').click();
    await expect(page.getByTestId('board-undo')).toBeVisible();
    await page.getByTestId(`card-adjust-${ids[1]}`).click();
    await page.getByTestId('adjust-right').click();
    await expect(page.getByTestId('board-undo')).toHaveCount(0);
  });

  test('Delete on a focused card arms its remove button; Escape backs out, Enter confirms', async ({ page }) => {
    await open(page);
    await boardWithTwoVerses(page);
    const ids = await cardIds(page);
    await page.getByTestId(`card-${ids[0]}`).focus();
    await page.keyboard.press('Delete');
    const remove = page.getByTestId(`card-remove-${ids[0]}`);
    await expect(remove).toBeFocused();
    await expect(remove).toHaveText('Sure?');
    await page.keyboard.press('Escape');
    await expect(remove).toHaveText('✕');

    await page.getByTestId(`card-${ids[0]}`).focus();
    await page.keyboard.press('Delete');
    await page.keyboard.press('Enter');
    await expect(page.locator('.card')).toHaveCount(1);
  });
});
