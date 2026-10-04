import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Typing fast must not lose a character.
 *
 * On macOS CI a character went missing from a note's title or a board's name,
 * about one run in five, always near the fifty-second character. The cause
 * was nowhere near the field. An effect in the Bible pane ran after every
 * render of the app and set a state to the value it already had; React could
 * not always drop that as a no-op, and queued a low-priority render for it.
 * React also counts commits that finish with more work queued, as its guard
 * against a component that updates itself in a loop, and after fifty in a row
 * the next state update throws "Maximum update depth exceeded". Typed slowly,
 * the queued render runs between two keys and the count starts again. Typed
 * faster than that, fifty keystrokes are fifty such commits, and the update
 * that throws is the fifty-first keystroke's own: the handler dies, the field
 * is put back as it was, and the character is gone.
 *
 * A reader does not type that fast, but a paste by an assistive tool, a
 * dictation burst or a slow device can; and an app that renders itself again
 * after every render is wrong whether or not anything is lost.
 */

const NOTE = 'Notes on the prologue of John: the Word, the light, the witness of John the Baptist, and grace upon grace';
const BOARD = 'Signs in John: water into wine, the official’s son, the pool, the loaves, the storm, the blind man, Lazarus';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** Keep hold of React's root, through the hook its DevTools would install. */
async function watchReact(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      isDisabled: false,
      renderers: new Map(),
      inject: () => 1,
      onCommitFiberRoot(_id: number, root: unknown) {
        w.__root = root;
      },
      onPostCommitFiberRoot() {},
      onCommitFiberUnmount() {},
      onScheduleFiberRoot() {},
      setStrictMode() {},
      checkDCE() {},
    };
  });
}

/**
 * What React still has queued once each keystroke has been handled: the
 * root's pending lanes, read as the `input` event leaves the document.
 */
async function queuedAfterEachKey(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __root?: { pendingLanes: number }; __queued: unknown[] };
    w.__queued = [];
    document.addEventListener('input', () => w.__queued.push(w.__root ? w.__root.pendingLanes : 'no root'));
  });
  return () => page.evaluate(() => (window as unknown as { __queued: unknown[] }).__queued);
}

test.describe('a keystroke leaves nothing queued behind it', () => {
  // Short enough not to wrap the field: nothing changes size, so nothing has
  // any reason to render again.
  const SHORT = 'Signs in John';

  test('in a note\'s title', async ({ page }) => {
    await watchReact(page);
    await open(page);
    await page.getByTestId('note-new').click();
    const queued = await queuedAfterEachKey(page);
    await page.getByTestId('note-title').click();
    await page.keyboard.type(SHORT);
    await expect(page.getByTestId('note-title')).toHaveValue(SHORT);
    expect(await queued()).toEqual(Array.from(SHORT, () => 0));
  });

  test('in a board\'s name', async ({ page }) => {
    await watchReact(page);
    await open(page);
    await page.getByTestId('side-board').click();
    await page.getByTestId('board-start').click();
    const queued = await queuedAfterEachKey(page);
    await page.getByTestId('board-name').click();
    await page.keyboard.type(SHORT);
    await expect(page.getByTestId('board-name')).toHaveValue(SHORT);
    expect(await queued()).toEqual(Array.from(SHORT, () => 0));
  });

  // The notes pane looks for the heading and the link under the caret after
  // every keystroke, and set both each time, nearly always to what they were.
  for (const editor of ['live', 'plain'] as const) {
    test(`in a note's text, ${editor} editor`, async ({ page }) => {
      if (editor === 'plain') {
        await page.addInitScript(() => localStorage.setItem('scriptura-display', JSON.stringify({ editor: 'plain' })));
      }
      await watchReact(page);
      await open(page);
      await page.getByTestId('note-new').click();
      const queued = await queuedAfterEachKey(page);
      await page.getByTestId('notes-surface').click();
      await page.keyboard.type(SHORT);
      await expect(page.getByTestId('notes-surface')).toHaveJSProperty('value', SHORT);
      expect(await queued()).toEqual(Array.from(SHORT, () => 0));
    });
  }
});

/*
 * And the thing itself: every character arrives, and React raises nothing,
 * with a frame wanted between keys as a slower machine has.
 */
test.describe('typed faster than the page can rest', () => {
  async function wantFrames(page: Page) {
    await page.evaluate(() => {
      const again = () => requestAnimationFrame(again);
      requestAnimationFrame(again);
    });
  }

  test('a long note title arrives whole', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page);
    await page.getByTestId('note-new').click();
    await wantFrames(page);
    await page.getByTestId('note-title').click();
    await page.keyboard.type(NOTE);
    await expect(page.getByTestId('note-title')).toHaveValue(NOTE);
    expect(errors).toEqual([]);
  });

  test('a long passage typed into a note arrives whole', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const passage = 'In the beginning was the Word, and the Word was with God. '.repeat(5).trim();
    await open(page);
    await page.getByTestId('note-new').click();
    await wantFrames(page);
    await page.getByTestId('notes-surface').click();
    await page.keyboard.type(passage);
    await expect(page.getByTestId('notes-surface')).toHaveJSProperty('value', passage);
    expect(errors).toEqual([]);
  });

  test('a long board name arrives whole', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page);
    await page.getByTestId('side-board').click();
    await page.getByTestId('board-start').click();
    await wantFrames(page);
    await page.getByTestId('board-name').click();
    await page.keyboard.type(BOARD);
    await expect(page.getByTestId('board-name')).toHaveValue(BOARD);
    expect(errors).toEqual([]);
  });
});
