import { expect, test } from '@playwright/test';

/**
 * Stage 3: finding a passage, and getting it into a note.
 *
 * Search runs entirely against the translation in memory, using the *server's*
 * matcher — so these also assert that online and offline results agree.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

test.describe('one box for finding things', () => {
  test('a reference jumps, and the verse is brought into view', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('Psalms 119:105');
    await expect(page.getByTestId('search-jump')).toContainText('Psalms 119:105');
    await page.getByTestId('search-jump').click();

    await expect(page.getByTestId('chapter-title')).toContainText('Psalms 119');
    await expect(page.locator('.verse[data-verse="105"]')).toBeInViewport();
  });

  test('Enter goes straight there', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('Genesis 3');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('chapter-title')).toContainText('Genesis 3');
  });

  test('an abbreviation and a book number both resolve', async ({ page }) => {
    await open(page);
    for (const [input, expected] of [
      ['Jhn 1:1', 'John 1'],
      ['43 3:16', 'John 3'],
    ]) {
      await page.getByTestId('search-input').fill(input);
      await page.getByTestId('search-input').press('Enter');
      await expect(page.getByTestId('chapter-title')).toContainText(expected);
    }
  });

  test('text search finds verses and reports a count', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('living water');
    await expect(page.getByTestId('search-count')).toContainText(/match/);
    await expect(page.getByTestId('search-panel').locator('.search__result')).not.toHaveCount(0);
  });

  test('quoted phrases and -exclusions narrow the result set', async ({ page }) => {
    await open(page);
    const countFor = async (q: string) => {
      await page.getByTestId('search-input').fill(q);
      await expect(page.getByTestId('search-count')).toBeVisible();
      const text = (await page.getByTestId('search-count').textContent()) ?? '';
      return Number(text.match(/^(\d+)/)?.[1] ?? 0);
    };

    const broad = await countFor('God');
    const narrowed = await countFor('God -love');
    expect(narrowed).toBeLessThan(broad);
    expect(narrowed).toBeGreaterThan(0);

    // A quoted phrase is stricter than the same words unquoted.
    const loose = await countFor('the beginning');
    const phrase = await countFor('"in the beginning"');
    expect(phrase).toBeLessThanOrEqual(loose);
  });

  test('clicking a result navigates to it', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('In the beginning God created');
    const first = page.getByTestId('search-panel').locator('.search__ref').first();
    await expect(first).toContainText('Genesis 1:1');
    await first.click();
    await expect(page.getByTestId('chapter-title')).toContainText('Genesis 1');
  });
});

test.describe('getting scripture into a note', () => {
  test('Quote inserts a blockquote with a citation and a link', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();

    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();

    const body = page.getByTestId('notes-surface');
    await expect(body).toContainText('> In the beginning was the Word');
    await expect(body).toContainText('— John 1:1 (BSB)');
    // The link is stored as the slug, so it resolves in any translation.
    await expect(body).toContainText('[[john 1:1]]');
  });

  test('Link inserts just the reference', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-3').click();
    await page.getByTestId('link-3').click();
    await expect(page.getByTestId('notes-surface')).toHaveValue('[[john 1:3]]');
  });

  test('a search result can be inserted without leaving the search', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('search-input').fill('In the beginning God created');
    await page.getByTestId('search-panel').locator('.search__insert').first().click();
    await expect(page.getByTestId('notes-surface')).toContainText('In the beginning God created');
  });

  test('quoting with no note open starts one', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    await expect(page.getByTestId('notes-surface')).toContainText('In the beginning was the Word');
  });
});

test.describe('keeping your place in a note', () => {
  test('the heading the cursor sits under stays visible', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();

    const body = page.getByTestId('notes-surface');
    await body.fill('# Opening\n\nsome text\n\n## On the Word\n\nmore text here');
    await expect(page.getByTestId('notes-heading')).toContainText('On the Word');

    // Move the cursor back up into the first section, by keyboard — a
    // synthesised `select` event does not reach React's handler.
    await body.click();
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('notes-heading')).toContainText('Opening');
  });

  test('no heading is shown when the note has none', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').fill('Just prose, no headings.');
    await expect(page.getByTestId('notes-heading')).toHaveCount(0);
  });
});
