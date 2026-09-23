import type { Locator, Page } from '@playwright/test';

/**
 * The note editor's text, whichever editor is showing.
 *
 * The live editor is a contenteditable, so Playwright's `inputValue()` and
 * `toHaveValue()` refuse it, and its `textContent` has no line breaks — each
 * line is its own element. It answers to a textarea's `value` instead, as a
 * textarea does, so read that: `toHaveJSProperty('value', …)` to assert on
 * the whole note, this to read it or look for a part of it.
 */
export const noteValue = (surface: Locator): Promise<string> =>
  surface.evaluate((el) => (el as HTMLTextAreaElement).value);

/**
 * Every note body as stored in IndexedDB — what a reload will find. Edits
 * are saved after a short delay, so a test that reloads waits on this rather
 * than on the "Saved" label (see CLAUDE.md).
 */
export const storedBodies = (page: Page): Promise<string[]> =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open('scriptura');
        open.onsuccess = () => {
          const req = open.result.transaction('notes').objectStore('notes').getAll();
          req.onsuccess = () => resolve((req.result as { body: string }[]).map((n) => n.body));
          req.onerror = () => resolve([]);
        };
        open.onerror = () => resolve([]);
      })
  );
