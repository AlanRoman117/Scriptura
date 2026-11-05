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
 *
 * What a rename removes is here as well as in tests/unit/mirror.test.ts, because
 * some of its guards are only real against real things: the record has to survive
 * IndexedDB and a reload, a stored handle has to be told from another folder's,
 * asking whether a file is there rests on the real API's NotFoundError, and a
 * second tab has to be a second tab.
 */

interface Harness {
  /** Files opened for writing, by name, in order. */
  writes: string[];
  failing: string[];
  refused: string[];
  lapsed: boolean;
  /** Files the app removed, by name, in order. */
  removed: string[];
  /** The directory the picker hands out next. */
  folder: string;
  /** Writes wait here while it is set. */
  hold: Promise<void> | null;
  open: number;
  mostOpen: number;
}

const harness = (page: Page) => page.addInitScript(() => {
  const h: Harness = {
    writes: [],
    failing: [],
    refused: [],
    lapsed: false,
    removed: [],
    folder: 'mirror',
    hold: null,
    open: 0,
    mostOpen: 0,
  };
  const w = window as unknown as { __mirror: Harness; showDirectoryPicker: unknown };
  w.__mirror = h;
  w.showDirectoryPicker = async () =>
    (await navigator.storage.getDirectory()).getDirectoryHandle(h.folder, { create: true });

  const directory = FileSystemDirectoryHandle.prototype;
  const removeEntry = directory.removeEntry;
  directory.removeEntry = async function (this: FileSystemDirectoryHandle, ...args) {
    await removeEntry.apply(this, args);
    h.removed.push(args[0]);
  };

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

const setHarness = (page: Page, change: Partial<Pick<Harness, 'failing' | 'lapsed' | 'folder'>>) =>
  page.evaluate((c) => {
    Object.assign((window as unknown as { __mirror: Harness }).__mirror, c);
  }, change);

const fileText = (page: Page, name: string, folder = 'mirror'): Promise<string> =>
  page.evaluate(
    async ([wanted, where]) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(where, { create: true });
      const handle = await dir.getFileHandle(wanted).catch(() => null);
      return handle ? (await handle.getFile()).text() : '';
    },
    [name, folder]
  );

/** Every file in the folder, from the folder itself rather than from the harness. */
const fileNames = (page: Page, folder = 'mirror'): Promise<string[]> =>
  page.evaluate(async (where) => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(where, { create: true });
    const names: string[] = [];
    for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(name);
    return names.sort();
  }, folder);

/** A file the reader put there themselves, which the app has never heard of. */
async function putFile(page: Page, name: string, text: string, folder = 'mirror') {
  await page.evaluate(
    async ([wanted, body, where]) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(where, { create: true });
      const stream = await (await dir.getFileHandle(wanted, { create: true })).createWritable();
      await stream.write(body);
      await stream.close();
    },
    [name, text, folder]
  );
  // The app did not write it, so the harness's count must not say so.
  await clearWrites(page);
}

const removals = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __mirror: Harness }).__mirror.removed);

/** The file recorded for a note, from the settings row beside the folder handle. */
const recordedName = (page: Page, id: string): Promise<string | null> =>
  page.evaluate(
    (note) =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open('scriptura');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('settings').objectStore('settings').get('notesDirectoryFiles');
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result?.files?.[note]?.name ?? null);
          };
        };
      }),
    id
  );

async function retitle(page: Page, id: string, title: string) {
  await page.getByTestId('note-select').selectOption(id);
  await page.getByTestId('note-title').fill(title);
}

const fileHas = (page: Page, name: string, text: string) =>
  expect.poll(() => fileText(page, name), { timeout: 15_000 }).toContain(text);

const storedTitles = (page: Page): Promise<string[]> =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('scriptura');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('notes').objectStore('notes').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            open.result.close();
            resolve((all.result as { title: string }[]).map((note) => note.title));
          };
        };
      })
  );

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
async function chooseFolder(page: Page, expected: number, button = 'Mirror to a folder') {
  await page.getByTestId('settings-open').click();
  await page.getByRole('button', { name: button }).click();
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

test.describe('a rename', () => {
  test('removes the file it replaced, and nothing else in the folder', async ({ page }) => {
    await openWith(page, [titled(0, 'Old'), titled(1, 'Other')]);
    await putFile(page, 'my own file.md', 'the reader’s');
    await chooseFolder(page, 2);

    await retitle(page, 'note-0', 'New');

    await expect.poll(() => fileNames(page), { timeout: 15_000 }).toEqual(['New.md', 'Other.md', 'my own file.md']);
    expect(await fileText(page, 'New.md')).toContain('Body 0');
    expect(await fileText(page, 'my own file.md')).toBe('the reader’s');
    expect(await removals(page)).toEqual(['Old.md']);
  });

  test('twice in a row leaves one file, not a trail', async ({ page }) => {
    await openWith(page, [titled(0, 'Ps')]);
    await chooseFolder(page, 1);

    await retitle(page, 'note-0', 'Psal');
    await expect.poll(() => fileNames(page), { timeout: 15_000 }).toEqual(['Psal.md']);
    await retitle(page, 'note-0', 'Psalm');
    await expect.poll(() => fileNames(page), { timeout: 15_000 }).toEqual(['Psalm.md']);
  });

  test('two notes swapping titles keep both files', async ({ page }) => {
    await openWith(page, [titled(0, 'First'), titled(1, 'Second')]);
    await chooseFolder(page, 2);

    // Through a third name, as a reader must. It is the moment each holds the other's.
    await retitle(page, 'note-0', 'Passing');
    await retitle(page, 'note-1', 'First');
    await retitle(page, 'note-0', 'Second');

    await expect.poll(() => fileNames(page), { timeout: 15_000 }).toEqual(['First.md', 'Second.md']);
    await fileHas(page, 'First.md', 'Body 1');
    await fileHas(page, 'Second.md', 'Body 0');
  });

  test('that fails to write keeps the old file', async ({ page }) => {
    await openWith(page, [titled(0, 'Old')]);
    await chooseFolder(page, 1);

    await setHarness(page, { failing: ['New.md'] });
    await retitle(page, 'note-0', 'New');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __mirror: Harness }).__mirror.refused.length), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    expect(await fileNames(page)).toContain('Old.md');
    expect(await removals(page)).toEqual([]);
  });

  test('after a reload still removes the old file, because the record outlived the page', async ({ page }) => {
    await openWith(page, [titled(0, 'Old')]);
    await chooseFolder(page, 1);
    await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('Old.md');

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('note-select').locator('option')).toHaveCount(1);

    await retitle(page, 'note-0', 'New');

    await expect.poll(() => fileNames(page), { timeout: 15_000 }).toEqual(['New.md']);
    await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('New.md');
  });

  test('reaching a different folder removes nothing there: its record starts empty', async ({ page }) => {
    await openWith(page, [titled(0, 'Old')]);
    await chooseFolder(page, 1);
    await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('Old.md');

    // Permission has lapsed, so the rename reaches no folder and the record
    // still says Old.md. Then a new folder, holding a file of that very name.
    await setHarness(page, { lapsed: true });
    await retitle(page, 'note-0', 'New');
    await expect.poll(async () => (await storedTitles(page)).join(), { timeout: 15_000 }).toContain('New');
    await putFile(page, 'Old.md', 'the reader’s, in the other folder', 'mirror-b');
    await setHarness(page, { lapsed: false, folder: 'mirror-b' });
    await chooseFolder(page, 1, 'Choose another folder');

    await expect.poll(() => fileNames(page, 'mirror-b'), { timeout: 15_000 }).toEqual(['New.md', 'Old.md']);
    expect(await fileText(page, 'Old.md', 'mirror-b')).toBe('the reader’s, in the other folder');
    expect(await removals(page)).toEqual([]);
    expect(await fileNames(page)).toEqual(['Old.md']);
  });

  test('by case alone leaves the note in one file, however the disk spells it', async ({ page }) => {
    await openWith(page, [titled(0, 'psalm')]);
    await chooseFolder(page, 1);

    await retitle(page, 'note-0', 'Psalm');

    // The private file system keeps "psalm.md" and "Psalm.md" apart here and
    // may fold them elsewhere. Either way the note ends in one file: the old
    // spelling goes only where the new one was not already there.
    await fileHas(page, 'Psalm.md', '# Psalm');
    await expect.poll(() => fileNames(page).then((names) => names.length), { timeout: 15_000 }).toBe(1);
    expect(await fileText(page, 'Psalm.md')).toContain('Body 0');
  });

  test('never removes a file that was in the folder before the app wrote to it', async ({ page }) => {
    await openWith(page, [titled(0, 'Old')]);
    await putFile(page, 'Old.md', 'the reader’s');
    await chooseFolder(page, 1);
    // Overwritten, as it always was. Removing it is what is new, and not done.
    await fileHas(page, 'Old.md', 'Body 0');

    await retitle(page, 'note-0', 'New');

    // The record is written after the removals, so once it says New.md the
    // removals are all in.
    await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('New.md');
    expect(await fileNames(page)).toEqual(['New.md', 'Old.md']);
    expect(await removals(page)).toEqual([]);
    expect(await fileText(page, 'Old.md')).toContain('Body 0');
  });

  test('seen from a second tab holding an older copy of the note removes nothing', async ({ page, context }) => {
    await openWith(page, [titled(0, 'Old'), titled(1, 'Other')]);
    await chooseFolder(page, 2);

    // A second tab, loaded while the note is still "Old", and left there.
    const other = await context.newPage();
    await harness(other);
    await other.goto('/');
    await expect(other.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(other.getByTestId('note-select').locator('option')).toHaveCount(2);

    await retitle(page, 'note-0', 'New');
    await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('New.md');
    expect(await fileNames(page)).toEqual(['New.md', 'Other.md']);

    // The second tab's first autosave writes every note it has, "Old" included,
    // and the record tells it that note's file is New.md, which it does not own.
    // It used to remove it. The store says the note moved on after this tab
    // loaded it, which is reason enough to leave the file alone.
    await typeIn(other, 'note-1', 'abc');
    await fileHas(other, 'Other.md', 'abc');
    await expect.poll(() => recordedName(other, 'note-0'), { timeout: 15_000 }).toBe('Old.md');

    expect(await fileText(page, 'New.md')).toContain('Body 0');
    expect(await removals(other)).toEqual([]);
  });

  test('with a damaged record removes nothing, and the record is whole again after', async ({ page }) => {
    await openWith(page, [titled(0, 'Old')]);
    await chooseFolder(page, 1);
    await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('Old.md');

    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('scriptura');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const tx = open.result.transaction('settings', 'readwrite');
            tx.objectStore('settings').put({ files: 'not what it should be' }, 'notesDirectoryFiles');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        })
    );

    await retitle(page, 'note-0', 'New');

    await expect.poll(() => fileNames(page), { timeout: 15_000 }).toEqual(['New.md', 'Old.md']);
    await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('New.md');
    expect(await removals(page)).toEqual([]);
  });
});

test('deleting a note keeps its file, and forgets it', async ({ page }) => {
  await openWith(page, [titled(0, 'Keep me'), titled(1, 'Other')]);
  await chooseFolder(page, 2);
  await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe('Keep me.md');

  await page.getByTestId('note-select').selectOption('note-0');
  await page.getByTestId('note-delete').click();
  await page.getByTestId('confirm-accept').click();
  await expect(page.getByTestId('note-select').locator('option')).toHaveCount(1);

  // Nothing writes until the next autosave, which is where the note is forgotten.
  await typeIn(page, 'note-1', 'abc');
  await fileHas(page, 'Other.md', 'abc');
  await expect.poll(() => recordedName(page, 'note-0'), { timeout: 15_000 }).toBe(null);

  expect(await fileText(page, 'Keep me.md')).toContain('Body 0');
  expect(await removals(page)).toEqual([]);
});
