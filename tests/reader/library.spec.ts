import { expect, test } from '@playwright/test';

/**
 * Stage 4: more than one translation.
 *
 * Downloads run against the compiled API the contract suite already starts,
 * proxied through vite's preview server at /api — so these exercise the real
 * `/translations/:id/full.json`, not a fixture.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** Download a translation and wait until the row says it is here. */
async function install(page: import('@playwright/test').Page, id: string) {
  await page.getByTestId('library-open').click();
  await page.getByTestId(`library-get-${id}`).click();
  await expect(page.getByTestId(`library-read-${id}`)).toBeVisible({ timeout: 60_000 });
}

test.describe('the library', () => {
  test('lists every translation, grouped by language, before anything is downloaded', async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId('library-open').click();

    const panel = page.getByTestId('library-panel');
    await expect(panel.locator('.library__item')).toHaveCount(11);
    // Grouped by language, and headed by its *name*: metadata.json stores an
    // ISO code, and "en / es / fr / ja" is correct data but a useless heading.
    await expect(panel.locator('.library__language')).toHaveText([
      'English',
      'French',
      'Japanese',
      'Spanish',
    ]);

    // The bundled one is already here and is what we are reading.
    await expect(page.getByTestId('library-read-bsb')).toBeDisabled();
    await expect(page.getByTestId('library-bsb')).toContainText('Reading');
    // Everything else is an offer, with its weight stated up front.
    await expect(page.getByTestId('library-get-kjv')).toBeVisible();
    await expect(page.getByTestId('library-kjv')).toContainText(/~\d+\.\d+ MB/);
  });

  test('the bundled translation cannot be removed', async ({ page }) => {
    // Deleting it would leave nothing to read the moment the network goes,
    // which is the one state this app exists to survive.
    await open(page);
    await page.getByTestId('library-open').click();
    await expect(page.getByTestId('library-remove-bsb')).toHaveCount(0);
  });

  test('a translation downloads, becomes readable, and changes the text', async ({ page }) => {
    await open(page);
    await install(page, 'rv1909');

    await page.getByTestId('library-read-rv1909').click();
    // The panel closes onto the text, now in Spanish, with the localized name.
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1');
    // rv1909 sets the opening word as a drop cap ("EN el principio"), so match
    // from the second word rather than pinning that typographic quirk.
    await expect(page.getByTestId('chapter')).toContainText('el principio era el Verbo');
  });

  test('the choice survives a reload', async ({ page }) => {
    await open(page);
    await install(page, 'rv1909');
    await page.getByTestId('library-read-rv1909').click();
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1');

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1');
  });

  test('a translation can be removed again, and notes are untouched', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('note-title').fill('Kept');

    await install(page, 'kjv');
    await page.getByTestId('library-remove-kjv').click();
    await expect(page.getByTestId('library-get-kjv')).toBeVisible();

    await expect(page.getByTestId('note-title')).toHaveValue('Kept');
  });

  test('offline, the library still lists what exists and says why a download failed', async ({
    page,
    context,
  }) => {
    await open(page);
    await context.setOffline(true);

    await page.getByTestId('library-open').click();
    // The catalogue ships with the app, so the shelf is never blank.
    await expect(page.getByTestId('library-panel').locator('.library__item')).toHaveCount(11);

    await page.getByTestId('library-get-kjv').click();
    await expect(page.getByTestId('library-error-kjv')).toContainText(/connection/i);
    // And the row is still offerable once the network is back.
    await expect(page.getByTestId('library-get-kjv')).toBeEnabled();
  });
});

test.describe('reading two translations at once', () => {
  test('shows the chapter side by side, aligned on the verse number', async ({ page }) => {
    await open(page);
    await install(page, 'rv1909');
    await page.getByTestId('library-compare-rv1909').click();

    const compare = page.getByTestId('compare');
    await expect(compare).toBeVisible();
    await expect(compare.locator('thead th')).toHaveCount(3); // number + two columns
    await expect(compare).toContainText('In the beginning was the Word');
    await expect(compare).toContainText('el principio era el Verbo');

    // Rows are keyed on the verse number, so row 1 holds verse 1 in both.
    const first = compare.locator('tbody tr').first();
    await expect(first).toHaveAttribute('data-verse', '1');
    await expect(first.locator('td')).toHaveCount(2);
  });

  test('a column can be dropped, and the first one cannot', async ({ page }) => {
    await open(page);
    await install(page, 'rv1909');
    await page.getByTestId('library-compare-rv1909').click();
    await expect(page.getByTestId('compare')).toBeVisible();

    // No drop control on the translation being read — it is the primary text.
    await expect(page.getByTestId('compare-drop-bsb')).toHaveCount(0);
    await page.getByTestId('compare-drop-rv1909').click();
    await expect(page.getByTestId('compare')).toHaveCount(0);
    await expect(page.getByTestId('chapter-title')).toContainText('John 1');
  });

  test('a verse can be quoted from either column, in that column\'s words', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await install(page, 'rv1909');
    await page.getByTestId('library-compare-rv1909').click();

    await page.getByTestId('compare-quote-rv1909-1').click();
    const body = page.getByTestId('notes-surface');
    await expect(body).toContainText('el principio era el Verbo');
    await expect(body).toContainText('(RV1909)');
    // The slug so it resolves in any translation, and the qualifier so this
    // quote is distinguishable from the same verse quoted from another column.
    await expect(body).toContainText('[[john 1:1@rv1909]]');
  });

  test('a CC BY-SA translation carries its notice into the comparison', async ({ page }) => {
    // The obligation follows the material, and in a comparison the material
    // can be in any column.
    await open(page);
    await install(page, 'vbl');
    await page.getByTestId('library-compare-vbl').click();

    await expect(page.getByTestId('compare')).toBeVisible();
    await expect(page.getByTestId('compare-attribution')).toContainText(/CC BY-SA/i);
  });
});

test.describe('a link back to the version it quoted', () => {
  test('following it switches translation', async ({ page }) => {
    await open(page);
    await install(page, 'rv1909');
    await page.getByTestId('library-close').click();

    // Quote the same verse from both translations, into one note.
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();

    await page.getByTestId('library-open').click();
    await page.getByTestId('library-read-rv1909').click();
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1');
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();

    // Two quotes of John 1:1, and two links that say which is which.
    const body = page.getByTestId('notes-surface');
    await expect(body).toContainText('[[john 1:1@bsb]]');
    await expect(body).toContainText('[[john 1:1@rv1909]]');

    // Following the BSB one goes back to BSB, from inside RV1909.
    //
    // Placed by offset rather than by arrow keys: ArrowDown in a textarea moves
    // by *visual* line, so it lands somewhere different whenever the wrapping
    // changes. The real ArrowRight afterwards is what React's handler sees — a
    // synthesised `select` does not reach it.
    await body.click();
    await body.evaluate((el: HTMLTextAreaElement) => {
      const at = el.value.indexOf('[[john 1:1@bsb]]');
      el.setSelectionRange(at + 2, at + 2);
    });
    await page.keyboard.press('ArrowRight');

    const follow = page.getByTestId('notes-follow-link');
    await expect(follow).toContainText('(BSB)');
    await follow.click();
    await expect(page.getByTestId('chapter-title')).toContainText('John 1');
  });
});
