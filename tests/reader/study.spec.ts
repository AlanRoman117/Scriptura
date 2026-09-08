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

/**
 * Put the caret at a character offset in the note body.
 *
 * ⚠️ Not `ControlOrMeta+Home`. That alias is right for Cmd+A and Cmd+C, but
 * macOS does not bind Home to "start of document" in a text field at all — so
 * on a Mac the caret simply stayed where it was and these tests asserted
 * against whatever the click happened to land on. Ubuntu passed; macOS did not.
 *
 * The offset is set directly and then a real ArrowRight moves it one further,
 * because React's handler listens for key and click events — a synthesised
 * `select` does not reach it.
 */
async function caretAt(page: import('@playwright/test').Page, needle: string, into = 1) {
  const body = page.getByTestId('notes-surface');
  await body.click();
  await body.evaluate(
    (el: HTMLTextAreaElement, [text, offset]) => {
      const at = el.value.indexOf(text) + (offset as number) - 1;
      el.setSelectionRange(at, at);
    },
    [needle, into] as [string, number]
  );
  await page.keyboard.press('ArrowRight');
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
    // The slug so it resolves in any translation, and the translation so a
    // quote from one version is distinguishable from a quote of the same verse
    // from another.
    await expect(body).toContainText('[[john 1:1@bsb]]');
  });

  test('Link inserts just the reference, and leaves a line to write on', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-3').click();
    await page.getByTestId('link-3').click();
    // The trailing blank line is the point: you insert, then write about it.
    await expect(page.getByTestId('notes-surface')).toHaveValue('[[john 1:3@bsb]]\n\n');
  });

  test('the cursor lands on the blank line after an insertion', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();

    const surface = page.getByTestId('notes-surface');
    await expect
      .poll(() => surface.evaluate((el: HTMLTextAreaElement) => el.selectionStart))
      .toBe(await surface.evaluate((el: HTMLTextAreaElement) => el.value.length));

    // So typing continues below the quote rather than inside it.
    await page.keyboard.type('This is the claim.');
    await expect(surface).toContainText('[[john 1:1@bsb]]\n\nThis is the claim.');
  });

  test('two insertions do not run together', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('link-1').click();
    await page.getByTestId('verse-2').click();
    await page.getByTestId('link-2').click();
    await expect(page.getByTestId('notes-surface')).toHaveValue(
      '[[john 1:1@bsb]]\n\n[[john 1:2@bsb]]\n\n'
    );
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

    // Move the cursor back up into the first section.
    await caretAt(page, 'some text');
    await expect(page.getByTestId('notes-heading')).toContainText('Opening');
  });

  test('no heading is shown when the note has none', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').fill('Just prose, no headings.');
    await expect(page.getByTestId('notes-heading')).toHaveCount(0);
  });
});

test.describe('following a link back', () => {
  test('the cursor inside a link offers to open it', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    const body = page.getByTestId('notes-surface');
    await body.fill('a thought about [[psalms 23:1]] here');

    // A textarea has nothing to click, so the cursor is how a link is picked.
    await caretAt(page, 'psalms 23:1');

    const follow = page.getByTestId('notes-follow-link');
    await expect(follow).toContainText('Psalms 23:1');
    await follow.click();
    await expect(page.getByTestId('chapter-title')).toContainText('Psalms 23');
  });

  test('no link under the cursor, no button', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').fill('just prose');
    await expect(page.getByTestId('notes-follow-link')).toHaveCount(0);
  });

  test('a link naming a translation that is not here says so', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    const body = page.getByTestId('notes-surface');
    await body.fill('[[john 3:16@kjv]]');
    await caretAt(page, 'john 3:16');

    // Honest rather than silently landing in a different version.
    await expect(page.getByTestId('notes-follow-link')).toContainText('KJV — not downloaded');
  });
});
