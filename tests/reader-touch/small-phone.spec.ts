import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * A small phone, upright and on its side: an iPhone SE, 375 × 667.
 *
 * Every bar the reader has was pinned, and on this screen they left 61% of the
 * height for scripture upright and 44% on its side — 164 pixels, about five
 * lines. A note read back on its side had one line. So the menus step aside
 * as the reader scrolls on (lib/recede.ts), and these tests hold the room
 * that buys, and the ways back: a scroll the other way, the top, the button,
 * and focus.
 *
 * ⚠️ Receded menus are out of sight, never out of reach. They stay in the
 * accessibility tree and the Tab order, which is what the focus tests here
 * are for: a control that has focus is on the screen (2.4.11).
 *
 * The rest of this project runs at a Pixel 7's 412 × 839, where none of this
 * showed.
 */

const SCREENS = [
  { name: 'upright', viewport: { width: 375, height: 667 } },
  { name: 'on its side', viewport: { width: 667, height: 375 } },
] as const;

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** A touch drag in steps, like a finger moving at a steady pace (see sheet.spec.ts). */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/**
 * A finger on a control. ⚠️ Not `click()` or `tap()` on the locator: both
 * first bring the control clear of the pane's scroll padding, which a finger
 * does not do, and the title strip's button sits inside that padding — the
 * pane would scroll under the test, and not under a reader.
 */
async function press(page: Page, testId: string) {
  // Measured once nothing is sliding: the sheet and the bars both animate, and
  // a press aimed at where a control was a moment ago lands on nothing.
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  const box = (await page.getByTestId(testId).boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Wait until a scroller has stopped. A wheel is answered over several frames,
 * and on a starved runner two readings a moment apart can agree while the
 * scroll is still under way — a macOS runner read a position mid-scroll and
 * then found the pane somewhere else. Four readings, 120ms apart, all equal.
 */
async function stopped(page: Page, scroller: ReturnType<Page['locator']>) {
  let last = NaN;
  let same = 0;
  await expect
    .poll(
      async () => {
        const top = await scroller.evaluate((el) => el.scrollTop);
        same = top === last ? same + 1 : 0;
        last = top;
        if (same < 3) await page.waitForTimeout(120);
        return same;
      },
      { timeout: 15_000 }
    )
    .toBeGreaterThanOrEqual(3);
}

const pane = (page: Page) => page.getByTestId('pane-bible');
const menus = (page: Page) => page.locator('.reader');

/**
 * Scroll the Bible pane by `by` px with the wheel, in steps as a wheel sends
 * them. ⚠️ Not `el.scrollBy()`: only the reader's own scrolling moves the
 * menus, and a scroll no input caused is not theirs (lib/recede.ts).
 */
async function scrollBy(page: Page, by: number) {
  const box = (await pane(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  const before = await pane(page).evaluate((el) => el.scrollTop);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, by / 6);
  // The wheel is answered a frame or two later.
  await expect.poll(() => pane(page).evaluate((el) => el.scrollTop)).not.toBe(before);
  await stopped(page, pane(page));
}

/** Nothing in the pane is still sliding: the bars' `top` is a transition. */
const settled = (page: Page) =>
  expect
    .poll(() => pane(page).evaluate((el) => el.getAnimations({ subtree: true }).length))
    .toBe(0);

/** Where the pieces are, in the viewport, once they have stopped moving. */
async function measure(page: Page) {
  await settled(page);
  return page.evaluate(() => {
    const box = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, height: b.height };
    };
    const head = box('.chapter__head')!;
    const sheet = box('.sheet')!;
    return {
      screen: window.innerHeight,
      bar: box('.reader__bar')!,
      search: box('.search')!,
      notice: box('.durability'),
      head,
      sheet,
      /** Between the pinned title and the notes' grip: what is left for scripture. */
      reading: sheet.top - head.bottom,
    };
  });
}

for (const screen of SCREENS) {
  test.describe(`a small phone, ${screen.name}`, () => {
    test.use({ viewport: screen.viewport });

    test('scrolling on gives scripture the screen; scrolling back returns the menus', async ({ page }) => {
      await open(page);
      const before = await measure(page);
      // At the top the menus are simply the first things on the page.
      expect(before.bar.top).toBeGreaterThanOrEqual(0);
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');

      // A real finger, not a scripted scroll: twice up the screen.
      const { width, height } = screen.viewport;
      for (let i = 0; i < 2; i++) {
        await touchDrag(page, { x: width / 2, y: height * 0.72 }, { x: width / 2, y: height * 0.3 });
      }
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');

      const reading = await measure(page);
      // Off the top of the screen, both of them, and the notice with them.
      expect(reading.bar.bottom).toBeLessThanOrEqual(0.5);
      expect(reading.search.bottom).toBeLessThanOrEqual(0.5);
      expect(reading.notice!.bottom).toBeLessThanOrEqual(0.5);
      // The title strip is what stays, at the very top.
      expect(Math.abs(reading.head.top)).toBeLessThanOrEqual(0.5);
      // The room this is all for. Upright it was 406px of 667 and on its side
      // 164 of 375; the floors are a little under what is measured now.
      const share = reading.reading / reading.screen;
      expect(share).toBeGreaterThanOrEqual(screen.name === 'upright' ? 0.84 : 0.72);

      // A short way back is enough.
      await touchDrag(page, { x: width / 2, y: height * 0.4 }, { x: width / 2, y: height * 0.62 });
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      const back = await measure(page);
      expect(Math.abs(back.bar.top)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(back.search.top - back.bar.bottom)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(back.head.top - back.search.bottom)).toBeLessThanOrEqual(0.5);
    });

    test('the button brings the menus back without a scroll, and puts them away', async ({ page }) => {
      await open(page);
      const toggle = page.getByTestId('chapter-menus-toggle');
      await scrollBy(page, 900);
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');

      // Named for what a press will do, and a full-size target.
      await expect(toggle).toHaveAccessibleName('Show the reading menus');
      const box = (await toggle.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);

      // The place is noted at the last moment before the press, once the
      // pane is still.
      await stopped(page, pane(page));
      const position = await pane(page).evaluate((el) => el.scrollTop);
      await press(page, 'chapter-menus-toggle');
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      await expect(toggle).toHaveAccessibleName('Hide the reading menus');
      await expect(toggle).toBeFocused();
      const shown = await measure(page);
      expect(Math.abs(shown.bar.top)).toBeLessThanOrEqual(0.5);
      // The reader's place is kept: the menus came to them.
      expect(await pane(page).evaluate((el) => el.scrollTop)).toBe(position);

      await press(page, 'chapter-menus-toggle');
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');
      expect((await measure(page)).bar.bottom).toBeLessThanOrEqual(0.5);
    });

    test('at the top of a chapter the button scrolls the menus away', async ({ page }) => {
      await open(page);
      await press(page, 'chapter-menus-toggle');
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');
      await expect.poll(async () => Math.abs((await measure(page)).head.top)).toBeLessThanOrEqual(0.5);
      expect((await measure(page)).search.bottom).toBeLessThanOrEqual(0.5);
    });

    test('focus moving into the receded menus brings them on screen', async ({ page }) => {
      await open(page);
      // The notice is the next stop back from the title; without it the next
      // is the search box, which is one of the menus.
      await page.locator('.durability__dismiss').click();
      await scrollBy(page, 900);
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');

      await page.getByTestId('chapter-menus-toggle').focus();
      await stopped(page, pane(page));
      const place = await pane(page).evaluate((el) => el.scrollTop);
      await page.keyboard.press('Shift+Tab');
      const input = page.getByTestId('search-input');
      await expect(input).toBeFocused();
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      await settled(page);
      await expect(input).toBeInViewport({ ratio: 1 });
      // ⚠️ The reader's place is kept. To show a control parked above the
      // pane the browser scrolls until it finds it, which for the unpinned
      // bar is the top of the chapter: Shift+Tab took verse 30 to verse 1.
      expect(Math.abs((await pane(page).evaluate((el) => el.scrollTop)) - place)).toBeLessThanOrEqual(1);

      // And on into the bar: every control is on screen while it has focus,
      // and they come in the order they have always had (3.2.3).
      const seen = ['search-input'];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Shift+Tab');
        const focused = page.locator(':focus');
        await expect(focused).toBeInViewport({ ratio: 1 });
        seen.push((await focused.getAttribute('data-testid')) ?? '');
      }
      expect(seen).toEqual(['search-input', 'help-open', 'settings-open', 'marks-open', 'library-open', 'chapter-select', 'book-select']);
      expect(Math.abs((await pane(page).evaluate((el) => el.scrollTop)) - place)).toBeLessThanOrEqual(1);
    });

    test('they stay while focus is inside them, however far the text scrolls', async ({ page }) => {
      await open(page);
      // A field being typed into: on a phone its keyboard is up.
      await page.getByTestId('search-input').focus();
      await scrollBy(page, 900);
      await scrollBy(page, 300);
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      expect(Math.abs((await measure(page)).bar.top)).toBeLessThanOrEqual(0.5);

      // A chip reached with the keyboard, and the text then scrolled with it.
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByTestId('help-open')).toBeFocused();
      for (let i = 0; i < 3; i++) await page.keyboard.press('PageDown');
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      await expect(page.getByTestId('help-open')).toBeInViewport({ ratio: 1 });
    });

    // Choosing a chapter leaves focus on the picker. If that held the menus,
    // they would stay for the whole chapter the reader went there to read.
    test('focus left behind by a finger does not keep them', async ({ page }) => {
      await open(page);
      await press(page, 'help-open');
      await press(page, 'help-open');
      await expect(page.getByTestId('help-open')).toBeFocused();
      await scrollBy(page, 900);
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');

      // Dismissing the notice hands focus to the book picker, by script.
      await pane(page).evaluate((el) => el.scrollTo(0, 0));
      await page.locator('.durability__dismiss').tap();
      await expect(page.getByTestId('book-select')).toBeFocused();
      await scrollBy(page, 900);
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');
    });

    test('a verse focused from the keyboard is never under the pinned title', async ({ page }) => {
      await open(page);
      for (const receded of [true, false]) {
        await pane(page).evaluate((el) => el.scrollTo(0, 0));
        await scrollBy(page, 1400);
        if (!receded) await press(page, 'chapter-menus-toggle');
        await expect(menus(page)).toHaveAttribute('data-menus', receded ? 'hidden' : 'shown');
        await settled(page);

        // Backwards from a verse far below: each step brings the one above
        // into view from under whatever is pinned.
        await page.getByTestId('verse-30').focus();
        for (let verse = 29; verse > 20; verse--) {
          await page.keyboard.press('Shift+Tab');
          const number = page.getByTestId(`verse-${verse}`);
          await expect(number).toBeFocused();
          const clear = await number.evaluate((el) => {
            const head = document.querySelector('.chapter__head')!.getBoundingClientRect();
            const sheet = document.querySelector('.sheet')!.getBoundingClientRect();
            const box = el.getBoundingClientRect();
            return { above: box.top - head.bottom, below: sheet.top - box.bottom };
          });
          expect(clear.above, `verse ${verse}, menus ${receded ? 'receded' : 'shown'}`).toBeGreaterThanOrEqual(0);
          expect(clear.below, `verse ${verse}, menus ${receded ? 'receded' : 'shown'}`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    // The check above has to be able to fail. The title's height was not in
    // the scroll padding, and 2.4.12 was claimed on that padding all the same.
    test('with the title\'s height planted out of the scroll padding, a focused verse is caught under it', async ({ page }) => {
      await open(page);
      await scrollBy(page, 1400);
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');
      await page.addStyleTag({ content: '.pane { scroll-padding-top: .5rem !important; }' });
      await page.getByTestId('verse-30').focus();
      const under: number[] = [];
      for (let verse = 29; verse > 20; verse--) {
        await page.keyboard.press('Shift+Tab');
        under.push(
          await page.getByTestId(`verse-${verse}`).evaluate((el) => {
            const head = document.querySelector('.chapter__head')!.getBoundingClientRect();
            return el.getBoundingClientRect().top - head.bottom;
          })
        );
      }
      expect(Math.min(...under)).toBeLessThan(0);
    });

    // A chapter that fits on the screen with its menus has nowhere to put
    // them: the button would change its name and nothing else.
    test('the button is not offered where a chapter is too short to scroll past its menus', async ({ page }) => {
      await open(page);
      const toggle = page.getByTestId('chapter-menus-toggle');
      await expect(toggle).toBeEnabled();
      // Psalm 117: two verses.
      await page.getByTestId('book-select').selectOption('psalms');
      await page.getByTestId('chapter-select').selectOption('117');
      await expect(page.getByTestId('chapter-title')).toContainText('117');
      const room = await pane(page).evaluate((el) => {
        const size = (selector: string) => (document.querySelector(selector) as HTMLElement).offsetHeight;
        return el.scrollHeight - el.clientHeight - size('.reader__bar') - size('.search');
      });
      if (room < 0) await expect(toggle).toBeDisabled();
      else await expect(toggle).toBeEnabled();
      // Upright, at least, two verses fit: the case this test is for.
      if (screen.name === 'upright') expect(room).toBeLessThan(0);
    });

    test('nothing moves on a timer', async ({ page }) => {
      await page.clock.install();
      await open(page);
      await scrollBy(page, 900);
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');
      await page.clock.fastForward('02:00');
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');

      await press(page, 'chapter-menus-toggle');
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      await page.clock.fastForward('02:00');
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
    });

    test('switched off in Settings, scrolling moves nothing and the button still works', async ({ page }) => {
      await open(page);
      await page.getByTestId('settings-open').click();
      await page.getByTestId('pref-recede-menus').uncheck();
      await page.getByTestId('settings-close').click();

      await scrollBy(page, 900);
      await scrollBy(page, 300);
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      expect(Math.abs((await measure(page)).bar.top)).toBeLessThanOrEqual(0.5);

      await press(page, 'chapter-menus-toggle');
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');
      expect((await measure(page)).bar.bottom).toBeLessThanOrEqual(0.5);
      // And they stay away until asked for: scrolling back does not undo a choice made by hand.
      await scrollBy(page, -200);
      await expect(menus(page)).toHaveAttribute('data-menus', 'hidden');

      // Kept on this device.
      await page.reload();
      await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
      await scrollBy(page, 900);
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
    });

    test('a panel keeps the menus: the button that would bring them back is hidden with the chapter', async ({ page }) => {
      await open(page);
      await page.getByTestId('help-open').click();
      await expect(page.getByTestId('chapter-menus-toggle')).toBeHidden();
      await scrollBy(page, 900);
      await scrollBy(page, 300);
      await expect(menus(page)).toHaveAttribute('data-menus', 'shown');
      const bar = (await page.locator('.reader__bar').boundingBox())!;
      expect(Math.abs(bar.y)).toBeLessThanOrEqual(0.5);
    });

    test('the storage notice scrolls off with the chapter instead of staying pinned', async ({ page }) => {
      await open(page);
      const top = await measure(page);
      // Under the search box at the top of the pane, not above the layout.
      expect(top.notice!.top).toBeGreaterThanOrEqual(top.search.bottom - 0.5);
      expect(Math.abs(top.bar.top)).toBeLessThanOrEqual(0.5);
      await expect(page.locator('[data-testid="pane-bible"] [data-testid="durability"]')).toBeVisible();

      // With the menus held where they are, the notice still leaves.
      await page.getByTestId('search-input').focus();
      await scrollBy(page, 600);
      const scrolled = await measure(page);
      expect(scrolled.notice!.bottom).toBeLessThanOrEqual(scrolled.search.bottom + 0.5);
    });
  });
}

/* ── Notes ─────────────────────────────────────────────────────────────────
 * Read back in the full sheet, a note had the grip, the Notes/Canvas tabs,
 * its picker row, its title and the formatting tools above its text: 175px of
 * 667 was the note upright, and one line on its side. The picker row and the
 * tabs step aside as the note is scrolled.
 */

const notes = (page: Page) => page.getByTestId('notes');
const surface = (page: Page) => page.getByTestId('notes-surface');

/**
 * A long note, open in the full sheet, with nothing focused: being read.
 * `auto: false` first switches the automatic part off in Settings, so that
 * only the button moves the menus.
 */
async function openLongNote(page: Page, { auto = true } = {}) {
  await open(page);
  if (!auto) {
    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-recede-menus').uncheck();
    await page.getByTestId('settings-close').click();
  }
  await press(page, 'sheet-grip');
  await press(page, 'note-new');
  await surface(page).tap();
  await expect(page.getByTestId('pane-notes')).toHaveAttribute('data-sheet', 'full');
  const lines = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}: the light shines in the darkness.`);
  await page.keyboard.insertText(lines.join('\n'));
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await surface(page).evaluate((el) => el.scrollTo(0, 0));
  await expect.poll(() => page.getByTestId('pane-notes').evaluate((el) => el.getAnimations().length)).toBe(0);
  await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
}

/**
 * Scroll the note with the wheel (see `scrollBy`). The note's scroller moves
 * and changes size as its menus come and go, so the pointer is put back over
 * it before every step: a wheel over the tools scrolls nothing.
 */
async function scrollNote(page: Page, by: number) {
  for (let i = 0; i < 6; i++) {
    const box = (await surface(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, by / 6);
    await page.waitForTimeout(50);
  }
  await stopped(page, surface(page));
}

/** The note's own text: how much of the screen its scroller shows, and where one line is. */
const noteView = (page: Page, line: number) =>
  page.evaluate((n) => {
    const el = document.getElementById('notes-surface')!;
    const lines = el.querySelectorAll('.live-line');
    return {
      screen: window.innerHeight,
      height: el.clientHeight,
      top: el.scrollTop,
      lineY: lines[n].getBoundingClientRect().top,
      pad: parseFloat(getComputedStyle(el).paddingTop),
    };
  }, line);

/** Drawn at no more than a pixel: clipped, but still in the page. */
const clipped = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  return box.width <= 1 && box.height <= 1;
};
const NOTE_BAR = '.notes__bar';
const TABS = '[data-testid="side-switch"]';

for (const screen of SCREENS) {
  test.describe(`a note on a small phone, ${screen.name}`, () => {
    test.use({ viewport: screen.viewport });

    test('scrolling on gives the note the sheet; scrolling back returns its menus', async ({ page }) => {
      await openLongNote(page);
      const before = await noteView(page, 30);

      await scrollNote(page, 700);
      await expect(notes(page)).toHaveAttribute('data-menus', 'hidden');
      expect(await clipped(page, NOTE_BAR)).toBe(true);
      expect(await clipped(page, TABS)).toBe(true);
      // Out of sight, not out of the page: both are still there to be found.
      await expect(page.getByTestId('note-select')).toBeAttached();
      await expect(page.getByRole('tab', { name: 'Canvas' })).toBeAttached();

      const reading = await noteView(page, 30);
      expect(reading.height).toBeGreaterThan(before.height + 80);
      // Upright the note's text had 175px of 667, and on its side about 30 of
      // 375. The floors are a little under what is measured now.
      expect(reading.height / reading.screen).toBeGreaterThanOrEqual(screen.name === 'upright' ? 0.52 : 0.34);

      await scrollNote(page, -120);
      await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
      expect(await clipped(page, NOTE_BAR)).toBe(false);
      expect(await clipped(page, TABS)).toBe(false);
    });

    // Without this the text jumped a menu's height each time, and the lines it
    // jumped over could only be read by scrolling back, which undid it.
    test('the line being read stays where it is as the menus go and come', async ({ page }) => {
      await openLongNote(page, { auto: false });

      await scrollNote(page, 700);
      await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
      const shown = await noteView(page, 30);

      await press(page, 'note-menus-toggle');
      await expect(notes(page)).toHaveAttribute('data-menus', 'hidden');
      const hidden = await noteView(page, 30);
      expect(hidden.height).toBeGreaterThan(shown.height + 80);
      expect(Math.abs(hidden.lineY - shown.lineY)).toBeLessThanOrEqual(1);
      expect(hidden.top).toBe(shown.top);

      await press(page, 'note-menus-toggle');
      await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
      const again = await noteView(page, 30);
      expect(Math.abs(again.lineY - shown.lineY)).toBeLessThanOrEqual(1);
      expect(again.top).toBe(shown.top);
    });

    test('at the top the button gives the room to the text, and the top brings the menus back', async ({ page }) => {
      await openLongNote(page);
      const before = await noteView(page, 0);
      await expect(page.getByTestId('note-menus-toggle')).toHaveAccessibleName('Hide the note menus');
      const box = (await page.getByTestId('note-menus-toggle').boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);

      await press(page, 'note-menus-toggle');
      await expect(notes(page)).toHaveAttribute('data-menus', 'hidden');
      await expect(page.getByTestId('note-menus-toggle')).toHaveAccessibleName('Show the note menus');
      const hidden = await noteView(page, 0);
      // Nothing was scrolled, so nothing is held back: the first line moves up.
      expect(hidden.lineY).toBeLessThan(before.lineY - 80);
      expect(hidden.pad).toBe(before.pad);

      // On, then back to the top: they are there again.
      await scrollNote(page, 300);
      await scrollNote(page, -400);
      await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
      expect(Math.abs((await noteView(page, 0)).lineY - before.lineY)).toBeLessThanOrEqual(1);
    });

    test('focus moving into the receded menus brings them on screen', async ({ page }) => {
      await openLongNote(page);
      await scrollNote(page, 700);
      await expect(notes(page)).toHaveAttribute('data-menus', 'hidden');

      // Back from the title: the picker row's last control, then on to the
      // tabs, in the order they have always had (3.2.3).
      await page.getByTestId('note-title').focus();
      const seen: string[] = [];
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Shift+Tab');
        await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
        const focused = page.locator(':focus');
        await expect(focused).toBeInViewport({ ratio: 1 });
        seen.push((await focused.getAttribute('data-testid')) ?? '');
      }
      expect(seen).toEqual(['note-delete', 'note-export', 'note-new', 'note-select', 'side-notes']);
    });

    // Focus a finger left behind, or script put there, is not the reader
    // working in the menus: they go, all of them, and the note makes room
    // once. A guard in the stylesheet used to keep the focused row drawn over
    // a note already padded for its going.
    test('a picker left focused by a tap goes with the rest', async ({ page }) => {
      await openLongNote(page);
      // A tap, so the last thing the reader used was a finger; then focus by script.
      await page.getByTestId('note-title').tap();
      await page.getByTestId('note-select').evaluate((el) => (el as HTMLElement).focus());
      await expect(page.getByTestId('note-select')).toBeFocused();
      await scrollNote(page, 700);
      await expect(notes(page)).toHaveAttribute('data-menus', 'hidden');
      expect(await clipped(page, NOTE_BAR)).toBe(true);
      expect(await clipped(page, TABS)).toBe(true);
      // A key pressed there brings them back: the picker is not worked blind.
      await page.keyboard.press('Shift');
      await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
      expect(await clipped(page, NOTE_BAR)).toBe(false);
    });

    // On its side the note has 16px while its menus show: a line cut in half.
    // There the menus do not wait to be scrolled past their own height.
    // (Upright, a note has room to read in with its menus showing.)
    if (screen.name === 'on its side') test('a note with no room to read in gives up its menus at the first scroll', async ({ page }) => {
      await openLongNote(page);
      const before = await noteView(page, 0);
      expect(before.height).toBeLessThan(96);
      await scrollNote(page, 90);
      await expect(notes(page)).toHaveAttribute('data-menus', 'hidden');
      expect((await noteView(page, 0)).height).toBeGreaterThan(before.height + 80);
    });

    test('a note too short to gain from it keeps its menus', async ({ page }) => {
      await open(page);
      await press(page, 'sheet-grip');
      await press(page, 'note-new');
      await surface(page).tap();
      await page.keyboard.insertText('One line.\nTwo lines.');
      await page.evaluate(() => (document.activeElement as HTMLElement).blur());
      const box = (await surface(page).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 100);
      await expect(notes(page)).toHaveAttribute('data-menus', 'shown');
    });
  });
}

/* ── The canvas ────────────────────────────────────────────────────────────
 * In the full sheet the grip, the Notes/Canvas tabs and the board's bar sat
 * above the board: 348px of 667 was the board upright, and 130 of 375 on its
 * side — less than one card. A board is panned, not scrolled, so its menus
 * step aside when the reader starts moving things on it.
 */

const canvas = (page: Page) => page.getByTestId('canvas');
const BOARD_BAR = '.canvas__bar';

/** John 1:1, 1:3 and 1:5 on a board, opened from the sheet's Canvas tab. */
async function openBoard(page: Page, { auto = true } = {}) {
  await open(page);
  if (!auto) {
    await page.getByTestId('settings-open').click();
    await page.getByTestId('pref-recede-menus').uncheck();
    await page.getByTestId('settings-close').click();
  }
  for (const verse of [1, 3, 5]) {
    await page.locator(`.verse[data-verse="${verse}"] .verse__text`).tap();
    await page.getByTestId(`canvas-${verse}`).tap();
  }
  await press(page, 'sheet-grip');
  await press(page, 'side-board');
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'full');
  await expect.poll(() => sheet.evaluate((el) => el.getAnimations().length)).toBe(0);
  await expect(page.locator('.card')).toHaveCount(3);
  await expect(canvas(page)).toHaveAttribute('data-menus', 'shown');
}

const frameBox = async (page: Page) => (await page.locator('.canvas__frame').boundingBox())!;
const firstCard = async (page: Page) => (await page.locator('.card').first().boundingBox())!;

/** A point on the board's background: below the cards, which sit in a row at its top. */
async function background(page: Page) {
  const frame = await frameBox(page);
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height - 12 };
}

for (const screen of SCREENS) {
  test.describe(`a board on a small phone, ${screen.name}`, () => {
    test.use({ viewport: screen.viewport });

    test('moving the board gives it the sheet, and the cards stay under the finger', async ({ page }) => {
      await openBoard(page);
      const frame = await frameBox(page);
      const card = await firstCard(page);
      const from = await background(page);

      // A pan of 40px, by a finger.
      await touchDrag(page, from, { x: from.x, y: from.y - 40 });
      await expect(canvas(page)).toHaveAttribute('data-menus', 'hidden');
      expect(await clipped(page, BOARD_BAR)).toBe(true);
      expect(await clipped(page, TABS)).toBe(true);
      await expect(page.getByTestId('zoom-in')).toBeAttached();
      await expect(page.getByRole('tab', { name: 'Notes' })).toBeAttached();

      // The room: upright the board had 348px of 667, on its side 130 of 375.
      const grown = await frameBox(page);
      expect(grown.height).toBeGreaterThan(frame.height + 80);
      expect(grown.height / screen.viewport.height).toBeGreaterThanOrEqual(screen.name === 'upright' ? 0.74 : 0.62);
      expect(Math.abs(grown.y + grown.height - (frame.y + frame.height))).toBeLessThanOrEqual(1);

      // The frame grew from its top by a bar and a row of tabs. The card moved
      // by the pan and by nothing else.
      const moved = await firstCard(page);
      expect(Math.abs(moved.y - (card.y - 40))).toBeLessThanOrEqual(2);
      expect(Math.abs(moved.x - card.x)).toBeLessThanOrEqual(2);
    });

    test('a card dragged as the menus leave ends where the finger left it', async ({ page }) => {
      await openBoard(page);
      const card = page.locator('.card').first();
      const before = (await card.boundingBox())!;
      const grip = (await card.locator('.card__grip').boundingBox())!;
      const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };

      await touchDrag(page, from, { x: from.x + 30, y: from.y + 50 });
      await expect(canvas(page)).toHaveAttribute('data-menus', 'hidden');
      const after = (await card.boundingBox())!;
      expect(Math.abs(after.x - (before.x + 30))).toBeLessThanOrEqual(2);
      expect(Math.abs(after.y - (before.y + 50))).toBeLessThanOrEqual(2);
    });

    test('a press on a card\'s button is not moving the board', async ({ page }) => {
      await openBoard(page);
      await page.locator('[data-testid^="card-connect-"]').first().tap();
      await expect(canvas(page)).toHaveAttribute('data-menus', 'shown');
      expect(await clipped(page, BOARD_BAR)).toBe(false);
    });

    test('the button brings the menus back and puts them away, and the board does not move', async ({ page }) => {
      await openBoard(page);
      const toggle = page.getByTestId('board-menus-toggle');
      await expect(toggle).toHaveAccessibleName('Hide the board menus');
      const box = (await toggle.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const card = await firstCard(page);

      await press(page, 'board-menus-toggle');
      await expect(canvas(page)).toHaveAttribute('data-menus', 'hidden');
      await expect(toggle).toHaveAccessibleName('Show the board menus');
      const away = await firstCard(page);
      expect(Math.abs(away.y - card.y)).toBeLessThanOrEqual(1);

      await press(page, 'board-menus-toggle');
      await expect(canvas(page)).toHaveAttribute('data-menus', 'shown');
      expect(await clipped(page, BOARD_BAR)).toBe(false);
      expect(await clipped(page, TABS)).toBe(false);
      const back = await firstCard(page);
      expect(Math.abs(back.y - card.y)).toBeLessThanOrEqual(1);
    });

    // Zoom, the pan buttons and Connections are how the board is used without
    // a pinch or a drag (2.5.1, 2.5.7). The zoom stays on screen, in the strip
    // beside the board's name; the rest must still be a Tab away.
    test('the ways to do without a drag are at hand while the menus are away', async ({ page }) => {
      await openBoard(page);
      await press(page, 'board-menus-toggle');
      await expect(canvas(page)).toHaveAttribute('data-menus', 'hidden');
      // On screen whole: measured as boxes, since the group's rounded corners
      // clip a sliver of its end buttons and `toBeInViewport` counts that.
      for (const id of ['zoom-out', 'zoom-reset', 'zoom-in']) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(screen.viewport.width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(screen.viewport.height);
      }
      await press(page, 'zoom-in');
      await expect(page.getByTestId('zoom-reset')).toHaveText('120%');
      await expect(canvas(page)).toHaveAttribute('data-menus', 'hidden');

      await page.getByTestId('board-name').focus();
      const seen: string[] = [];
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Shift+Tab');
        const focused = page.locator(':focus');
        await expect(canvas(page)).toHaveAttribute('data-menus', 'shown');
        await expect(focused).toBeInViewport({ ratio: 1 });
        seen.push((await focused.getAttribute('data-testid')) ?? '');
        if (seen.at(-1) === 'side-board') break;
      }
      // In the order they have always had (3.2.3). The pan buttons are behind More.
      expect(seen).toEqual(['canvas-help', 'board-more', 'board-connections', 'board-add-text', 'board-new', 'board-select', 'side-board']);
    });

    // The frame clips but can be scrolled: the browser does it to show a
    // focused card. The panel is placed from the frame's bottom and went with
    // the scroll — on a short frame, out of the frame altogether.
    test('the Move and Size panel is inside the board however its card was reached', async ({ page }) => {
      await openBoard(page);
      const adjust = page.locator('[data-testid^="card-adjust-"]').last();
      await adjust.focus();
      await page.keyboard.press('Enter');
      const panel = page.getByTestId('card-panel');
      await expect(panel).toBeVisible();
      await expect.poll(() => page.locator('.canvas__frame').evaluate((el) => el.scrollTop + el.scrollLeft)).toBe(0);
      const frame = await frameBox(page);
      const box = (await panel.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(frame.y - 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 0.5);
      await expect(page.getByTestId('adjust-left')).toBeInViewport({ ratio: 1 });
    });

    test('switched off in Settings, moving the board moves no menus', async ({ page }) => {
      await openBoard(page, { auto: false });
      const from = await background(page);
      await touchDrag(page, from, { x: from.x, y: from.y - 40 });
      await expect(canvas(page)).toHaveAttribute('data-menus', 'shown');
      expect(await clipped(page, BOARD_BAR)).toBe(false);
      // ⚠️ Chromium swallows a tap that lands while the drag before it is
      // still flinging — pointer events arrive, the click does not — so a
      // press straight after a drag does nothing, here and in any app.
      await page.waitForTimeout(400);
      await press(page, 'board-menus-toggle');
      await expect(canvas(page)).toHaveAttribute('data-menus', 'hidden');
    });

    test('with no board there is nothing to step aside', async ({ page }) => {
      await open(page);
      await press(page, 'sheet-grip');
      await press(page, 'side-board');
      await expect(page.getByTestId('board-start')).toBeVisible();
      await expect(page.getByTestId('board-menus-toggle')).toHaveCount(0);
      expect(await clipped(page, TABS)).toBe(false);
    });
  });
}

/* ── A group of verses ─────────────────────────────────────────────────────
 * The docked row is taller for a group: a line that says what it holds, with
 * the button that fills a range. On a small phone on its side that must still
 * leave text to read and to press.
 */
for (const screen of SCREENS) {
  test.describe(`several verses on a small phone, ${screen.name}`, () => {
    test.use({ viewport: screen.viewport });

    test('the docked row for a group leaves text to read and every control a finger\'s size', async ({ page }) => {
      await open(page);
      for (const n of [1, 2, 4]) await page.locator(`.verse[data-verse="${n}"] .verse__text`).tap();
      const row = page.getByTestId('verse-actions');
      await expect(page.getByTestId('verse-summary')).toHaveText('3 verses · John 1:1-2, 4');
      await expect(page.getByTestId('verse-fill')).toBeVisible();
      await settled(page);

      const [rowBox, sheet, head] = [
        (await row.boundingBox())!,
        (await page.getByTestId('pane-notes').boundingBox())!,
        (await page.locator('.chapter__head').boundingBox())!,
      ];
      expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(sheet.y + 1);
      expect(rowBox.x).toBeGreaterThanOrEqual(0);
      expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(screen.viewport.width);
      for (const button of await row.locator('button').all()) {
        const box = (await button.boundingBox())!;
        expect.soft(box.width, (await button.getAttribute('data-testid')) ?? '').toBeGreaterThanOrEqual(44);
        expect.soft(box.height, (await button.getAttribute('data-testid')) ?? '').toBeGreaterThanOrEqual(44);
      }
      // Room between whatever is pinned above and the row: at least two lines
      // of scripture, even on its side with the menus showing.
      expect(head.y + head.height).toBeLessThanOrEqual(rowBox.y);
      const room = await page.evaluate(() => {
        const rowTop = document.querySelector('[data-testid="verse-actions"]')!.getBoundingClientRect().top;
        const pinned = ['.reader__bar', '.search', '.chapter__head']
          .map((s) => document.querySelector(s)!.getBoundingClientRect())
          .filter((b) => b.bottom > 0 && b.top < rowTop)
          .reduce((low, b) => Math.max(low, b.bottom), 0);
        return rowTop - pinned;
      });
      expect(room).toBeGreaterThanOrEqual(screen.name === 'upright' ? 150 : 40);
    });

    test('quoting the group confirms it as one on the grip', async ({ page }) => {
      await open(page);
      for (const n of [1, 2, 3]) await page.locator(`.verse[data-verse="${n}"] .verse__text`).tap();
      await press(page, 'quote-1');
      await expect(page.getByTestId('sheet-done')).toHaveText('✓ Quoted John 1:1-3');
      await expect(page.locator('.verse[data-open]')).toHaveCount(0);
    });
  });
}
