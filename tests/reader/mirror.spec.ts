import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { storedBodies } from '../helpers/note';

/**
 * "Save to a folder" through the app: what an autosave costs the reader's disk.
 *
 * It rewrote every note on every autosave. An audit measured 3 keystrokes in 1
 * of 100 notes at 1 IndexedDB put (5 KB) and 100 files (508 KB), every 600 ms
 * pause. Now it is the one file.
 *
 * The folder is real as far as the app can tell, and goes nowhere near a disk
 * the reader would see. A hand-made handle cannot be used, because the app keeps
 * the handle in IndexedDB and a plain object with functions does not survive
 * being stored there. So the picker hands out a directory in the origin-private
 * file system, private to this test's browser context, and the prototypes are
 * wrapped to count writes, fail one on demand, and take permission away.
 *
 * No assertion waits for time to pass. The note edited is the last in the list,
 * so the rewrite-everything code has written every other file by the time this
 * one changes, and the writes counted then are the whole story.
 */

interface Harness {
  /** Files opened for writing, by name, in order. */
  writes: string[];
  failing: string[];
  refused: string[];
  lapsed: boolean;
  /** Writes wait here while it is set. */
  hold: Promise<void> | null;
  open: number;
  mostOpen: number;
}

const harness = (page: Page) => page.addInitScript(() => {
  const h: Harness = { writes: [], failing: [], refused: [], lapsed: false, hold: null, open: 0, mostOpen: 0 };
  const w = window as unknown as { __mirror: Harness; showDirectoryPicker: unknown };
  w.__mirror = h;
  w.showDirectoryPicker = async () =>
    (await navigator.storage.getDirectory()).getDirectoryHandle('mirror', { create: true });

  const file = FileSystemFileHandle.prototype;
  const createWritable = file.createWritable;
  file.createWritable = async function (this: FileSystemFileHandle, ...args) {
    if (h.failing.includes(this.name)) {
      h.refused.push(this.name);
      throw new DOMException('Refused by the test', 'NoModificationAllowedError');
    }
    h.mostOpen = Math.max(h.mostOpen, ++h.open);
    if (h.hold) await h.hold;
    const stream = await createWritable.apply(this, args);
    h.writes.push(this.name);
    const close = stream.close;
    stream.close = async function (this: FileSystemWritableFileStream) {
      await close.call(this);
      h.open--;
    };
    return stream;
  };

  const permissions = FileSystemHandle.prototype as unknown as {
    queryPermission: (d: unknown) => Promise<PermissionState>;
  };
  const queryPermission = permissions.queryPermission;
  permissions.queryPermission = function (this: FileSystemHandle, d: unknown) {
    return h.lapsed ? Promise.resolve('prompt') : queryPermission.call(this, d);
  };
});

const writes = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __mirror: Harness }).__mirror.writes);

const clearWrites = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __mirror: Harness }).__mirror.writes.length = 0;
  });

const setHarness = (page: Page, change: Partial<Pick<Harness, 'failing' | 'lapsed'>>) =>
  page.evaluate((c) => {
    Object.assign((window as unknown as { __mirror: Harness }).__mirror, c);
  }, change);

const fileText = (page: Page, name: string): Promise<string> =>
  page.evaluate(async (wanted) => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('mirror', { create: true });
    const handle = await dir.getFileHandle(wanted).catch(() => null);
    return handle ? (await handle.getFile()).text() : '';
  }, name);

const fileHas = (page: Page, name: string, text: string) =>
  expect.poll(() => fileText(page, name), { timeout: 15_000 }).toContain(text);

const titled = (n: number, title = `Note ${String(n).padStart(3, '0')}`) => ({
  id: `note-${n}`,
  title,
  body: `Body ${n}`,
  created: 1000,
  // Newest first is how the list loads, so note 0 is at the top.
  updated: 100_000 - n,
});

/** Open with these notes already stored, as a reader with a history would. */
async function openWith(page: Page, notes: ReturnType<typeof titled>[]) {
  await harness(page);
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('scriptura');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('notes', 'readwrite');
          for (const row of rows) tx.objectStore('notes').put(row, row.id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    notes
  );
  await page.reload();
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('note-select').locator('option')).toHaveCount(notes.length);
}

/** Choose the folder from Settings and wait out the full write it starts. */
async function chooseFolder(page: Page, expected: number) {
  await page.getByTestId('settings-open').click();
  await page.getByRole('button', { name: 'Mirror to a folder' }).click();
  await expect.poll(() => writes(page).then((w) => w.length), { timeout: 30_000 }).toBe(expected);
  await page.getByTestId('settings-close').click();
  await clearWrites(page);
}

/** Three keystrokes in a note, the way a reader makes them. */
async function typeIn(page: Page, id: string, text: string) {
  await page.getByTestId('note-select').selectOption(id);
  await page.getByTestId('notes-surface').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

for (const count of [1, 100]) {
  test(`an autosave among ${count} note(s) writes one file`, async ({ page }) => {
    const notes = Array.from({ length: count }, (_, i) => titled(i));
    await openWith(page, notes);
    await chooseFolder(page, count);

    const last = notes[count - 1];
    await typeIn(page, last.id, 'abc');
    await fileHas(page, `${last.title}.md`, 'abc');

    // Named rather than counted: on a loaded machine the three keys can fall
    // either side of an autosave, and the same file twice is not the bug.
    expect([...new Set(await writes(page))]).toEqual([`${last.title}.md`]);
  });
}

test('two notes with one title keep their own files', async ({ page }) => {
  await openWith(page, [titled(0, 'Psalm'), titled(1, 'Psalm')]);
  await chooseFolder(page, 2);

  await typeIn(page, 'note-1', 'abc');
  await fileHas(page, 'Psalm (2).md', 'abc');

  expect([...new Set(await writes(page))]).toEqual(['Psalm (2).md']);
  expect(await fileText(page, 'Psalm.md')).toContain('Body 0');
});

test('"T", "T" and "T (2)" are three files', async ({ page }) => {
  await openWith(page, [titled(0, 'T'), titled(1, 'T'), titled(2, 'T (2)')]);
  // Three files is the whole point: the old names were two, so this would wait
  // for a third write that never came.
  await chooseFolder(page, 3);

  expect(await fileText(page, 'T.md')).toContain('Body 0');
  expect(await fileText(page, 'T (3).md')).toContain('Body 1');
  expect(await fileText(page, 'T (2).md')).toContain('Body 2');
});

test('a note edited and reloaded to the top of the list keeps its file', async ({ page }) => {
  await openWith(page, [titled(0, 'Psalm'), titled(1, 'Psalm')]);
  await chooseFolder(page, 2);
  await typeIn(page, 'note-1', 'abc');
  await fileHas(page, 'Psalm (2).md', 'abc');

  // `listNotes` sorts by `updated`, so note 1 is now at the top of the list. Its
  // first autosave after the reload is a full write, which is what would swap them.
  await page.reload();
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('note-select').locator('option').first()).toHaveAttribute('value', 'note-1');
  await typeIn(page, 'note-1', 'xyz');

  await fileHas(page, 'Psalm (2).md', 'abcxyz');
  await fileHas(page, 'Psalm.md', 'Body 0');
  expect(await fileText(page, 'Psalm.md')).not.toContain('abc');
});

test('a write that failed is made at the next autosave', async ({ page }) => {
  await openWith(page, [titled(0), titled(1), titled(2)]);
  await chooseFolder(page, 3);

  await setHarness(page, { failing: ['Note 002.md'] });
  await typeIn(page, 'note-2', 'abc');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mirror: Harness }).__mirror.refused.length), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  expect(await fileText(page, 'Note 002.md')).not.toContain('abc');

  await setHarness(page, { failing: [] });
  await typeIn(page, 'note-1', 'xyz');
  await fileHas(page, 'Note 002.md', 'abc');
  await fileHas(page, 'Note 001.md', 'xyz');
  expect([...new Set(await writes(page))].sort()).toEqual(['Note 001.md', 'Note 002.md']);
});

test('what was typed while permission had lapsed is written when it returns', async ({ page }) => {
  await openWith(page, [titled(0), titled(1), titled(2)]);
  await chooseFolder(page, 3);

  await setHarness(page, { lapsed: true });
  await typeIn(page, 'note-2', 'abc');
  await expect.poll(async () => (await storedBodies(page)).join(), { timeout: 15_000 }).toContain('abc');
  expect(await fileText(page, 'Note 002.md')).not.toContain('abc');

  await setHarness(page, { lapsed: false });
  await typeIn(page, 'note-1', 'xyz');
  await fileHas(page, 'Note 002.md', 'abc');
  await fileHas(page, 'Note 001.md', 'xyz');
  expect([...new Set(await writes(page))].sort()).toEqual(['Note 001.md', 'Note 002.md']);
});

test('the first autosave after a page load writes every note, and the next only one', async ({ page }) => {
  await openWith(page, [titled(0), titled(1), titled(2)]);
  await chooseFolder(page, 3);

  await page.reload();
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('note-select').locator('option')).toHaveCount(3);

  // The page has no record of the folder any more, and cannot say what an
  // earlier failure or another tab left there.
  await page.getByTestId('settings-open').click();
  await expect(page.getByRole('button', { name: 'Choose another folder' })).toBeVisible();
  await page.getByTestId('settings-close').click();
  await typeIn(page, 'note-2', 'abc');
  // Last in the list, so its text arriving means the others have gone first.
  await fileHas(page, 'Note 002.md', 'abc');
  expect(new Set(await writes(page)).size).toBe(3);

  await clearWrites(page);
  await typeIn(page, 'note-1', 'xyz');
  await fileHas(page, 'Note 001.md', 'xyz');
  expect([...new Set(await writes(page))]).toEqual(['Note 001.md']);
});

test('two autosaves never write at once, and the newest text is what stays', async ({ page }) => {
  await openWith(page, [titled(0), titled(1)]);
  await chooseFolder(page, 2);

  await page.evaluate(() => {
    const h = (window as unknown as { __mirror: Harness; __release: () => void }).__mirror;
    h.mostOpen = 0;
    h.hold = new Promise<void>((release) => {
      (window as unknown as { __release: () => void }).__release = release;
    });
  });

  // The first autosave stalls on its write, and the second arrives behind it.
  await typeIn(page, 'note-1', 'abc');
  await expect.poll(async () => (await storedBodies(page)).join(), { timeout: 15_000 }).toContain('abc');
  await page.keyboard.type('def');
  await expect.poll(async () => (await storedBodies(page)).join(), { timeout: 15_000 }).toContain('abcdef');

  await page.evaluate(() => {
    const w = window as unknown as { __mirror: Harness; __release: () => void };
    w.__mirror.hold = null;
    w.__release();
  });

  await fileHas(page, 'Note 001.md', 'abcdef');
  expect(await page.evaluate(() => (window as unknown as { __mirror: Harness }).__mirror.mostOpen)).toBe(1);
});
