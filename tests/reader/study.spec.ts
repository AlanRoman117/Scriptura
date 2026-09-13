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

  /**
   * Type a reference and press Enter, once it actually resolves to `destination`.
   *
   * ⚠️ Waiting for the jump button to be *visible* is not enough. The reference
   * resolves in an effect, so between typing and that effect React re-renders
   * with the new query and the **previous** reference — the button is on screen
   * the whole time, showing the old destination, and Enter jumps back to where
   * it already was. Waiting on the button's *text* is what proves the new
   * reference has landed. Ubuntu won that race; macOS lost it.
   */
  async function jumpTo(
    page: import('@playwright/test').Page,
    reference: string,
    destination: string
  ) {
    await page.getByTestId('search-input').fill(reference);
    await expect(page.getByTestId('search-jump')).toContainText(destination);
    await page.getByTestId('search-input').press('Enter');
  }

  test('Enter goes straight there', async ({ page }) => {
    await open(page);
    await jumpTo(page, 'Genesis 3', 'Genesis 3');
    await expect(page.getByTestId('chapter-title')).toContainText('Genesis 3');
  });

  test('the panel comes back when a second reference is typed', async ({ page }) => {
    // Enter closes the panel to clear the way for the passage. The input keeps
    // focus, so nothing would reopen it and a reader typing again would see no
    // feedback at all.
    await open(page);
    await jumpTo(page, 'Genesis 3', 'Genesis 3');
    await expect(page.getByTestId('search-panel')).toBeHidden();

    await page.getByTestId('search-input').fill('Psalms 23');
    await expect(page.getByTestId('search-jump')).toBeVisible();
  });

  test('an abbreviation and a book number both resolve', async ({ page }) => {
    await open(page);
    // ⚠️ Never assert John 1 here: the reader opens on it, so the assertion
    // would pass without anything having happened — which is exactly how the
    // lost-Enter race stayed invisible until macOS lost it twice in a row.
    for (const [input, expected] of [
      ['Jhn 3:16', 'John 3'],
      ['43 1:1', 'John 1'],
      ['19 23', 'Psalms 23'],
    ]) {
      await jumpTo(page, input, expected);
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
      // For *this* query: the count element is visible throughout, still
      // showing the previous answer, so waiting on visibility alone reads the
      // wrong number with no retry.
      await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', q);
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

  test('quoting with no note open starts one, says so, and reports the save', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    await expect(page.getByTestId('notes-surface')).toContainText('In the beginning was the Word');
    await expect(page.getByTestId('announcer')).toHaveText('Quoted John 1:1 in a new note');
    // This path used to save without reporting it, leaving the status line
    // blank. Asserting "Saved" is safe here, and only here: nothing else has
    // written a note that could have reported it first.
    await expect(page.getByTestId('note-status')).toContainText('Saved');
  });
});

test.describe('knowing that it worked', () => {
  test('every insertion is confirmed in words, beside the note and to a screen reader', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();

    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    // The Quote button went with the actions row, so the confirmation is where
    // the quote went: the note's status line…
    await expect(page.getByTestId('note-done')).toHaveText('✓ Quoted John 1:1');
    // …and the announcer, which also names the note. The mark is decoration;
    // the words are what is said.
    await expect(page.getByTestId('announcer')).toHaveText('Quoted John 1:1 in “Untitled”');

    await page.getByTestId('verse-2').click();
    await page.getByTestId('link-2').click();
    await expect(page.getByTestId('note-done')).toHaveText('✓ Linked John 1:2');
    await expect(page.getByTestId('announcer')).toHaveText('Linked John 1:2 in “Untitled”');

    await page.getByTestId('search-input').fill('In the beginning God created');
    await page.getByTestId('search-panel').locator('.search__insert').first().click();
    await expect(page.getByTestId('note-done')).toHaveText('✓ Quoted Genesis 1:1');
  });

  test('the same quote twice is announced twice', async ({ page }) => {
    // The announcer drops a repeated message, which is right for a search count
    // typed letter by letter and wrong for two presses of Quote. Every text the
    // region takes on is recorded, since the second announcement looks exactly
    // like the first once it has landed.
    await open(page);
    await page.getByTestId('note-new').click();
    await page.evaluate(() => {
      const region = document.querySelector('[data-testid="announcer"]')!;
      const said: string[] = ((window as unknown as { said: string[] }).said = []);
      new MutationObserver(() => {
        const text = region.textContent?.trim();
        if (text) said.push(text);
      }).observe(region, { childList: true, subtree: true, characterData: true });
    });

    const surface = page.getByTestId('notes-surface');
    for (let quotes = 1; quotes <= 2; quotes++) {
      await page.getByTestId('verse-1').click();
      await page.getByTestId('quote-1').click();
      await expect.poll(async () => (await surface.inputValue()).split('[[john 1:1@bsb]]').length - 1).toBe(quotes);
    }
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { said: string[] }).said.filter((t) => t === 'Quoted John 1:1 in “Untitled”').length
        )
      )
      .toBe(2);
  });

  test('the confirmation waits for the next action, not for a timer', async ({ page }) => {
    await page.clock.install();
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    const done = page.getByTestId('note-done');
    await expect(done).toBeVisible();

    // Two minutes on, every timer the page had set has fired, and it is still
    // there (2.2.3). A toast that fades is gone before some people read it.
    await page.clock.fastForward('02:00');
    await expect(done).toBeVisible();

    // Writing is the next action…
    await page.keyboard.type('Why the Word?');
    await expect(done).toHaveCount(0);

    // …and so is moving on to another chapter.
    await page.getByTestId('verse-3').click();
    await page.getByTestId('quote-3').click();
    await expect(done).toBeVisible();
    await page.getByTestId('chapter-select').selectOption('2');
    await expect(page.getByTestId('chapter-title')).toContainText('John 2');
    await expect(done).toHaveCount(0);
  });

  test('with the Bible maximized, it waits where the notes come back', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('maximize-bible').click();
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();

    // The note is hidden, so its status line cannot say it.
    const bar = page.getByTestId('layout-done');
    await expect(bar).toContainText('Quoted John 1:1');
    await page.getByTestId('layout-done-show').click();

    await expect(page.getByTestId('layout')).toHaveAttribute('data-maximized', 'none');
    await expect(page.getByTestId('notes-surface')).toContainText('In the beginning was the Word');
    // Focus goes to the note rather than to nothing, with the caret after the quote.
    await expect(page.getByTestId('notes-surface')).toBeFocused();
    // Seeing the note is what the confirmation stood in for.
    await expect(bar).toHaveCount(0);
    await expect(page.getByTestId('note-done')).toHaveCount(0);
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

test.describe('the suggestions from the keyboard and under a keyboard', () => {
  test('Enter on a text query opens every match (the way out on a phone)', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('living water');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'living water');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('search-results')).toBeVisible();
    expect(Number(await page.getByTestId('results-total').textContent())).toBeGreaterThan(0);
  });

  test('Tab reaches the suggestions without closing them; Down arrow jumps in', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('Psalms 23');
    await expect(page.getByTestId('search-jump')).toContainText('Psalms 23');

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('search-panel')).toBeVisible();
    await expect(page.getByTestId('search-jump')).toBeFocused();

    await page.getByTestId('search-input').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('search-jump')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chapter-title')).toContainText('Psalms 23');
  });

  test('the close button hides them, typing brings them back, and focus stays in the box', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('love');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'love');
    await page.getByTestId('search-close').click();
    await expect(page.getByTestId('search-panel')).toBeHidden();
    await expect(page.getByTestId('search-input')).toBeFocused();
    await page.keyboard.type('d');
    await expect(page.getByTestId('search-panel')).toBeVisible();
  });

  test('a press outside closes them; the whole-words option does not submit', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('love');
    await expect(page.getByTestId('search-panel')).toBeVisible();
    await page.getByTestId('search-whole-word').focus();
    await page.keyboard.press('Enter');
    // Still here, still reading John 1: Enter on a checkbox is not a submit.
    await expect(page.getByTestId('search-panel')).toBeVisible();
    await expect(page.getByTestId('search-results')).toHaveCount(0);
    // Somewhere the panel does not cover and no control sits: the empty top
    // margin of the notes pane, clear of the divider's buttons on its left edge.
    await page.getByTestId('pane-notes').click({ position: { x: 120, y: 12 } });
    await expect(page.getByTestId('search-panel')).toBeHidden();
  });
});
