import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { noteValue } from '../helpers/note';

/**
 * Several verses, selected and acted on as one.
 *
 * A reader pressed a verse and its actions opened; pressing another moved
 * them, so a passage went into a note a verse and a reference at a time. Now
 * a press adds a verse and pressing it again takes it out, the one row of
 * actions applies to everything selected, and a passage is quoted as one
 * block under one reference (lib/selection.ts).
 *
 * The accessible path is not an afterthought to a modifier key: every verse
 * number is a toggle button, a long range is three presses with no chord and
 * no drag, and what is selected is said in words as well as shown.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

const verse = (page: Page, n: number) => page.locator(`.verse[data-verse="${n}"]`);
const text = (page: Page, n: number) => page.locator(`.verse[data-verse="${n}"] .verse__text`);
const selected = (page: Page) =>
  page.locator('.verse[data-open]').evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.verse)));
const row = (page: Page) => page.getByTestId('verse-actions');
const announcer = (page: Page) => page.getByTestId('announcer');
const scrollTop = (page: Page) => page.getByTestId('pane-bible').evaluate((el) => el.scrollTop);

/**
 * Every message the announcer is given from here on, in order. The region's
 * text alone cannot tell the same words said twice from words said once.
 */
async function recordAnnouncements(page: Page) {
  await page.evaluate(() => {
    const region = document.querySelector('[data-testid="announcer"]')!;
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    new MutationObserver(() => {
      const words = region.textContent?.trim();
      if (words) said.push(words);
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
}
const announcements = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said);

test.describe('a press adds a verse, and pressing it again removes it', () => {
  test('one row serves the whole selection, and says what it holds in words', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    // One verse is as it always was: no summary, the row named for the verse.
    await expect(row(page)).toHaveAccessibleName('Actions for John 1:3');
    await expect(page.getByTestId('verse-summary')).toHaveCount(0);

    await text(page, 4).click();
    await text(page, 5).click();
    expect(await selected(page)).toEqual([3, 4, 5]);
    await expect(row(page)).toHaveCount(1);
    await expect(row(page)).toHaveAccessibleName('Actions for 3 verses: John 1:3-5');
    await expect(page.getByTestId('verse-summary')).toHaveText('3 verses · John 1:3-5');
    // The book's name is the Bible's word, in the Bible's language (3.1.2).
    await expect(page.getByTestId('verse-summary').locator('span[lang]')).toHaveText('John');
    await expect(page.getByTestId('verse-summary').locator('span[lang]')).toHaveAttribute('lang', 'en');

    // Out again, from the middle: what is left is two separate verses.
    await text(page, 4).click();
    expect(await selected(page)).toEqual([3, 5]);
    await expect(page.getByTestId('verse-summary')).toHaveText('2 verses · John 1:3, 5');

    await text(page, 3).click();
    await text(page, 5).click();
    expect(await selected(page)).toEqual([]);
    await expect(row(page)).toHaveCount(0);
  });

  // The page must not reflow under the pointer as a group grows. The row
  // stays under the first verse pressed, so nothing above it ever moves; what
  // is below it moves once, by the line that says what the group holds, when
  // a second verse makes it a group — and not again.
  test('adding verses by pressing their text leaves the row where it is, and the page still', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    await expect(row(page)).toBeVisible();
    // Where each verse is in the chapter, not on the screen: the pane may
    // scroll to bring a pressed verse clear of the row, which is not a reflow.
    const within = (selector: string) =>
      page.evaluate((sel) => {
        const pane = document.querySelector('[data-testid="pane-bible"]')!;
        return Math.round(document.querySelector(sel)!.getBoundingClientRect().top + pane.scrollTop);
      }, selector);
    const tops = () => Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) => within(`.verse[data-verse="${n}"]`)));
    const alone = await tops();

    await text(page, 5).click();
    const group = await tops();
    // Verses 1 to 3 are above the row: untouched.
    expect(group.slice(0, 3)).toEqual(alone.slice(0, 3));
    // The rest moved down together, by the one line that says what the group
    // holds and no more.
    const shift = group[3] - alone[3];
    expect(shift).toBeGreaterThanOrEqual(0);
    expect(shift).toBeLessThan(60);
    // (To the pixel, give or take the rounding of a fractional line height.)
    for (const [i, y] of group.slice(3).entries()) expect(Math.abs(y - alone[3 + i] - shift)).toBeLessThanOrEqual(1);

    // From here on, nothing moves at all — not as verses are added, and not
    // when the gaps are filled and the button that filled them goes.
    await text(page, 7).click();
    await text(page, 1).click();
    await text(page, 8).click();
    expect(await selected(page)).toEqual([1, 3, 5, 7, 8]);
    expect(await tops()).toEqual(group);
    await page.getByTestId('verse-fill').click();
    expect(await selected(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await tops()).toEqual(group);
    // …and it is still the row under verse 3, where it opened.
    await expect(page.locator('.verse[data-verse="3"] + [data-testid="verse-actions"]')).toHaveCount(1);
  });

  test('a new chapter, a panel over the text, or a comparison clears it', async ({ page }) => {
    await open(page);
    await text(page, 1).click();
    await text(page, 2).click();
    await page.getByTestId('chapter-select').selectOption('2');
    await expect(page.getByTestId('chapter-title')).toContainText('2');
    expect(await selected(page)).toEqual([]);

    await text(page, 1).click();
    await text(page, 2).click();
    await page.getByTestId('help-open').click();
    await page.getByTestId('help-open').click();
    await expect(page.getByTestId('chapter')).toBeVisible();
    expect(await selected(page)).toEqual([]);
  });
});

/*
 * Ten or twenty verses must not take ten or twenty presses, and the way to
 * fewer must not be a drag or a chord (2.5.1, 2.5.7): the first, the last,
 * and the button between them.
 */
test.describe('a range without a press per verse', () => {
  test('the first verse, the last, and the button that takes in the rest', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    // No gap, no button.
    await expect(page.getByTestId('verse-fill')).toHaveCount(0);
    await text(page, 12).click();

    const fill = page.getByTestId('verse-fill');
    await expect(fill).toHaveText('Select 3-12');
    const box = (await fill.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await fill.click();

    expect(await selected(page)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    await expect(page.getByTestId('verse-summary')).toHaveText('10 verses · John 1:3-12');
    // Its work done, it goes; the news is said.
    await expect(fill).toHaveCount(0);
    await expect(announcer(page)).toHaveText('10 verses selected: John 1:3-12');
  });

  test('from the keyboard the button hands focus on to Quote when it goes', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-3').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('verse-6').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('verse-fill').focus();
    await page.keyboard.press('Enter');
    expect(await selected(page)).toEqual([3, 4, 5, 6]);
    // Not to the top of the page: to the act a filled range is for.
    await expect(page.getByTestId('quote-6')).toBeFocused();
    await expect(announcer(page)).toHaveText('4 verses selected: John 1:3-6');
  });

  test('Shift and a press takes in everything between, upwards or downwards', async ({ page }) => {
    await open(page);
    await text(page, 5).click();
    await text(page, 9).click({ modifiers: ['Shift'] });
    expect(await selected(page)).toEqual([5, 6, 7, 8, 9]);
    await text(page, 2).click({ modifiers: ['Shift'] });
    expect(await selected(page)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    // It did not become a text selection instead.
    expect(await page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(true);
  });

  // Shift and a press is how a browser stretches a text selection. With no
  // verse selected it stays the browser's.
  test('with nothing selected, Shift and a press is left alone', async ({ page }) => {
    await open(page);
    await text(page, 4).click({ modifiers: ['Shift'] });
    expect((await selected(page)).length).toBeLessThanOrEqual(1);
    expect(await page.getByTestId('verse-fill').count()).toBe(0);
  });
});

/*
 * The whole verse is the pointer's target, and its number the keyboard's. A
 * number is a toggle button now: with several verses selected the one row of
 * actions belongs to no single number, so it cannot be that number's
 * disclosure.
 */
test.describe('from the keyboard, and to a screen reader', () => {
  test('a verse number is a toggle named for its verse', async ({ page }) => {
    await open(page);
    const number = page.getByTestId('verse-2');
    await expect(number).toHaveAccessibleName('Select John 1:2');
    await expect(number).toHaveAttribute('aria-pressed', 'false');
    await expect(number).not.toHaveAttribute('aria-expanded', /./);
    await number.focus();
    await page.keyboard.press('Enter');
    await expect(number).toHaveAttribute('aria-pressed', 'true');
    // Its visible text is in its name (2.5.3).
    await expect(number).toHaveText('2');
  });

  test('Enter on a number adds its verse and takes focus to the row, which has come to it', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-2').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('swatch-amber')).toBeFocused();

    // On to the next number: one Tab past the row, which is one stop.
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('verse-3')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await selected(page)).toEqual([2, 3]);
    // The row is under verse 3 now, focus is in it, and its name says the news.
    await expect(page.locator('.verse[data-verse="3"] + [data-testid="verse-actions"]')).toHaveCount(1);
    await expect(page.getByTestId('swatch-amber')).toBeFocused();
    await expect(row(page)).toHaveAccessibleName('Actions for 2 verses: John 1:2-3');
    // Back from the row is the number it came from; on from it, the next verse.
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('verse-3')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('verse-4')).toBeFocused();
  });

  test('Enter on a selected number removes its verse, and focus stays on it', async ({ page }) => {
    await open(page);
    for (const n of [2, 3, 4]) {
      await page.getByTestId(`verse-${n}`).focus();
      await page.keyboard.press('Enter');
    }
    await page.getByTestId('verse-3').focus();
    await page.keyboard.press('Enter');
    expect(await selected(page)).toEqual([2, 4]);
    await expect(page.getByTestId('verse-3')).toBeFocused();
    await expect(page.getByTestId('verse-3')).toHaveAttribute('aria-pressed', 'false');
    await expect(announcer(page)).toHaveText('2 verses selected: John 1:2, 4');
  });

  test('Shift+Enter on a number takes in every verse up to it', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-2').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('verse-6').focus();
    await page.keyboard.press('Shift+Enter');
    expect(await selected(page)).toEqual([2, 3, 4, 5, 6]);
  });

  test('what is selected is said when focus does not move to say it', async ({ page }) => {
    await open(page);
    await recordAnnouncements(page);
    // One verse opening its actions is quiet, as it always was. (The region
    // starts empty and is filled a frame after a message, so "it is empty" a
    // moment after the press would prove nothing: the record is read once a
    // later message has landed.)
    await text(page, 3).click();
    await text(page, 5).click();
    await expect(announcer(page)).toHaveText('2 verses selected: John 1:3, 5');
    await text(page, 5).click();
    await expect(announcer(page)).toHaveText('1 verse selected: John 1:3');
    expect(await announcements(page)).toEqual(['2 verses selected: John 1:3, 5', '1 verse selected: John 1:3']);
  });

  // The announcer drops a message that repeats the last one, which is right
  // for a count that has not changed and wrong for an answer to a new act. A
  // group built from the numbers says nothing as it grows — focus says it —
  // so two groups cleared one after the other gave the same words twice, and
  // the second was not said.
  test('the same news about another group is said again', async ({ page }) => {
    await open(page);
    await recordAnnouncements(page);
    for (const pair of [[2, 3], [5, 6]]) {
      for (const n of pair) {
        await page.getByTestId(`verse-${n}`).focus();
        await page.keyboard.press('Enter');
      }
      expect(await selected(page)).toEqual(pair);
      await page.keyboard.press('Escape');
      expect(await selected(page)).toEqual([]);
    }
    await expect.poll(() => announcements(page)).toEqual(['Selection cleared', 'Selection cleared']);
  });

  // With a gap in the selection the row's first control is the button that
  // fills it, so that is where focus lands: the two ends, then Enter.
  test('Enter on a number that leaves a gap lands on the button that fills it', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-3').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('verse-7').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verse-fill')).toBeFocused();
    await expect(page.getByTestId('verse-fill')).toHaveText('Select 3-7');
  });

  // Shift+Enter on the number the row already hangs under takes in the verses
  // between, and moves neither the row nor focus. Nothing said it.
  test('Shift+Enter on the number the row hangs under is said, since focus does not move', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-3').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('verse-7').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.verse[data-verse="7"] + [data-testid="verse-actions"]')).toHaveCount(1);

    await page.getByTestId('verse-7').focus();
    await page.keyboard.press('Shift+Enter');
    expect(await selected(page)).toEqual([3, 4, 5, 6, 7]);
    await expect(page.getByTestId('verse-7')).toBeFocused();
    await expect(announcer(page)).toHaveText('5 verses selected: John 1:3-7');
  });

  // The row is one Tab stop with arrow keys inside it. Its "Select 3-6"
  // button arrives after the row is drawn, and a button's own tabindex is 0:
  // Tab stopped on it and then again on the swatches.
  test('the row is still one Tab stop when the fill button arrives', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    await text(page, 6).click();
    await expect(page.getByTestId('verse-fill')).toBeVisible();
    await expect
      .poll(() => row(page).locator('button').evaluateAll((els) => els.filter((el) => (el as HTMLElement).tabIndex === 0).length))
      .toBe(1);

    await page.getByTestId('verse-3').focus();
    await page.keyboard.press('Tab');
    expect(await row(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('verse-4')).toBeFocused();
    // And the button is reached with the arrow keys, like the rest.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Home');
    await expect(page.getByTestId('verse-fill')).toBeFocused();
  });

  test('Escape clears the whole group and gives focus back to its number; a press outside leaves it', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-2').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('verse-4').focus();
    await page.keyboard.press('Enter');
    expect(await selected(page)).toEqual([2, 4]);

    // A stray press, or the start of a scroll, must not throw a group away.
    await page.getByTestId('chapter-title').click();
    expect(await selected(page)).toEqual([2, 4]);

    await page.getByTestId('swatch-amber').focus();
    await page.keyboard.press('Escape');
    expect(await selected(page)).toEqual([]);
    await expect(page.getByTestId('verse-4')).toBeFocused();
    await expect(announcer(page)).toHaveText('Selection cleared');
  });

  // The verse actions turn outside-press closing off once a second verse is
  // selected. That must not put them back on top of a surface opened later.
  test('a surface opened after the selection still takes Escape first', async ({ page }) => {
    await open(page);
    await text(page, 2).click();
    await page.getByTestId('search-input').fill('love');
    await expect(page.getByTestId('search-count')).toHaveAttribute('data-query', 'love');
    // The suggestions lie over the text, so the second verse is added from
    // its number, which the keyboard reaches under them.
    await page.getByTestId('verse-3').focus();
    await page.keyboard.press('Enter');
    expect(await selected(page)).toEqual([2, 3]);
    await page.keyboard.press('Escape');
    // The suggestions closed; the verses are still selected.
    await expect(page.locator('.search__panel')).toBeHidden();
    expect(await selected(page)).toEqual([2, 3]);
    await page.keyboard.press('Escape');
    expect(await selected(page)).toEqual([]);
  });
});

test.describe('quoting and linking a group', () => {
  test('a range is one block, with verse numbers, under one citation and one link', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('quote-3').click();

    const body = page.getByTestId('notes-surface');
    await expect.poll(() => noteValue(body)).toContain('> — John 1:3-5 (BSB)\n\n[[john 1:3-5@bsb]]\n');
    const note = await noteValue(body);
    expect(note).toMatch(/^> \*\*3\*\* Through Him all things were made/);
    expect(note).toContain('\n>\n> **4** In Him was life');
    expect(note).toContain('\n>\n> **5** The Light shines in the darkness');
    // One citation, one link: not one of each per verse.
    expect(note.match(/— John/g)).toHaveLength(1);
    expect(note.match(/\[\[/g)).toHaveLength(1);

    // Said as one, where it went; and the selection is done with.
    await expect(page.getByTestId('note-done')).toHaveText('✓ Quoted John 1:3-5');
    await expect(announcer(page)).toHaveText('Quoted John 1:3-5 in an untitled note');
    expect(await selected(page)).toEqual([]);
  });

  test('separate verses are one block with a link for each run', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    for (const n of [1, 14, 15]) await text(page, n).click();
    await page.getByTestId('quote-1').click();

    const body = page.getByTestId('notes-surface');
    await expect
      .poll(() => noteValue(body))
      .toContain('> — John 1:1, 14-15 (BSB)\n\n[[john 1:1@bsb]] [[john 1:14-15@bsb]]\n');
    const note = await noteValue(body);
    expect(note).toMatch(/^> \*\*1\*\* In the beginning was the Word/);
    expect(note).toContain('> **14** The Word became flesh');
    await expect(page.getByTestId('note-done')).toHaveText('✓ Quoted John 1:1, 14-15');
  });

  test('one verse is quoted exactly as it always was', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    await text(page, 1).click();
    await page.getByTestId('quote-1').click();
    const body = page.getByTestId('notes-surface');
    await expect.poll(() => noteValue(body)).toContain('[[john 1:1@bsb]]');
    expect(await noteValue(body)).toMatch(/^> In the beginning was the Word[^\n]*\n> — John 1:1 \(BSB\)\n\n\[\[john 1:1@bsb\]\]\n/);
  });

  test('Link writes one link for a range, and one for each run of separate verses', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('link-3').click();
    const body = page.getByTestId('notes-surface');
    await expect(body).toHaveJSProperty('value', '[[john 1:3-5@bsb]]\n\n');
    await expect(page.getByTestId('note-done')).toHaveText('✓ Linked John 1:3-5');

    for (const n of [1, 14]) await text(page, n).click();
    await page.getByTestId('link-1').click();
    await expect(body).toHaveJSProperty('value', '[[john 1:3-5@bsb]]\n\n[[john 1:1@bsb]] [[john 1:14@bsb]]\n\n');
  });

  // A link to a range used to scroll to its first verse and point out only it.
  test('following a link to a range points out the whole of it', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-new').click();
    // Typed, so the caret is left inside the link, which is how one is picked.
    await page.getByTestId('notes-surface').click();
    await page.keyboard.type('[[john 1:3-5@bsb]]');
    await page.getByTestId('chapter-select').selectOption('2');
    await expect(page.getByTestId('chapter-title')).toContainText('2');

    await page.getByTestId('notes-follow-link').click();
    await expect(page.getByTestId('chapter-title')).toContainText('1');
    await expect(page.locator('.verse--flash')).toHaveCount(3);
    expect(await page.locator('.verse--flash').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.verse))).toEqual(['3', '4', '5']);
  });

  // Pointing out a range reads the chapter's verse order. As something the
  // effect answered to, another translation — a new list of the same verses —
  // sent the pane back to a verse jumped to long before and flashed it again.
  test('another translation does not go back to a verse jumped to earlier', async ({ page }) => {
    await open(page);
    await page.getByTestId('search-input').fill('John 1:40');
    await expect(page.getByTestId('search-jump')).toContainText('John 1:40');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.locator('.verse--flash')).toHaveCount(1);
    await expect(page.locator('.verse--flash')).toHaveCount(0, { timeout: 5_000 });
    expect(await scrollTop(page)).toBeGreaterThan(500);

    // Back to the top, by the reader's own scrolling.
    const pane = (await page.getByTestId('pane-bible').boundingBox())!;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height * 0.6);
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -400);
    await expect.poll(() => scrollTop(page)).toBe(0);

    await page.getByTestId('library-open').click();
    await page.getByTestId('library-get-rv1909').click();
    await expect(page.getByTestId('library-read-rv1909')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('library-read-rv1909').click();
    await expect(page.getByTestId('chapter-title')).toContainText('Juan 1');
    // Long enough for an effect to have run and a scroll to have got there;
    // the flash lasts three times as long. (The pane is wherever the list of
    // translations left it, which is not the top — but it is not at verse 40.)
    await page.waitForTimeout(500);
    await expect(page.locator('.verse--flash')).toHaveCount(0);
    expect(await scrollTop(page)).toBeLessThan(1500);
  });
});

/*
 * A colour pressed for a group marks every verse in it — or, when every one
 * already has that colour, clears them. Not a toggle per verse, which would
 * take out the verses already in the collection while adding the rest. And
 * the colour just pressed, pressed again while the verses are still selected,
 * puts each one back as it was: the group stays selected so that it can.
 */
test.describe('a colour on a group', () => {
  const colours = (page: Page, verses: number[]) =>
    Promise.all(verses.map((n) => verse(page, n).getAttribute('data-highlight')));

  test('marks them all, stays selected so it can be seen and undone, and is said', async ({ page }) => {
    await open(page);
    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['amber', 'amber', 'amber']);
    // Still selected, and the swatch is pressed.
    expect(await selected(page)).toEqual([3, 4, 5]);
    await expect(page.getByTestId('swatch-amber')).toHaveAttribute('aria-pressed', 'true');
    await expect(announcer(page)).toHaveText('Marked 3 verses as Amber (amber)');

    // The same press takes it off again, and on again.
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual([null, null, null]);
    await expect(page.getByTestId('swatch-amber')).toHaveAttribute('aria-pressed', 'false');
    await expect(announcer(page)).toHaveText('Cleared Amber (amber) from 3 verses');
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['amber', 'amber', 'amber']);

    // The tint shows through the selection: the wash does not replace it.
    // (Read once the background has finished easing from one to the other.)
    const fill = (n: number) =>
      verse(page, n).evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
        return getComputedStyle(el).backgroundColor;
      });
    const tint = await fill(4);
    expect(tint).not.toBe(await fill(6));
    await page.keyboard.press('Escape');
    expect(await fill(4)).toBe(tint);

    // Selected afresh with all of them amber, the press clears them.
    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual([null, null, null]);
    await expect(announcer(page)).toHaveText('Cleared Amber (amber) from 3 verses');
  });

  // Marking a group moves a verse out of the collection it was in, as marking
  // one verse does. Pressing the colour again used to clear all of them, and
  // the verse that had been in Rose was then in nothing: the press that was
  // meant to undo took the older mark with it.
  test('pressed again, the colour puts each verse back in the collection it was in', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    await page.getByTestId('swatch-rose').click();
    await expect(verse(page, 3)).toHaveAttribute('data-highlight', 'rose');

    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['amber', 'amber', 'amber']);
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['rose', null, null]);
    await expect(announcer(page)).toHaveText('Cleared Amber (amber) from 3 verses');
    await expect(page.getByTestId('swatch-rose')).toHaveAttribute('aria-pressed', 'mixed');

    // Through another colour and back: each press again undoes its own.
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['amber', 'amber', 'amber']);
    await page.getByTestId('swatch-sky').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['sky', 'sky', 'sky']);
    await page.getByTestId('swatch-sky').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['amber', 'amber', 'amber']);
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['rose', null, null]);
  });

  // The undo belongs to the selection it was made in. The same verses selected
  // another time are a fresh group: all amber, a press clears them.
  test('verses selected afresh are not sent back by a press from before', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    await page.getByTestId('swatch-rose').click();
    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['amber', 'amber', 'amber']);
    await page.keyboard.press('Escape');

    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual([null, null, null]);
  });

  test('a mixed group shows a mixed swatch, and one press brings the rest in', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    await page.getByTestId('swatch-amber').click();
    await text(page, 5).click();
    await page.getByTestId('swatch-rose').click();

    for (const n of [3, 4, 5]) await text(page, n).click();
    await expect(page.getByTestId('swatch-amber')).toHaveAttribute('aria-pressed', 'mixed');
    await expect(page.getByTestId('swatch-rose')).toHaveAttribute('aria-pressed', 'mixed');
    await expect(page.getByTestId('swatch-sky')).toHaveAttribute('aria-pressed', 'false');
    // A dashed ring, not a colour, says "some".
    expect(
      await page.getByTestId('swatch-amber').locator('.swatch__disc').evaluate((el) => getComputedStyle(el).outlineStyle)
    ).toBe('dashed');

    // Verse 3 is already amber. A toggle per verse would clear it here.
    await page.getByTestId('swatch-amber').click();
    await expect.poll(() => colours(page, [3, 4, 5])).toEqual(['amber', 'amber', 'amber']);
    await expect(page.getByTestId('swatch-amber')).toHaveAttribute('aria-pressed', 'true');
  });

  test('one verse still closes after a colour, as it always has', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    await page.getByTestId('swatch-sky').click();
    await expect(verse(page, 3)).toHaveAttribute('data-highlight', 'sky');
    await expect(row(page)).toHaveCount(0);
  });
});

test.describe('a group on the board', () => {
  test('a range is one card that holds the range; separate verses, a card for each run', async ({ page }) => {
    await open(page);
    for (const n of [3, 4, 5]) await text(page, n).click();
    await expect(page.getByTestId('canvas-3')).toHaveAccessibleName('Canvas — put these verses on the board');
    await page.getByTestId('canvas-3').click();
    await expect(page.getByTestId('note-done').or(page.getByTestId('canvas-done')).first()).toContainText('John 1:3-5');

    for (const n of [1, 14]) await text(page, n).click();
    await page.getByTestId('canvas-1').click();

    await page.getByTestId('side-board').click();
    await expect(page.locator('.card')).toHaveCount(3);
    const first = page.locator('.card').first();
    await expect(first).toContainText('John 1:3-5');
    await expect(first.locator('.card__body')).toContainText('3 Through Him all things were made');
    await expect(first.locator('.card__body')).toContainText('5 The Light shines in the darkness');
    // The same range again is not a second card.
    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('canvas-3').click();
    await page.getByTestId('side-board').click();
    await expect(page.locator('.card')).toHaveCount(3);
  });

  test('its card opens the passage and points out the whole range', async ({ page }) => {
    await open(page);
    for (const n of [3, 4, 5]) await text(page, n).click();
    await page.getByTestId('canvas-3').click();
    await page.getByTestId('chapter-select').selectOption('2');
    await page.getByTestId('side-board').click();
    await page.locator('[data-testid^="card-open-"]').first().click();
    await expect(page.getByTestId('chapter-title')).toContainText('1');
    await expect(page.locator('.verse--flash')).toHaveCount(3);
  });
});

/*
 * Several verses can be selected, so each has to show it by itself, and not
 * by colour alone (1.4.1): an outline and a filled number as well as the wash.
 */
test.describe('how a selected verse looks', () => {
  const look = (page: Page, n: number) =>
    verse(page, n).evaluate((el) => {
      const number = el.querySelector('.verse__num')!;
      const [v, num] = [getComputedStyle(el), getComputedStyle(number)];
      return {
        outline: v.outlineStyle,
        outlineWidth: parseFloat(v.outlineWidth),
        numberFill: num.backgroundColor,
        numberInk: num.color,
      };
    });

  test('an outline and a filled number, on every selected verse', async ({ page }) => {
    await open(page);
    const rest = await look(page, 3);
    expect(rest.outline).toBe('none');
    for (const n of [3, 5]) await text(page, n).click();
    for (const n of [3, 5]) {
      const now = await look(page, n);
      expect(now.outline, `verse ${n}`).toBe('solid');
      expect(now.outlineWidth, `verse ${n}`).toBeGreaterThanOrEqual(2);
      expect(now.numberFill, `verse ${n}`).not.toBe(rest.numberFill);
    }
    // The verse between is untouched.
    expect((await look(page, 4)).outline).toBe('none');
  });

  // Forced colours drop backgrounds and shadows. A selected verse had no rule
  // there at all: the row inside it was the only sign, and one row cannot
  // mark five verses.
  test('under forced colours the outline and the number still say it', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page);
    for (const n of [3, 5]) await text(page, n).click();
    for (const n of [3, 5]) {
      const now = await look(page, n);
      expect(now.outline).toBe('solid');
      expect(now.outlineWidth).toBeGreaterThanOrEqual(2);
      // An inverted block: the number's fill is not the page's.
      expect(now.numberFill).not.toBe(now.numberInk);
      expect(now.numberFill).not.toBe('rgba(0, 0, 0, 0)');
    }
    expect((await look(page, 4)).outline).toBe('none');
  });

  // The filled number opts out of forced colours to be an inverted block, and
  // the browser then stops forcing its focus ring too: it kept the palette's
  // colour, which on a dark system theme may not show against the page.
  test('under forced colours a focused selected number has the system ring', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page);
    await page.getByTestId('verse-3').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    const number = page.getByTestId('verse-3');
    await expect(number).toBeFocused();
    const ring = await number.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'Highlight';
      document.body.append(probe);
      const system = getComputedStyle(probe).color;
      probe.remove();
      const style = getComputedStyle(el);
      return { colour: style.outlineColor, style: style.outlineStyle, system };
    });
    expect(ring.style).toBe('solid');
    expect(ring.colour).toBe(ring.system);
  });

  test('read as running text without numbers, each selected verse shows its number', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scriptura-display', JSON.stringify({ verseLines: false, verseNumbers: false }));
    });
    await open(page);
    for (const n of [2, 4]) await text(page, n).click();
    expect(await selected(page)).toEqual([2, 4]);
    for (const n of [2, 4]) expect((await page.getByTestId(`verse-${n}`).boundingBox())!.width).toBeGreaterThan(4);
    expect((await page.getByTestId('verse-3').boundingBox())!.width).toBeLessThanOrEqual(1);
    for (const n of [2, 4]) expect((await look(page, n)).outline).toBe('solid');
  });
});

/*
 * Beside the Bible the row of a group stays on screen as the chapter scrolls,
 * so the button that fills a range is there at the far end of it.
 */
test.describe('the row of a group stays in reach', () => {
  const inPane = async (page: Page) => {
    const [pane, box] = [(await page.getByTestId('pane-bible').boundingBox())!, (await row(page).boundingBox())!];
    return box.y >= pane.y && box.y + box.height <= pane.y + pane.height;
  };

  test('it follows the reader down the chapter, and the fill button with it', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    await text(page, 4).click();
    const pane = (await page.getByTestId('pane-bible').boundingBox())!;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height * 0.6);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 250);
    await expect.poll(() => page.getByTestId('pane-bible').evaluate((el) => el.scrollTop)).toBeGreaterThan(1500);
    // Verse 3 is far above; the row is not.
    expect(await inPane(page)).toBe(true);

    await text(page, 40).click();
    await expect(page.getByTestId('verse-fill')).toHaveText('Select 3-40');
    expect(await inPane(page)).toBe(true);

    // ⚠️ Focus on a control in the stuck row must not move the text. The row
    // sits in the scroll padding kept clear for it, so the browser "brought
    // it into view": the press on Select, which hands focus to Quote, sent the
    // chapter back by the height of the row.
    const before = await scrollTop(page);
    await page.getByTestId('verse-fill').click();
    expect((await selected(page)).length).toBe(38);
    await expect(page.getByTestId('quote-3')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('link-3')).toBeFocused();
    await page.waitForTimeout(400);
    expect(Math.abs((await scrollTop(page)) - before)).toBeLessThanOrEqual(1);
  });

  // The Bible maximized, a quote just made: "✓ Quoted…" waits in the corner
  // until the notes are opened. A group's row stuck at the foot of the pane
  // ran under it in a window not much wider than the two of them.
  test('stuck at the foot of a maximized Bible, it stays clear of the bar that confirms a quote', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await open(page);
    await page.getByTestId('note-new').click();
    await page.getByTestId('maximize-bible').click();
    await text(page, 1).click();
    await page.getByTestId('quote-1').click();
    await expect(page.getByTestId('layout-done')).toBeVisible();

    // A group far down the chapter, then back to the top: its row sticks to
    // the foot of the pane.
    const pane = (await page.getByTestId('pane-bible').boundingBox())!;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height * 0.4);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 250);
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(1500);
    await text(page, 40).click();
    await text(page, 41).click();
    await expect(page.getByTestId('verse-summary')).toBeVisible();
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -400);
    await expect.poll(() => scrollTop(page)).toBe(0);
    await expect(page.getByTestId('layout-done')).toBeVisible();

    const [bar, group] = [(await page.getByTestId('layout-done').boundingBox())!, (await row(page).boundingBox())!];
    const apart =
      group.y + group.height <= bar.y || group.y >= bar.y + bar.height || group.x + group.width <= bar.x || group.x >= bar.x + bar.width;
    expect(apart, `row ${JSON.stringify(group)} and bar ${JSON.stringify(bar)}`).toBe(true);
    expect(group.y + group.height).toBeLessThanOrEqual(pane.y + pane.height);
  });

  test('one verse\'s row stays with its verse', async ({ page }) => {
    await open(page);
    await text(page, 3).click();
    const pane = (await page.getByTestId('pane-bible').boundingBox())!;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height * 0.6);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 250);
    await expect.poll(() => page.getByTestId('pane-bible').evaluate((el) => el.scrollTop)).toBeGreaterThan(1500);
    expect(await inPane(page)).toBe(false);
  });

  // The row covers text while it is stuck: a verse reached with Tab must come
  // to rest clear of it, and of the pinned title (2.4.11).
  test('a verse focused from the keyboard is clear of the row', async ({ page }) => {
    await open(page);
    await text(page, 1).click();
    await text(page, 2).click();
    await page.getByTestId('verse-45').focus();
    for (let n = 44; n > 36; n--) {
      await page.keyboard.press('Shift+Tab');
      const number = page.getByTestId(`verse-${n}`);
      await expect(number).toBeFocused();
      const clear = await number.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const bar = document.querySelector('[data-testid="verse-actions"]')!.getBoundingClientRect();
        const head = document.querySelector('.chapter__head')!.getBoundingClientRect();
        return { underRow: box.bottom > bar.top && box.top < bar.bottom, underHead: box.top < head.bottom };
      });
      expect(clear, `verse ${n}`).toEqual({ underRow: false, underHead: false });
    }
  });
});
