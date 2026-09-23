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

/**
 * Write in the plain textarea rather than the live editor. Preview is offered
 * only there, so every test of the preview starts with this. Call it before
 * the page first loads.
 */
export const usePlainEditor = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('scriptura-display') || '{}');
      localStorage.setItem('scriptura-display', JSON.stringify({ ...stored, editor: 'plain' }));
    } catch {
      /* the test fails on its own if this did not take */
    }
  });

/**
 * Whether a live editor marker (`##`, `**`) is drawn. A hidden one is clipped
 * to a pixel rather than removed — it stays in the accessibility tree — so
 * Playwright still counts it visible, and `toBeHidden()` cannot tell.
 */
export const markerShown = (marker: Locator): Promise<boolean> =>
  marker.evaluate((el) => el.getBoundingClientRect().width > 2);

/** Change the note editor the way a reader does, from Settings, on a page already open. */
export async function switchEditor(page: Page, editor: 'live' | 'plain'): Promise<void> {
  await page.getByTestId('settings-open').click();
  await page.getByTestId('pref-editor').selectOption(editor);
  await page.getByTestId('settings-close').click();
}
