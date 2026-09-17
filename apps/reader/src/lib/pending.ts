/**
 * Work the app is holding that has not reached IndexedDB yet.
 *
 * Note edits are debounced — writing on every keystroke would be wasteful — so
 * for up to 600ms the newest words exist only in memory. Anything about to end
 * the page (a reload onto a new version, the tab going to the background on a
 * phone, where the system may discard it) must flush them first. App registers
 * how; whoever is about to end the page asks. One function, module-level, for
 * the same reason the announcer is: the component that needs it (the update
 * notice) is mounted beside App, not inside it.
 */

let flush: (() => Promise<void>) | null = null;

/** App's way to save everything pending. Pass null on unmount. */
export function setPendingFlush(next: (() => Promise<void>) | null): void {
  flush = next;
}

/** Save whatever is pending, now. Resolves when it has been written (or failed). */
export function flushPending(): Promise<void> {
  return flush ? flush() : Promise.resolve();
}
