import { expect, test } from '@playwright/test';

/**
 * The reading surface.
 *
 * These run against the built app, not the dev server, because the service
 * worker and the precache manifest only exist in a production build — and the
 * offline promise is the product.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
});

test('opens on scripture, from the bundled translation', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('John 1');
  await expect(page.getByTestId('chapter')).toContainText('In the beginning was the Word');
});

test('Bible sits left of notes, both visible by default', async ({ page }) => {
  const bible = page.getByTestId('pane-bible');
  const notes = page.getByTestId('pane-notes');
  await expect(bible).toBeVisible();
  await expect(notes).toBeVisible();

  const [b, n] = [await bible.boundingBox(), await notes.boundingBox()];
  expect(b!.x).toBeLessThan(n!.x);
});

test('either pane can be maximized and restored', async ({ page }) => {
  await page.getByTestId('maximize-bible').click();
  await expect(page.getByTestId('pane-notes')).toBeHidden();
  await expect(page.getByTestId('pane-bible')).toBeVisible();

  await page.getByTestId('maximize-bible').click();
  await expect(page.getByTestId('pane-notes')).toBeVisible();

  await page.getByTestId('maximize-notes').click();
  await expect(page.getByTestId('pane-bible')).toBeHidden();
});

test('the divider resizes, and does so from the keyboard', async ({ page }) => {
  const divider = page.getByTestId('divider');
  const before = (await page.getByTestId('pane-bible').boundingBox())!.width;

  // Keyboard, not just pointer: a drag-only divider is unusable without a mouse.
  await divider.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');

  const after = (await page.getByTestId('pane-bible').boundingBox())!.width;
  expect(after).toBeLessThan(before);
  await expect(divider).toHaveAttribute('aria-valuenow', /\d+/);
});

test('navigating book and chapter changes the text', async ({ page }) => {
  await page.getByTestId('book-select').selectOption('genesis');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Genesis 1');
  await expect(page.getByTestId('chapter')).toContainText('In the beginning God created');

  await page.getByTestId('chapter-select').selectOption('3');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Genesis 3');
});

test('a public-domain translation shows no attribution notice', async ({ page }) => {
  // bsb is public domain. The notice is a CC BY-SA obligation, not decoration,
  // so it must not appear where it is not owed.
  await expect(page.getByTestId('attribution')).toHaveCount(0);
});

test('the page title says where you are (2.4.2, 2.4.8)', async ({ page }) => {
  await expect(page).toHaveTitle('John 1 · BSB · Scriptura');
  await page.getByTestId('book-select').selectOption('genesis');
  await page.getByTestId('chapter-select').selectOption('3');
  await expect(page).toHaveTitle('Genesis 3 · BSB · Scriptura');
  await page.getByTestId('marks-open').click();
  await expect(page).toHaveTitle('Marks · Scriptura');
});

test('the first Tab offers to skip to the scripture (2.4.1)', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByTestId('skip-scripture');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  // Focus lands in the main landmark, past the bar and the search box.
  const landed = await page.evaluate(() => !!document.activeElement?.closest('main'));
  expect(landed).toBe(true);
});
