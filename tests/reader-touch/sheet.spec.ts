import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { usePlainEditor } from '../helpers/note';
import { axeFor, describeViolations } from '../helpers/axe';

/**
 * The notes sheet under a finger, and above a keyboard.
 *
 * `page.touchscreen` can only tap, so drags are sent through the Chrome
 * DevTools Protocol as real touch events — the same events a phone produces,
 * converted to pointer events by the browser, which is the path the grip's
 * pointer capture and `touch-action: none` exist for. The software keyboard
 * cannot be shown at all; it is simulated the way the app itself sees one,
 * by shrinking `--vvh`, the visual viewport height.
 */

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
}

/** A touch drag in steps, with a pause between them like a finger moving at a steady pace. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 16) {
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
 * Where the grip is, once it has stopped moving.
 *
 * The sheet animates for .22s after every change of size, and a drag has to
 * start on the grip: measured mid-animation, the touch lands where the grip
 * was a moment ago and grabs nothing. That is what failed on a macOS runner —
 * the second drag did nothing and the sheet stayed at half.
 */
const gripCentre = async (page: Page) => {
  await expect
    .poll(() => page.getByTestId('pane-notes').evaluate((el) => el.getAnimations().length))
    .toBe(0);
  const box = (await page.getByRole('button', { name: /(expand|collapse) notes/i }).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('dragging the grip up opens the sheet, and a further drag makes it full', async ({ page }) => {
  await open(page);
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');

  const start = await gripCentre(page);
  await touchDrag(page, start, { x: start.x, y: start.y - 300 });
  await expect(sheet).toHaveAttribute('data-sheet', 'half');
  // The drag ended; the release did not also count as a tap that cycles on.
  await page.waitForTimeout(100);
  await expect(sheet).toHaveAttribute('data-sheet', 'half');

  const again = await gripCentre(page);
  await touchDrag(page, again, { x: again.x, y: 20 });
  await expect(sheet).toHaveAttribute('data-sheet', 'full');

  // And back down to the bottom.
  const top = await gripCentre(page);
  await touchDrag(page, top, { x: top.x, y: 830 });
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');
});

test('a tap on the grip still cycles', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /expand notes/i }).tap();
  await expect(page.getByTestId('pane-notes')).toHaveAttribute('data-sheet', 'half');
});

test('with the keyboard up the sheet stays above it, and the note is visible to type into', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /expand notes/i }).tap();
  await page.getByTestId('note-new').tap();
  await page.getByTestId('notes-surface').tap();

  // Writing needs the room: focusing the note makes the sheet full.
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'full');
  // And the text behind it is out of reach while it is covered (2.4.12).
  await expect(page.getByTestId('pane-bible')).toHaveAttribute('inert', '');

  // A keyboard taking the lower half of the screen.
  await page.addStyleTag({ content: ':root { --vvh: 420px !important; }' });
  await expect.poll(async () => (await sheet.boundingBox())!.y + (await sheet.boundingBox())!.height).toBeLessThanOrEqual(421);
  // Room to write: at least five lines of the note above the keyboard. The
  // note bar steps aside while the note is being edited in a sheet this short.
  await expect(page.getByTestId('note-new')).toBeHidden();
  const surface = (await page.getByTestId('notes-surface').boundingBox())!;
  expect(surface.y).toBeLessThan(420);
  const lineHeight = await page.getByTestId('notes-surface').evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(Math.min(surface.y + surface.height, 420) - surface.y).toBeGreaterThanOrEqual(lineHeight * 5);
  // Every tool is still reachable, in one scrolling row.
  await expect(page.getByTestId('tool-link')).toBeAttached();
  const tools = await page.getByTestId('editor-tools').evaluate((el) => ({
    wraps: getComputedStyle(el).flexWrap,
    scrolls: el.scrollWidth > el.clientWidth,
  }));
  expect(tools.wraps).toBe('nowrap');
  expect(tools.scrolls).toBe(true);

  // Leaving the note brings the bar back.
  await page.getByTestId('note-title').focus();
  await expect(page.getByTestId('note-new')).toBeVisible();

  // Collapsing gives the text back.
  await page.getByRole('button', { name: /collapse notes/i }).tap();
  await expect(sheet).toHaveAttribute('data-sheet', 'peek');
  await expect(page.getByTestId('pane-bible')).not.toHaveAttribute('inert', /.*/);
});

test('the grip is a full-width, finger-sized target clear of the bottom edge, and the chapter scrolls clear of the sheet', async ({ page }) => {
  await open(page);
  const grip = (await page.getByRole('button', { name: /expand notes/i }).boundingBox())!;
  expect(grip.height).toBeGreaterThanOrEqual(44);
  expect(grip.width).toBeGreaterThan(400);
  expect(grip.y + grip.height).toBeLessThanOrEqual(839 + 1);

  // The published height is the sheet's real height, and the pane leaves that
  // much room below the last verse.
  await page.getByRole('button', { name: /expand notes/i }).tap();
  const sheet = page.getByTestId('pane-notes');
  await expect(sheet).toHaveAttribute('data-sheet', 'half');
  // The sheet animates open (.22s) and the published height follows it frame
  // by frame, so the two are compared in one read, until it settles. Read in
  // two round trips mid-transition, they were a frame apart: 23px on a busy
  // CI runner.
  await expect
    .poll(() =>
      sheet.evaluate((el) =>
        Math.abs(
          parseFloat(document.documentElement.style.getPropertyValue('--sheet-h')) - el.getBoundingClientRect().height
        )
      )
    )
    .toBeLessThan(2);
  const sheetBox = (await sheet.boundingBox())!;

  const pane = page.getByTestId('pane-bible');
  await pane.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const last = (await page.locator('.verse').last().boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(sheetBox.y + 1);
});

/**
 * A long note read with its menus put away, then typed into above a keyboard
 * (owner's iPhone, iOS 27.0.1, preview.17). The note's scroller kept the
 * menus' room as top padding (`--menus-pad`, padFor) — 160px here, sized for
 * the full sheet. A box cannot be smaller than its padding, so in the 334px
 * sheet left above the keyboard the note could not shrink to its slot: it
 * squeezed the heading above it to a sliver, ran past the bottom of the
 * sheet, and the "Saved" line was drawn inside it. The geometry here is the
 * owner's screenshots': the sheet from 90 to 424, the note from 269 to 445.
 */
test.describe('a note read with its menus away, then typed into above a keyboard', () => {
  // An iPhone's width; the height only decides the sheet before the keyboard.
  test.use({ viewport: { width: 393, height: 852 } });

  for (const editor of ['live', 'plain'] as const) {
    test(`the ${editor} note stays in its own place in the sheet`, async ({ page }) => {
      if (editor === 'plain') await usePlainEditor(page);
      await open(page);
      await page.getByRole('button', { name: /expand notes/i }).tap();
      await page.getByTestId('note-new').tap();
      const surface = page.getByTestId('notes-surface');
      await surface.tap();
      await expect(page.getByTestId('pane-notes')).toHaveAttribute('data-sheet', 'full');
      const lines = Array.from({ length: 40 }, (_, i) => `Line ${i + 1}: persistence is a key word for this parable.`);
      await page.keyboard.insertText(['## What does it take', ...lines].join('\n'));
      await page.evaluate(() => (document.activeElement as HTMLElement).blur());

      // Read back from the top, and on: the menus go (a wheel, which is the
      // reader's own scrolling; lib/recede.ts ignores a scroll no input made).
      await surface.evaluate((el) => el.scrollTo(0, 0));
      const notes = page.getByTestId('notes');
      await expect(notes).toHaveAttribute('data-menus', 'shown');
      await expect
        .poll(async () => {
          const box = (await surface.boundingBox())!;
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, 150);
          return notes.getAttribute('data-menus');
        })
        .toBe('hidden');
      await expect.poll(() => surface.evaluate((el) => el.scrollTop)).toBeGreaterThan(400);

      // Back into the note, and the keyboard comes up: the sheet is what is
      // left above it, with Safari's visual viewport scrolled for the caret.
      await surface.tap();
      await expect(surface).toBeFocused();
      await page.addStyleTag({ content: ':root { --vvh: 363px !important; --vv-top: 61px !important; }' });
      await expect(page.getByTestId('note-new')).toBeHidden();
      await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
      await expect(notes).toHaveAttribute('data-menus', 'hidden');

      const at = await page.evaluate(() => {
        const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const heading = document.querySelector('.notes__heading')!;
        return {
          sheet: box('.sheet'),
          heading: box('.notes__heading'),
          headingClipped: heading.scrollHeight > heading.clientHeight + 1,
          note: box('#notes-surface'),
          status: box('.notes__status'),
        };
      });
      expect(at.sheet.bottom).toBeLessThanOrEqual(424 + 1);
      // The heading the caret is under is drawn whole, and the note starts below it.
      expect(at.headingClipped).toBe(false);
      expect(at.note.top).toBeGreaterThanOrEqual(at.heading.bottom - 1);
      // The note ends inside the sheet, and the status line comes after it.
      expect(at.note.bottom).toBeLessThanOrEqual(at.sheet.bottom + 1);
      expect(at.status.top).toBeGreaterThanOrEqual(at.note.bottom - 1);
      expect(at.status.bottom).toBeLessThanOrEqual(at.sheet.bottom + 1);
      // And it still has lines to type into.
      expect(at.note.height).toBeGreaterThanOrEqual(80);
    });
  }
});

/**
 * More room for the note above a keyboard (owner's iPhone, preview.17). With
 * the keyboard up the sheet is about 330px, and the note being typed into had
 * 88px of it: the grip, the title row, the tools and the heading line took the
 * rest. The geometry is the scenario above's: an iPhone's width, the sheet
 * from 90 to 424.
 */
test.describe('the note in a short sheet', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  const KEYBOARD = ':root { --vvh: 363px !important; --vv-top: 61px !important; }';
  const TITLE = 'November 8 Morning service';

  /**
   * A note under a heading, typed into with the keyboard up. The keyboard is
   * `--vvh`, as the app sees one, except for axe, which takes the full sheet
   * for a modal over the inert Bible only when it covers the window: there it
   * is a window as short as the space left above one.
   */
  async function typing(page: Page, title = TITLE, keyboard: 'vvh' | 'window' = 'vvh') {
    await open(page);
    await page.getByRole('button', { name: /expand notes/i }).tap();
    await page.getByTestId('note-new').tap();
    await page.getByTestId('note-title').fill(title);
    const surface = page.getByTestId('notes-surface');
    await surface.tap();
    await page.keyboard.insertText('## What does it take to get something from God\nAbout prayer. Persistence is a key word for this parable.\n');
    if (keyboard === 'vvh') await keyboardUp(page);
    else {
      await page.setViewportSize({ width: 393, height: 400 });
      await expect(page.getByTestId('note-new')).toBeHidden();
      await settled(page);
    }
    return surface;
  }

  async function keyboardUp(page: Page) {
    await page.addStyleTag({ content: KEYBOARD });
    await expect(page.getByTestId('note-new')).toBeHidden();
    await settled(page);
  }

  const settled = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

  test('a button beside the title folds the tools away, says what a press will do, and leaves the caret in the note', async ({ page }) => {
    const surface = await typing(page);
    const toggle = page.getByTestId('note-tools-toggle');
    const tools = page.getByTestId('editor-tools');
    await expect(toggle).toBeVisible();
    await expect(tools).toBeVisible();
    await expect(toggle).toHaveAccessibleName('Hide the formatting tools');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-controls', 'notes-tools');
    await expect(page.locator('#notes-tools')).toHaveCount(1);
    // On the title row, not a row of its own, and a finger-sized target.
    const row = (await page.locator('.notes__title-row').boundingBox())!;
    const box = (await toggle.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(row.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(row.y + row.height + 1);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // Not the menus button's caret: a picture of its own.
    await expect(toggle.locator('svg[data-icon="a-large-small"]')).toHaveCount(1);
    await expect(toggle.locator('svg[data-icon^="chevron"]')).toHaveCount(0);

    const before = (await surface.boundingBox())!.height;
    const tap = async () => {
      const b = (await toggle.boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    };
    await tap();
    await expect(tools).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAccessibleName('Show the formatting tools');
    // The press left focus, and so the keyboard, in the note.
    await expect(surface).toBeFocused();
    // The note has the tools' row.
    await settled(page);
    expect((await surface.boundingBox())!.height).toBeGreaterThan(before + 40);

    // Focus moving never changes it: not into the title, not out of the note.
    await page.getByTestId('note-title').focus();
    await expect(tools).toBeHidden();
    await surface.focus();
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await expect(tools).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // A second press brings them back.
    await surface.focus();
    await tap();
    await expect(tools).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(surface).toBeFocused();
  });

  test('the choice is kept on this device, and a tall sheet shows the tools whatever it says', async ({ page }) => {
    await typing(page);
    const toggle = page.getByTestId('note-tools-toggle');
    await toggle.tap();
    await expect(page.getByTestId('editor-tools')).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scriptura-display') || '{}').noteTools))
      .toBe(false);

    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /expand notes/i }).tap();
    await page.getByTestId('notes-surface').tap();
    await expect(page.getByTestId('pane-notes')).toHaveAttribute('data-sheet', 'full');
    // No keyboard: a tall sheet. The tools show, and the button is not drawn.
    await settled(page);
    await expect(page.getByTestId('editor-tools')).toBeVisible();
    await expect(toggle).toBeHidden();

    // The keyboard comes up: still folded, as the reader left it.
    await keyboardUp(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAccessibleName('Show the formatting tools');
    await expect(page.getByTestId('editor-tools')).toBeHidden();
  });

  test('while the note is typed into, its title is smaller and still shown whole; in the title it is full size', async ({ page }) => {
    const LONG = 'November 8 Morning service at the church on the hill, with the youth group and the choir';
    const surface = await typing(page, LONG);
    const title = page.getByTestId('note-title');
    const look = () =>
      page.evaluate(() => {
        const field = document.querySelector<HTMLTextAreaElement>('.notes__title')!;
        const row = document.querySelector('.notes__title-row')!.getBoundingClientRect();
        const body = document.querySelector('.sheet__body')!.getBoundingClientRect();
        return {
          size: parseFloat(getComputedStyle(field).fontSize),
          // Every line of the title is drawn: the field is as tall as its text.
          whole: field.scrollHeight <= field.clientHeight + 1,
          lines: Math.round((field.clientHeight - 2 * parseFloat(getComputedStyle(field).paddingTop)) / parseFloat(getComputedStyle(field).lineHeight)),
          above: row.top - body.top,
          height: row.height,
        };
      });
    await expect(surface).toBeFocused();
    const typing_ = await look();
    await title.focus();
    await settled(page);
    const titled = await look();

    // Smaller type, and the room above the row given to the note.
    expect(typing_.size).toBeLessThan(titled.size * 0.9);
    expect(typing_.above).toBeLessThanOrEqual(5);
    expect(typing_.height).toBeLessThan(titled.height);
    // Whole in both: it wraps, and is never cut to a line.
    expect(typing_.whole).toBe(true);
    expect(titled.whole).toBe(true);
    expect(typing_.lines).toBeGreaterThan(1);
    // And all of it is still the field's value, for a screen reader.
    await expect(title).toHaveValue(LONG);

    // A short title is one line, centred in the row's 44px.
    await title.fill(TITLE);
    await surface.focus();
    await settled(page);
    const short = await look();
    expect(short.height).toBeLessThanOrEqual(44 + 1);
    expect(short.lines).toBe(1);

    // A tall sheet keeps the title as it was.
    await page.evaluate(() => document.querySelectorAll('style').forEach((s) => s.textContent?.includes('--vvh') && s.remove()));
    await settled(page);
    await surface.focus();
    expect((await look()).size).toBeCloseTo(titled.size, 1);
  });

  for (const [scheme, media] of [
    ['light', { colorScheme: 'light' }],
    ['dark', { colorScheme: 'dark' }],
    ['forced colours', { forcedColors: 'active' }],
  ] as const) {
    test(`axe finds nothing with the tools open and folded, in ${scheme}`, async ({ page }) => {
      await page.emulateMedia(media);
      await typing(page, TITLE, 'window');
      const toggle = page.getByTestId('note-tools-toggle');
      for (const expanded of ['true', 'false']) {
        await expect(toggle).toHaveAttribute('aria-expanded', expanded);
        const results = await axeFor(page).analyze();
        expect(results.violations, describeViolations(results)).toEqual([]);
        if (expanded === 'true') await toggle.tap();
      }
      // The button shows the focus ring when the keyboard reaches it: the
      // next stop after the title.
      await page.getByTestId('note-title').focus();
      await page.keyboard.press('Tab');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveCSS('outline-style', 'solid');
    });
  }
});
