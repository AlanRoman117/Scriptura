import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  boardAction,
  boardTimersArmed,
  boardWrites,
  failBoardWrites,
  forgetBoardWrites,
  releaseBoardTimer,
  storedBoards,
  watchBoardWrites,
} from '../helpers/board';

/**
 * A board is written whole, and it used to be written on every pointer move:
 * 60 writes in a 60-move drag, 80 KB each at 500 cards. It now trails behind a
 * gesture, which is only worth having if nothing can be lost by it.
 *
 * Nothing here waits for a delay. `watchBoardWrites` holds the trailing timer,
 * so a write can only come from the path a test is proving, and each test
 * first shows the save really is being held back (on the old code it was not,
 * and they fail there).
 */

async function open(page: Page) {
  await watchBoardWrites(page);
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** A board holding John 1:1 and 1:3, open, with the record of writes clean. */
async function aBoard(page: Page) {
  await open(page);
  for (const verse of [1, 3]) {
    await page.getByTestId(`verse-${verse}`).click();
    await page.getByTestId(`canvas-${verse}`).click();
  }
  await page.getByTestId('side-board').click();
  await expect(page.locator('.card')).toHaveCount(2);
  await expect.poll(() => storedBoards(page).then((b) => b[0]?.nodes.length)).toBe(2);
  const card = page.locator('.card').first();
  const cardId = (await card.getAttribute('data-testid'))!.replace('card-', '');
  const boardId = (await storedBoards(page))[0].id;
  await forgetBoardWrites(page);
  return { card, cardId, boardId };
}

const drawnLeft = (card: Locator) => card.evaluate((el: HTMLElement) => parseFloat(el.style.left));
const drawnWidth = (card: Locator) => card.evaluate((el: HTMLElement) => parseFloat(el.style.width));

/** Press the card's grip and drag it, ending with the pointer still down. */
async function dragWithoutLetting(page: Page, card: Locator, moves = 5) {
  const box = (await card.locator('.card__grip').boundingBox())!;
  const x = box.x + box.width - 30;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= moves; i++) {
    const was = await drawnLeft(card);
    await page.mouse.move(x + i * 7, y + i * 3);
    // The screen does not wait for the store: every move is drawn.
    await expect.poll(() => drawnLeft(card)).not.toBe(was);
  }
}

/**
 * Hold an arrow key on the card, so a save is pending with no gesture able to
 * end it: the only way a test can prove a flush that has no other cause, since
 * a card taken off the screen mid-drag also loses its pointer capture.
 */
async function holdArrow(page: Page, card: Locator) {
  await card.focus();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(1);
  await forgetBoardWrites(page);
  const was = await drawnLeft(card);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => drawnLeft(card)).not.toBe(was);
  expect(await boardWrites(page)).toEqual([]);
}

const writtenX = (page: Page, boardId: string, cardId: string) =>
  storedBoards(page).then((boards) => boards.find((b) => b.id === boardId)?.nodes.find((n) => n.id === cardId)?.x);

test.describe('saving a board', () => {
  test('a drag is drawn on every move, written when it ends, and once', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await dragWithoutLetting(page, card);
    expect(await boardWrites(page)).toEqual([]);

    await page.mouse.up();
    await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(1);
    const left = await drawnLeft(card);
    expect((await boardWrites(page))[0].nodes.find((n) => n.id === cardId)?.x).toBe(left);
    await expect.poll(() => writtenX(page, boardId, cardId)).toBe(left);
  });

  test('a resize is drawn on every move, written when it ends, and once', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    const corner = (await page.getByTestId(`card-resize-${cardId}`).boundingBox())!;
    const x = corner.x + corner.width / 2;
    const y = corner.y + corner.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      const was = await drawnWidth(card);
      await page.mouse.move(x + i * 9, y + i * 4);
      await expect.poll(() => drawnWidth(card)).not.toBe(was);
    }
    expect(await boardWrites(page)).toEqual([]);

    await page.mouse.up();
    await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(1);
    const width = await drawnWidth(card);
    await expect
      .poll(() => storedBoards(page).then((b) => b.find((s) => s.id === boardId)?.nodes.find((n) => n.id === cardId)?.w))
      .toBe(width);
  });

  test('a touch the browser takes away ends the gesture as a lift does', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    const pointer = await page.evaluateHandle(() => {
      const seen = { id: -1 };
      window.addEventListener('pointerdown', (e) => (seen.id = e.pointerId), { capture: true, once: true });
      return seen;
    });
    await dragWithoutLetting(page, card);
    expect(await boardWrites(page)).toEqual([]);

    const pointerId = await pointer.evaluate((seen) => seen.id);
    await card.locator('.card__grip').dispatchEvent('pointercancel', { pointerId, bubbles: true });
    await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(1);
    await expect.poll(() => writtenX(page, boardId, cardId)).toBe(await drawnLeft(card));
    await page.mouse.up();
  });

  test('a long drag keeps saving as it goes, on one timer the moves do not push back', async ({ page }) => {
    const { card, cardId } = await aBoard(page);
    await dragWithoutLetting(page, card);
    // Five moves, one timer: pushed back by each move, it would be five, and a
    // drag that never paused would never write at all.
    expect(await boardTimersArmed(page)).toBe(1);

    await releaseBoardTimer(page);
    await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(1);
    expect((await boardWrites(page))[0].nodes.find((n) => n.id === cardId)?.x).toBe(await drawnLeft(card));

    // Still dragging: the next moves start it again.
    const was = await drawnLeft(card);
    await page.mouse.move(700, 500);
    await expect.poll(() => drawnLeft(card)).not.toBe(was);
    expect(await boardTimersArmed(page)).toBe(2);
    expect(await boardWrites(page)).toHaveLength(1);
    await page.mouse.up();
    await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(2);
  });

  test('a held arrow key writes the first step at once and the rest when it is let go', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await holdArrow(page, card);
    await page.keyboard.up('ArrowRight');
    await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(1);
    await expect.poll(() => writtenX(page, boardId, cardId)).toBe(await drawnLeft(card));
  });

  test('showing another board saves the one being left', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await page.getByTestId('board-new').click();
    await expect(page.locator('.card')).toHaveCount(0);
    await page.getByTestId('board-select').selectOption(boardId);
    await expect(page.locator('.card')).toHaveCount(2);
    await forgetBoardWrites(page);

    await holdArrow(page, card);
    const left = await drawnLeft(card);
    const other = await page.getByTestId('board-select').locator('option').first().getAttribute('value');
    expect(other).not.toBe(boardId);
    await page.getByTestId('board-select').selectOption(other!);
    await expect(page.locator('.card')).toHaveCount(0);
    await expect.poll(() => writtenX(page, boardId, cardId)).toBe(left);
    expect(await boardWrites(page)).toHaveLength(1);
    await page.keyboard.up('ArrowRight');
  });

  test('going to the notes tab saves the board', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await holdArrow(page, card);
    const left = await drawnLeft(card);
    await page.getByTestId('side-notes').click();
    await expect.poll(() => writtenX(page, boardId, cardId)).toBe(left);
    expect(await boardWrites(page)).toHaveLength(1);
    await page.keyboard.up('ArrowRight');
  });

  test('the page going to the background saves the board', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await holdArrow(page, card);
    const left = await drawnLeft(card);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete (document as unknown as { visibilityState?: string }).visibilityState;
    });
    await expect.poll(() => writtenX(page, boardId, cardId)).toBe(left);
    expect(await boardWrites(page)).toHaveLength(1);
    await page.keyboard.up('ArrowRight');
  });

  test('the page being left saves the board', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await holdArrow(page, card);
    const left = await drawnLeft(card);
    // On its own, not behind a visibilitychange, as Safari can send it.
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(() => writtenX(page, boardId, cardId)).toBe(left);
    expect(await boardWrites(page)).toHaveLength(1);
    await page.keyboard.up('ArrowRight');
  });

  test('a reload in the middle of a drag loses none of it', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await dragWithoutLetting(page, card);
    expect(await boardWrites(page)).toEqual([]);
    const left = await drawnLeft(card);

    // A real one: the write has to reach the disk while the page is going away.
    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.mouse.up();
    expect(await writtenX(page, boardId, cardId)).toBe(left);
  });

  test('a board deleted with a save pending does not come back', async ({ page }) => {
    const { card, boardId } = await aBoard(page);
    await holdArrow(page, card);

    await (await boardAction(page, 'board-delete')).click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('board-start')).toBeVisible();
    await forgetBoardWrites(page);

    // The timer goes off, as it would have, and there is nothing for it to do.
    await releaseBoardTimer(page);
    await page.keyboard.up('ArrowRight');
    expect(await boardWrites(page)).toEqual([]);
    await expect.poll(() => storedBoards(page).then((b) => b.map((s) => s.id))).not.toContain(boardId);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('side-board').click();
    await expect(page.getByTestId('board-start')).toBeVisible();
    expect(await storedBoards(page)).toEqual([]);
  });

  test('a save held back cannot overwrite a newer edit to the same board', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    await holdArrow(page, card);
    const left = await drawnLeft(card);

    // Written at once, and already holding the moves.
    await page.getByTestId('board-name').fill('Newer');
    await expect.poll(() => boardWrites(page).then((w) => w.length)).toBe(1);
    await releaseBoardTimer(page);

    const stored = await storedBoards(page).then((b) => b.find((s) => s.id === boardId));
    expect(stored?.name).toBe('Newer');
    expect(stored?.nodes.find((n) => n.id === cardId)?.x).toBe(left);
    expect(await boardWrites(page)).toHaveLength(1);
    await page.keyboard.up('ArrowRight');
  });

  test('a save held back cannot take away a verse just added from the text', async ({ page }) => {
    const { card, boardId } = await aBoard(page);
    await holdArrow(page, card);

    await page.getByTestId('verse-5').click();
    await page.getByTestId('canvas-5').click();
    await expect(page.locator('.card')).toHaveCount(3);
    await expect.poll(() => storedBoards(page).then((b) => b.find((s) => s.id === boardId)?.nodes.length)).toBe(3);

    await releaseBoardTimer(page);
    expect(await boardWrites(page)).toHaveLength(1);
    expect(await storedBoards(page).then((b) => b.find((s) => s.id === boardId)?.nodes.length)).toBe(3);
    await page.keyboard.up('ArrowRight');
  });

  test('a failed save is still announced', async ({ page }) => {
    const { card } = await aBoard(page);
    await failBoardWrites(page);
    await dragWithoutLetting(page, card);
    expect(await boardWrites(page)).toEqual([]);
    await expect(page.getByTestId('announcer-alert')).not.toContainText('Could not save the board');

    await page.mouse.up();
    await expect(page.getByTestId('announcer-alert')).toContainText('Could not save the board');
  });

  /*
   * The other half of the bargain, with the timer held throughout: an edit
   * that is not a gesture is written the moment it is made. These pass on the
   * old code as they should. They fail if the trailing save spreads.
   */
  test('an edit that is not a gesture is written at once', async ({ page }) => {
    const { card, cardId, boardId } = await aBoard(page);
    const written = async (action: () => Promise<unknown>, what: (b: Awaited<ReturnType<typeof storedBoards>>[0]) => unknown, expected: unknown) => {
      await forgetBoardWrites(page);
      await action();
      await expect.poll(() => boardWrites(page).then((w) => w.length)).toBeGreaterThan(0);
      await expect.poll(() => storedBoards(page).then((b) => what(b.find((s) => s.id === boardId)!))).toEqual(expected);
      expect(await boardTimersArmed(page)).toBe(0);
    };
    const node = (b: Awaited<ReturnType<typeof storedBoards>>[0]) => b.nodes.find((n) => n.id === cardId)!;

    // A key pressed and let go: a tap is one step, and the first of a hold is too.
    const x = await drawnLeft(card);
    await card.focus();
    await written(() => page.keyboard.press('ArrowRight'), (b) => node(b).x > x, true);
    const w = await drawnWidth(card);
    await written(() => page.keyboard.press('Alt+ArrowRight'), (b) => (node(b).w ?? 0) > w, true);

    // The Move panel's buttons.
    await page.getByTestId(`card-adjust-${cardId}`).click();
    const nudged = await drawnLeft(card);
    await written(() => page.getByTestId('adjust-right').click(), (b) => node(b).x > nudged, true);
    await page.getByTestId('card-panel-close').click();

    await written(() => page.getByTestId('board-name').fill('Named'), (b) => b.name, 'Named');
    await written(() => page.getByTestId('board-add-text').click(), (b) => b.nodes.length, 3);

    await page.getByTestId(`card-colour-${cardId}`).click();
    await written(() => page.getByTestId('card-swatch-rose').click(), (b) => node(b).color, 'rose');
    await page.keyboard.press('Escape');

    await page.getByTestId(`card-connect-${cardId}`).click();
    const second = await page.locator('.card').nth(1).getAttribute('data-testid');
    await written(() => page.getByTestId(second!).click(), (b) => b.edges.length, 1);
  });
});
