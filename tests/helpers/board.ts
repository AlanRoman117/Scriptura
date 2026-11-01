import type { Locator, Page } from '@playwright/test';

/**
 * A board action by test id, reached the way a reader reaches it.
 *
 * Beside the Bible the less-used actions — Add note, Add to note, Delete
 * board and the pan buttons — fold behind "More" (CanvasView); on a wide
 * board they sit in the bar. This opens More first when the action is folded.
 */
export async function boardAction(page: Page, testId: string): Promise<Locator> {
  const action = page.getByTestId(testId);
  const more = page.getByTestId('board-more');
  if (!(await action.isVisible()) && (await more.isVisible()) && (await more.getAttribute('aria-expanded')) !== 'true') {
    await more.click();
  }
  return action;
}

/** One write to the boards store, as it was handed to IndexedDB. */
export interface BoardWrite {
  id: string;
  name: string;
  nodes: { id: string; x: number; y: number; w?: number; h?: number; color?: string }[];
  edges: unknown[];
}

interface WatchedWindow {
  __boardWrites: BoardWrite[];
  __boardTimersArmed: number;
  __heldBoardTimers: Map<number, () => void>;
  __failBoardWrites: boolean;
}

/**
 * Count the board's writes and take the clock out of it.
 *
 * Every write is recorded as `IDBObjectStore.put` receives it, and the board's
 * trailing timer is held until the test lets it go. So "nothing was written"
 * means that, and not "nothing was written yet", on any machine at any speed.
 * Picked out by its delay, BOARD_SAVE_MS in App.tsx. If that changes the timer
 * runs freely and the assertions that nothing has been written fail loudly.
 */
export async function watchBoardWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as WatchedWindow & Window;
    w.__boardWrites = [];
    w.__boardTimersArmed = 0;
    w.__heldBoardTimers = new Map();
    w.__failBoardWrites = false;

    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === 'boards') {
        if (w.__failBoardWrites) throw new DOMException('boom', 'QuotaExceededError');
        w.__boardWrites.push(JSON.parse(JSON.stringify(value)) as BoardWrite);
      }
      return put.call(this, value, key);
    };

    const setTimer = window.setTimeout.bind(window);
    const clearTimer = window.clearTimeout.bind(window);
    let next = 1_000_000_000;
    window.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => {
      if (ms !== 150) return setTimer(fn, ms, ...rest);
      const id = next++;
      w.__boardTimersArmed++;
      w.__heldBoardTimers.set(id, fn);
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id?: number) => {
      if (id !== undefined && w.__heldBoardTimers.delete(id)) return;
      clearTimer(id);
    }) as typeof window.clearTimeout;
  });
}

/** The writes recorded since the last `forgetBoardWrites`. */
export const boardWrites = (page: Page): Promise<BoardWrite[]> =>
  page.evaluate(() => (window as unknown as WatchedWindow).__boardWrites);

export const forgetBoardWrites = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as WatchedWindow;
    w.__boardWrites = [];
    w.__boardTimersArmed = 0;
  });

/** How many times the trailing timer has been started since the last `forgetBoardWrites`. */
export const boardTimersArmed = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as WatchedWindow).__boardTimersArmed);

/** What the timer would have done by now: run it. */
export const releaseBoardTimer = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const { __heldBoardTimers: held } = window as unknown as WatchedWindow;
    const due = [...held.values()];
    held.clear();
    for (const fn of due) fn();
  });

/** From here on, every write to the boards store fails as a full disk does. */
export const failBoardWrites = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as WatchedWindow).__failBoardWrites = true;
  });

/** The boards as they are in IndexedDB, not as they were handed to it. */
export const storedBoards = (page: Page): Promise<BoardWrite[]> =>
  page.evaluate(
    () =>
      new Promise<BoardWrite[]>((resolve, reject) => {
        const open = indexedDB.open('scriptura');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('boards').objectStore('boards').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            open.result.close();
            resolve(all.result as BoardWrite[]);
          };
        };
      })
  );
