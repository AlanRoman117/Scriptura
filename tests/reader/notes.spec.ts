import { expect, test } from '@playwright/test';

/**
 * Notes, highlights, and the durability that makes them worth writing.
 *
 * The shape of the storage tests is borrowed from PrepWise's
 * storage-resilience.spec.js: the ways the database can fail are the ways this
 * app can fail, so they are tested directly rather than assumed away.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/**
 * Wait until the note is really in IndexedDB.
 *
 * Asserting on the "Saved" label is racy: creating a note also reports Saved,
 * so a later edit can match the earlier message and the test then reloads
 * before the autosave debounce has flushed. Reading the store is the thing the
 * test actually cares about.
 */
async function persisted(page: import('@playwright/test').Page, title: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          (wanted) =>
            new Promise<boolean>((resolve) => {
              const open = indexedDB.open('scriptura');
              open.onsuccess = () => {
                const req = open.result.transaction('notes').objectStore('notes').getAll();
                req.onsuccess = () =>
                  resolve((req.result as { title: string }[]).some((n) => n.title === wanted));
                req.onerror = () => resolve(false);
              };
              open.onerror = () => resolve(false);
            }),
          title
        ),
      { timeout: 10_000 }
    )
    .toBe(true);
}

test.describe('notes', () => {
  test('a note survives a reload', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('On John 1');
    await page.getByTestId('notes-surface').fill('The Word was with God.');
    await persisted(page, 'On John 1');

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('note-title')).toHaveValue('On John 1');
    await expect(page.getByTestId('notes-surface')).toHaveValue('The Word was with God.');
  });

  test('notes can be created, switched between, and deleted', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('First');
    await persisted(page, 'First');

    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('Second');
    await persisted(page, 'Second');

    await expect(page.getByTestId('note-select').locator('option')).toHaveCount(2);

    // Delete asks before destroying work.
    await page.getByTestId('note-delete').click();
    await expect(page.getByTestId('note-delete')).toContainText('Sure?');
    await page.getByTestId('note-delete').click();
    await expect(page.getByTestId('note-select').locator('option')).toHaveCount(1);
  });
});

test.describe('marking a verse', () => {
  test('the whole verse is the target, and the swatches open beneath it', async ({ page }) => {
    await open(page);
    const verse = page.locator('.verse[data-verse="2"]');

    // No control to find first: click the prose itself.
    await verse.click();
    await expect(verse).toHaveAttribute('data-open', 'true');

    const swatches = verse.locator('.swatches');
    await expect(swatches).toBeVisible();

    // "Centred below" is the whole point of the change — the old row sat at the
    // end of the line, which is a long way from wherever the click landed.
    const [box, row] = [await verse.boundingBox(), await swatches.boundingBox()];
    expect(box && row).toBeTruthy();
    expect(row!.y).toBeGreaterThan(box!.y);
    const drift = Math.abs(row!.x + row!.width / 2 - (box!.x + box!.width / 2));
    expect(drift).toBeLessThan(24);
  });

  test('selecting text to read does not open the swatches', async ({ page }) => {
    await open(page);
    const verse = page.locator('.verse[data-verse="2"]');
    const box = (await verse.boundingBox())!;

    // A real drag across the words: mousedown, move, mouseup — which fires a
    // click with a non-collapsed selection. Reading and copying must not trip
    // the swatches, or the verse becomes hostile to the thing it is for.
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).not.toBe('');
    await expect(verse).not.toHaveAttribute('data-open', /./);
  });

  test('the verse number keeps a keyboard path to the same action', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-1').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.verse[data-verse="1"]')).toHaveAttribute('data-open', 'true');

    await page.keyboard.press('Escape');
    await expect(page.locator('.verse[data-verse="1"]')).not.toHaveAttribute('data-open', /./);
  });
});

test.describe('highlights', () => {
  test('a highlight is coloured, recoloured, cleared, and survives a reload', async ({ page }) => {
    await open(page);

    await page.getByTestId('verse-1').click();
    await page.getByTestId('swatch-amber').click();
    const verse = page.locator('.verse[data-verse="1"]');
    await expect(verse).toHaveAttribute('data-highlight', 'amber');

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.verse[data-verse="1"]')).toHaveAttribute('data-highlight', 'amber');

    // A different colour recolours; the same colour clears.
    await page.getByTestId('verse-1').click();
    await page.getByTestId('swatch-sky').click();
    await expect(page.locator('.verse[data-verse="1"]')).toHaveAttribute('data-highlight', 'sky');

    await page.getByTestId('verse-1').click();
    await page.getByTestId('swatch-sky').click();
    await expect(page.locator('.verse[data-verse="1"]')).not.toHaveAttribute('data-highlight', /./);
  });

  test('a highlight is anchored to the slug, so it follows the verse across books', async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId('verse-1').click();
    await page.getByTestId('swatch-mint').click();

    // Navigate away and back: the anchor is {book_slug, chapter, verse}, not a
    // position in the rendered list.
    await page.getByTestId('book-select').selectOption('genesis');
    await expect(page.locator('.verse[data-verse="1"]')).not.toHaveAttribute('data-highlight', /./);

    await page.getByTestId('book-select').selectOption('john');
    await expect(page.locator('.verse[data-verse="1"]')).toHaveAttribute('data-highlight', 'mint');
  });
});

test.describe('colours as collections', () => {
  /** Marks are keyed on the passage, so read the store to prove the key shape. */
  const storedIds = (page: import('@playwright/test').Page) =>
    page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const req = indexedDB.open('scriptura');
          req.onsuccess = () => {
            const keys = req.result
              .transaction('highlights')
              .objectStore('highlights')
              .getAllKeys();
            keys.onsuccess = () => resolve(keys.result as string[]);
            keys.onerror = () => resolve([]);
          };
          req.onerror = () => resolve([]);
        })
    );

  async function mark(page: import('@playwright/test').Page, verse: number, color: string) {
    await page.locator(`.verse[data-verse="${verse}"]`).click();
    await page.getByTestId(`swatch-${color}`).click();
    await expect(page.locator(`.verse[data-verse="${verse}"]`)).toHaveAttribute(
      'data-highlight',
      color
    );
  }

  test('each colour lists the verses marked with it', async ({ page }) => {
    await open(page);
    await mark(page, 1, 'amber');
    await mark(page, 3, 'amber');
    await mark(page, 2, 'sky');

    await page.getByTestId('marks-open').click();
    await expect(page.getByTestId('marks-count-amber')).toHaveText('2');
    await expect(page.getByTestId('marks-count-sky')).toHaveText('1');
    await expect(page.getByTestId('marks-count-rose')).toHaveText('0');

    // Canonical order within a colour: a subject is walked in order, not by
    // the accident of when each verse was noticed.
    const refs = page.getByTestId('marks-group-amber').locator('.marks__ref-label');
    await expect(refs).toHaveText(['John 1:1', 'John 1:3']);
  });

  test('a colour can be named for the subject it tracks, and the name sticks', async ({ page }) => {
    await open(page);
    await mark(page, 1, 'rose');
    await page.getByTestId('marks-open').click();
    await page.getByTestId('marks-label-rose').fill('Covenant promises');

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('marks-open').click();
    await expect(page.getByTestId('marks-label-rose')).toHaveValue('Covenant promises');
  });

  test('a mark jumps to its verse, and can be removed from the list', async ({ page }) => {
    await open(page);
    await mark(page, 2, 'mint');
    await page.getByTestId('book-select').selectOption('genesis');

    await page.getByTestId('marks-open').click();
    await page.getByTestId('marks-go-john-1-2').click();
    await expect(page.getByTestId('chapter-title')).toContainText('John 1');
    await expect(page.locator('.verse[data-verse="2"]')).toHaveAttribute('data-highlight', 'mint');

    await page.getByTestId('marks-open').click();
    await page.getByTestId('marks-remove-john-1-2').click();
    await expect(page.getByTestId('marks-count-mint')).toHaveText('0');
    await page.getByTestId('marks-close').click();
    await expect(page.locator('.verse[data-verse="2"]')).not.toHaveAttribute('data-highlight', /./);
  });

  test('a mark is keyed on the passage, not the translation it was made in', async ({ page }) => {
    // This is what lets a colour stay a collection once Stage 4 can switch
    // translations: `bsb:john:1:1` would empty every list on the switch.
    await open(page);
    await mark(page, 1, 'violet');
    await expect.poll(() => storedIds(page)).toContain('john:1:1');
  });
});

test.describe('export', () => {
  test('downloads every note as Markdown in a readable .zip', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('Exported note');
    await page.getByTestId('notes-surface').fill('Body text.');
    await persisted(page, 'Exported note');

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('note-export').click(),
    ]).then(([d]) => d);

    expect(download.suggestedFilename()).toMatch(/^scriptura-notes-\d{4}-\d{2}-\d{2}\.zip$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});

test.describe('storage resilience', () => {
  test('a damaged notes store does not stop the reader', async ({ page }) => {
    // One store failing must not take the others down. Scripture still renders
    // even if the notes database is unreadable.
    await page.addInitScript(() => {
      const realOpen = indexedDB.open.bind(indexedDB);
      // @ts-expect-error test shim
      indexedDB.open = (...args: unknown[]) => {
        const request = realOpen(...(args as [string, number?]));
        request.addEventListener('success', () => {
          const db = request.result;
          const realTx = db.transaction.bind(db);
          // @ts-expect-error test shim
          db.transaction = (stores: string | string[], ...rest: unknown[]) => {
            const names = Array.isArray(stores) ? stores : [stores];
            if (names.includes('notes')) throw new DOMException('boom', 'InvalidStateError');
            return realTx(stores as string, ...(rest as []));
          };
        });
        return request;
      };
    });

    await open(page);
    await expect(page.getByTestId('chapter')).toContainText('In the beginning was the Word');
    await expect(page.getByTestId('notes')).toBeVisible();
  });

  test('a failed write is reported, not swallowed', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await expect(page.getByTestId('note-status')).toContainText('Saved');
    await page.getByTestId('note-title').fill('Doomed');
    await persisted(page, 'Doomed');

    // Break writes only after the note exists, so the failure is on save.
    await page.evaluate(() => {
      const proto = IDBObjectStore.prototype;
      proto.put = function put() {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });

    await page.getByTestId('notes-surface').fill('This cannot be stored.');
    await expect(page.getByTestId('note-status')).toContainText('Could not save', {
      timeout: 10_000,
    });
  });
});

test.describe('durability', () => {
  test('says plainly where notes live, and offers a way out', async ({ page }) => {
    await open(page);
    const banner = page.getByTestId('durability');
    // Shown when there is something to act on; always with an export action.
    if (await banner.isVisible()) {
      await expect(page.getByTestId('durability-export')).toBeVisible();
    }
  });
});
