import { expect, test } from '@playwright/test';
import { axeFor, describeViolations } from '../helpers/axe';
import { chineseBible } from '../helpers/chinese-bible';
import { returnWith, storedIds } from '../helpers/stored-bible';

/**
 * A reader who holds a translation the library has stopped offering.
 *
 * `cuvs`, `cuvt` and `ostervald` were withdrawn on 2026-11-01 for carrying a
 * licence they did not have. A device that downloaded one keeps it: nothing is
 * deleted behind its owner's back. So it has to go on opening, and the reader
 * has to be able to see it and remove it, with no catalog entry to draw it from.
 */
const CUVS = chineseBible('cuvs', 'zh-Hans', '新标点和合本');
const NOTICE = /No longer offered/;

test.describe('a stored translation the catalog no longer lists', () => {
  test('it still opens, with nothing deleted, and stays where it was being read', async ({ page }) => {
    await returnWith(page, CUVS, { active: 'cuvs' });
    await expect(page.getByTestId('chapter-title')).toContainText('约翰福音');
    await expect(page.getByTestId('library-open')).toHaveText('CUVS');
    expect(await storedIds(page)).toContain('cuvs');

    await page.reload();
    await expect(page.getByTestId('chapter-title')).toContainText('约翰福音', { timeout: 30_000 });
    expect(await storedIds(page)).toContain('cuvs');
  });

  test('the library shows it, says it is not offered, and repeats no licence claim', async ({ page }) => {
    await returnWith(page, CUVS, { active: 'cuvs' });
    await page.getByTestId('library-open').click();

    const row = page.getByTestId('library-cuvs');
    await expect(row).toContainText('新标点和合本');
    await expect(row).toContainText('Reading');
    await expect(page.getByTestId('library-no-longer-offered-cuvs')).toHaveText(NOTICE);
    // Its stored record says "Public domain · 1919". That record is why it left.
    await expect(row).not.toContainText('Public domain');
    await expect(row).not.toContainText('1919');
    // Under its language, and counted with what is on the device.
    await expect(page.getByTestId('library-panel').locator('.library__language')).toContainText(['Simplified Chinese']);
    await expect(page.getByTestId('library-storage')).toContainText('2 on this device');
    // It cannot be downloaded again; what is being read cannot be removed until
    // another is open, as with any translation.
    await expect(page.getByTestId('library-get-cuvs')).toHaveCount(0);
    await expect(page.getByTestId('library-remove-cuvs')).toBeDisabled();
  });

  test('its row has no accessibility violation, with the panel open', async ({ page }) => {
    await returnWith(page, CUVS, { active: 'cuvs' });
    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-cuvs')).toBeVisible();
    const results = await axeFor(page).analyze();
    expect(results.violations, describeViolations(results)).toEqual([]);
  });

  test('the reader can move off it and remove it, and is told what that means', async ({ page }) => {
    await returnWith(page, CUVS, { active: 'cuvs' });
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-read-kjv').click();
    await expect(page.getByTestId('chapter-title')).toContainText('John 1');

    await page.getByTestId('library-open').click();
    await page.getByTestId('library-remove-cuvs').click();
    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toContainText('新标点和合本');
    await expect(dialog).toContainText(NOTICE);
    await expect(dialog).toContainText('Your notes and marks are not changed.');
    // The usual promise would be false here.
    await expect(dialog).not.toContainText('You can download it again');
    await page.getByTestId('confirm-accept').click();

    await expect(page.getByTestId('library-cuvs')).toHaveCount(0);
    await expect.poll(() => storedIds(page)).not.toContain('cuvs');
    // Nothing takes its place, so focus goes somewhere rather than to the page (2.4.3).
    await expect(page.getByTestId('library-close')).toBeFocused();
    await expect(page.getByTestId('library-storage')).toContainText('1 on this device');

    await page.reload();
    await expect(page.getByTestId('chapter-title')).toContainText('John 1', { timeout: 30_000 });
    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-kjv')).toBeVisible();
    await expect(page.getByTestId('library-cuvs')).toHaveCount(0);
  });

  test('one that is not being read can be read and compared from its row', async ({ page }) => {
    await returnWith(page, CUVS);
    await expect(page.getByTestId('chapter-title')).toContainText('John 1');
    await page.getByTestId('library-open').click();
    await page.getByTestId('library-compare-cuvs').click();
    await expect(page.getByTestId('compare-drop-cuvs')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('library-open').click();
    await page.getByTestId('library-read-cuvs').click();
    await expect(page.getByTestId('chapter-title')).toContainText('约翰福音');
  });

  test('Help’s abbreviations do not list it: the table is of what is offered', async ({ page }) => {
    await returnWith(page, CUVS, { active: 'cuvs' });
    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-cuvs')).toBeVisible();
    await page.getByTestId('library-close').click();
    await page.getByTestId('help-open').click();
    const help = page.getByTestId('help-panel');
    await expect(help.locator('table abbr', { hasText: 'KJV' })).toHaveCount(1);
    await expect(help.locator('table abbr', { hasText: 'CUVS' })).toHaveCount(0);
  });

  test('with no catalog at all, it is still there and nothing is called withdrawn', async ({ page }) => {
    await returnWith(page, CUVS, { active: 'cuvs' });
    await page.route('**/bible/catalog.json', (route) => route.abort());
    await page.route('**/api/translations.json', (route) => route.abort());
    await page.reload();
    await expect(page.getByTestId('chapter-title')).toContainText('约翰福音', { timeout: 30_000 });

    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-cuvs')).toBeVisible();
    await expect(page.getByTestId('library-kjv')).toBeVisible();
    await expect(page.getByTestId('library-no-longer-offered-cuvs')).toHaveCount(0);
    await expect(page.getByTestId('library-cuvs')).toContainText('Public domain');
  });
});

test.describe('a withdrawn translation that is not on the device', () => {
  test('a stored choice of it opens the default, with no error and no row', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('scriptura');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const tx = open.result.transaction('settings', 'readwrite');
            tx.objectStore('settings').put({ active: 'cuvs', compareWith: ['ostervald'] }, 'reading');
            tx.oncomplete = () => {
              open.result.close();
              resolve();
            };
          };
        })
    );
    await page.reload();
    await expect(page.getByTestId('chapter-title')).toContainText('John 1', { timeout: 30_000 });
    await expect(page.getByTestId('library-open')).toHaveText('KJV');
    // A column for a comparison that cannot arrive is dropped, not left waiting.
    await expect(page.getByTestId('compare-drop-ostervald')).toHaveCount(0);

    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-kjv')).toBeVisible();
    await expect(page.getByTestId('library-cuvs')).toHaveCount(0);
    await expect(page.getByTestId('library-ostervald')).toHaveCount(0);
  });

  test('a note’s link naming one says it is not here, and does not leave the Bible open', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('note-new').click();
    const body = page.getByTestId('notes-surface');
    await body.fill('[[john 3:16@ostervald]]');
    await body.click();
    // As study.spec.ts's caretAt: set the offset, then a real key React listens for.
    await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
    await page.keyboard.press('ArrowRight');
    const follow = page.getByTestId('notes-follow-link');
    await expect(follow).toContainText('OSTERVALD — not downloaded');
    await follow.click();
    await expect(page.getByTestId('chapter-title')).toContainText('John 3');
    await expect(page.getByTestId('library-open')).toHaveText('KJV');
  });
});
