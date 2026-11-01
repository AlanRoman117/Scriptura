import { expect, test, type Page } from '@playwright/test';
import { noteValue, storedBodies, switchEditor, usePlainEditor } from '../helpers/note';

/**
 * The heading pinned over the plain editor names the section the caret is in.
 *
 * It is worked out from the textarea, so everything that moves the caret or
 * changes the text has to reach it, and they do not all arrive the same way:
 * some are events on the field, some only change the note from outside, and
 * some bring a different field altogether. This walks every one of them, each
 * asserting the words shown (tests/reader/fast-typing.spec.ts holds the other
 * half: that typing leaves no render queued while doing it).
 */

const BODY = '# Opening\n\nfirst text\n\n## Middle\n\nsecond text\n\n## Last\n\nthird text';

/**
 * The key that takes the caret to the end of a note, on this system.
 *
 * ⚠️ Not `ControlOrMeta+End`. That alias is right for Cmd+A and Cmd+Z, but macOS
 * binds nothing to Cmd+End, so on a Mac the caret stayed where it was and the
 * heading was right not to change. Ubuntu passed; macOS did not. See `caretAt` in
 * study.spec.ts for the same trap with Home.
 */
const END_OF_NOTE = process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End';

async function openNote(page: Page, body = BODY) {
  await usePlainEditor(page);
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('note-new').click();
  const surface = page.getByTestId('notes-surface');
  await surface.fill(body);
  return surface;
}

const shown = (page: Page) => page.getByTestId('notes-heading');

/** Put the caret at the start of `needle`, the last step by a key, as a reader's gets there. */
async function caretAt(page: Page, needle: string) {
  const surface = page.getByTestId('notes-surface');
  await surface.focus();
  await surface.evaluate((el: HTMLTextAreaElement, text) => {
    const at = el.value.indexOf(text);
    if (at < 1) throw new Error(`no "${text}" after the start of the note`);
    el.setSelectionRange(at - 1, at - 1);
  }, needle);
  await page.keyboard.press('ArrowRight');
}

test.describe('the heading over the plain editor follows the caret', () => {
  test('there is none before a note, and none in a note without a heading', async ({ page }) => {
    await usePlainEditor(page);
    await page.goto('/');
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('note-start')).toBeVisible();
    await expect(shown(page)).toHaveCount(0);

    await page.getByTestId('note-start').click();
    await expect(page.getByTestId('notes-surface')).toBeVisible();
    await expect(shown(page)).toHaveCount(0);
  });

  test('typing a heading, key by key, and taking it apart', async ({ page }) => {
    await usePlainEditor(page);
    await page.goto('/');
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('note-new').click();
    await page.getByTestId('notes-surface').click();

    await page.keyboard.type('## ');
    await expect(shown(page)).toHaveCount(0);
    for (const [key, words] of [['W', 'W'], ['o', 'Wo'], ['r', 'Wor'], ['d', 'Word']] as const) {
      await page.keyboard.press(key);
      await expect(shown(page)).toHaveText(words);
    }
    await page.keyboard.press('Backspace');
    await expect(shown(page)).toHaveText('Wor');

    // A new line is still under it; losing the marks takes the heading away.
    await page.keyboard.press('Enter');
    await page.keyboard.type('prose');
    await expect(shown(page)).toHaveText('Wor');
    await caretAt(page, 'Wor');
    await page.keyboard.press('Backspace');
    await expect(shown(page)).toHaveCount(0);
  });

  test('the arrow keys, one press at a time and held down', async ({ page }) => {
    await openNote(page);
    await caretAt(page, 'first text');
    await expect(shown(page)).toHaveText('Opening');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(shown(page)).toHaveText('Middle');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(shown(page)).toHaveText('Opening');

    // A key held down repeats with no keyup until it is let go.
    for (let i = 0; i < 6; i++) await page.keyboard.down('ArrowDown');
    await expect(shown(page)).toHaveText('Last');
    await page.keyboard.up('ArrowDown');
    await expect(shown(page)).toHaveText('Last');
  });

  test('a click', async ({ page }) => {
    const surface = await openNote(page);
    const box = (await surface.boundingBox())!;
    // The top of the field is the first line; below the text is its end.
    await page.mouse.click(box.x + 30, box.y + 12);
    await expect(shown(page)).toHaveText('Opening');
    await page.mouse.click(box.x + 30, box.y + box.height - 4);
    await expect(shown(page)).toHaveText('Last');
  });

  test('a selection is under the heading of where it starts', async ({ page }) => {
    const surface = await openNote(page);
    await caretAt(page, 'third text');
    await expect(shown(page)).toHaveText('Last');

    await page.keyboard.down('Shift');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
    await page.keyboard.up('Shift');
    await expect(shown(page)).toHaveText('Middle');

    await page.keyboard.press('ControlOrMeta+a');
    await expect(shown(page)).toHaveText('Opening');

    // And with the mouse, from the bottom of the field to its top.
    await caretAt(page, 'third text');
    await expect(shown(page)).toHaveText('Last');
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height - 4);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + 12, { steps: 4 });
    await page.mouse.up();
    await expect(shown(page)).toHaveText('Opening');
  });

  test('the formatting tools', async ({ page }) => {
    const surface = await openNote(page);
    await caretAt(page, 'second text');
    await expect(shown(page)).toHaveText('Middle');

    // React writing the new text sends the caret to the end, under "Last",
    // until the tool puts it back. Nothing of that may show.
    await page.evaluate(() => {
      const w = window as unknown as { __seen: (string | null)[] };
      w.__seen = [];
      const look = () => w.__seen.push(document.querySelector('[data-testid="notes-heading"]')?.textContent ?? null);
      new MutationObserver(look).observe(document.querySelector('.notes__editor')!, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    await page.getByTestId('tool-bold').click();
    await expect.poll(() => noteValue(surface)).toContain('****second text');
    await expect(shown(page)).toHaveText('Middle');

    // A line made a heading is its own heading, and is not one after again.
    await page.getByTestId('tool-h2').click();
    await expect(shown(page)).toHaveText('****second text');
    await page.getByTestId('tool-h2').click();
    await expect(shown(page)).toHaveText('Middle');

    const seen = await page.evaluate(() => (window as unknown as { __seen: (string | null)[] }).__seen);
    expect(seen).not.toContain('Last');
    expect(seen).not.toContain(null);
  });

  test('undo and redo', async ({ page }) => {
    await openNote(page);
    await caretAt(page, 'first text');
    await page.keyboard.press(END_OF_NOTE);
    await expect(shown(page)).toHaveText('Last');
    await page.keyboard.press('Enter');
    await page.keyboard.type('## Added');
    await expect(shown(page)).toHaveText('Added');

    const surface = page.getByTestId('notes-surface');
    // However many steps the browser made of it, back to where it was...
    await page.keyboard.press('ControlOrMeta+z');
    for (let i = 0; i < 12 && (await noteValue(surface)) !== BODY; i++) {
      await page.keyboard.press('ControlOrMeta+z');
    }
    await expect(surface).toHaveValue(BODY);
    await expect(shown(page)).toHaveText('Last');
    // ...and forward again.
    for (let i = 0; i < 12 && (await noteValue(surface)) !== `${BODY}\n## Added`; i++) {
      await page.keyboard.press('ControlOrMeta+Shift+z');
    }
    await expect(surface).toHaveValue(`${BODY}\n## Added`);
    await expect(shown(page)).toHaveText('Added');

    // From the menu there is no key to follow, only the edit.
    await page.evaluate(() => document.execCommand('undo'));
    await expect(surface).not.toHaveValue(`${BODY}\n## Added`);
    await expect(shown(page)).toHaveText(headingFor(await noteValue(surface), (await noteValue(surface)).length));
    await page.evaluate(() => document.execCommand('redo'));
    await expect(shown(page)).toHaveText('Added');
  });

  test('a paste', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const surface = await openNote(page);
    await caretAt(page, 'first text');
    await expect(shown(page)).toHaveText('Opening');
    await page.evaluate(() => navigator.clipboard.writeText('## Pasted\n\nbelow it\n'));
    await page.keyboard.press('ControlOrMeta+v');
    await expect.poll(() => noteValue(surface)).toContain('## Pasted');
    await expect(shown(page)).toHaveText('Pasted');
  });

  test('a drop', async ({ page }) => {
    const surface = await openNote(page);
    await caretAt(page, 'first text');
    await expect(shown(page)).toHaveText('Opening');

    // Text from outside the page, onto the first line, which is a heading.
    const cdp = await page.context().newCDPSession(page);
    const box = (await surface.boundingBox())!;
    const event = {
      x: box.x + 60,
      y: box.y + 12,
      modifiers: 0,
      data: { items: [{ mimeType: 'text/plain', data: 'Dropped' }], dragOperationsMask: 1 },
    };
    await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', ...event });
    await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', ...event });
    await cdp.send('Input.dispatchDragEvent', { type: 'drop', ...event });

    await expect.poll(() => noteValue(surface)).toContain('Dropped');
    const first = (await noteValue(surface)).split('\n')[0];
    expect(first).toMatch(/^# .*Dropped/);
    await expect(shown(page)).toHaveText(first.slice(2).trim());
  });

  test('a quote or a link from the Bible, added at the end', async ({ page }) => {
    const surface = await openNote(page, '# Opening\n\nfirst text\n\n## Last');
    await caretAt(page, 'first text');
    await expect(shown(page)).toHaveText('Opening');

    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    await expect.poll(() => noteValue(surface)).toContain('> In the beginning');
    // The field had lost focus, so it went to the end, and so did the caret.
    await expect(shown(page)).toHaveText('Last');
    await caretAt(page, 'first text');
    await expect(shown(page)).toHaveText('Opening');

    await page.getByTestId('verse-2').click();
    await page.getByTestId('link-2').click();
    await expect.poll(() => noteValue(surface)).toContain('[[john 1:2');
    await expect(shown(page)).toHaveText('Last');
  });

  test('a quote added at the caret, where the field kept its focus', async ({ page }) => {
    const surface = await openNote(page);
    await page.getByTestId('verse-1').click();
    await caretAt(page, 'first text');
    await expect(shown(page)).toHaveText('Opening');

    // A press that does not take focus: the keyboard's way to a control can
    // not do this, but a browser that does not focus a pressed button can.
    await page.getByTestId('quote-1').evaluate((el) => (el as HTMLButtonElement).click());
    await expect.poll(() => noteValue(surface)).toContain('> In the beginning');
    await expect(surface).toBeFocused();
    const before = await surface.evaluate((el: HTMLTextAreaElement) => el.value.slice(0, el.selectionStart));
    expect(before).toContain('> In the beginning');
    expect(before).not.toContain('## Middle');
    await expect(shown(page)).toHaveText('Opening');
  });

  test('a quote that starts a note', async ({ page }) => {
    await usePlainEditor(page);
    await page.goto('/');
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    await expect.poll(() => noteValue(page.getByTestId('notes-surface'))).toContain('> In the beginning');
    await expect(shown(page)).toHaveCount(0);
  });

  test('switching notes', async ({ page }) => {
    const surface = await openNote(page);
    await expect(shown(page)).toHaveText('Last');
    const first = await page.getByTestId('note-select').inputValue();

    await page.getByTestId('note-new').click();
    await expect(surface).toHaveValue('');
    await expect(shown(page)).toHaveCount(0);
    await surface.fill('## Other note\n\nits text');
    await expect(shown(page)).toHaveText('Other note');
    const second = await page.getByTestId('note-select').inputValue();

    await page.getByTestId('note-select').selectOption(first);
    await expect(surface).toHaveValue(BODY);
    await expect(shown(page)).toHaveText('Last');
    await page.getByTestId('note-select').selectOption(second);
    await expect(shown(page)).toHaveText('Other note');
  });

  test('a note loaded at startup', async ({ page }) => {
    await openNote(page);
    await expect.poll(() => storedBodies(page), { timeout: 10_000 }).toContain(BODY);
    await page.reload();
    await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
    const surface = page.getByTestId('notes-surface');
    await expect(surface).toHaveValue(BODY);
    // Nothing has moved the caret: a field drawn with its text starts at the top.
    expect(await surface.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(0);
    await expect(shown(page)).toHaveText('Opening');
  });

  test('switching to the live editor and back', async ({ page }) => {
    const surface = await openNote(page);
    await caretAt(page, 'second text');
    await expect(shown(page)).toHaveText('Middle');

    // A new field each way, with its own caret at the top of the note: the
    // heading is that caret's, not the one left behind.
    await switchEditor(page, 'live');
    await expect(surface).toHaveAttribute('role', 'textbox');
    expect(await surface.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(0);
    await expect(shown(page)).toHaveText('Opening');

    // Moved in the live editor, then back to a textarea.
    await surface.click();
    await page.keyboard.press(END_OF_NOTE);
    await expect(shown(page)).toHaveText('Last');
    await switchEditor(page, 'plain');
    await expect(surface).toHaveJSProperty('tagName', 'TEXTAREA');
    expect(await surface.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(0);
    await expect(shown(page)).toHaveText('Opening');
  });

  test('coming back from the preview', async ({ page }) => {
    const surface = await openNote(page);
    await caretAt(page, 'second text');
    await expect(shown(page)).toHaveText('Middle');

    await page.getByTestId('note-preview').click();
    await expect(shown(page)).toHaveCount(0);
    await page.getByTestId('note-preview').click();
    await expect(surface).toBeVisible();
    // A new textarea, with its caret at the top of the note.
    expect(await surface.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(0);
    await expect(shown(page)).toHaveText('Opening');

    // Clicking a block in the preview puts the caret in that block.
    await page.getByTestId('note-preview').click();
    await page.getByTestId('notes-preview').getByText('second text').click();
    await expect(surface).toBeVisible();
    await expect(shown(page)).toHaveText('Middle');
    await page.keyboard.press('ArrowLeft');
    await expect(shown(page)).toHaveText('Middle');
  });

  test('an input method composition', async ({ page }) => {
    const surface = await openNote(page, '## ');
    await surface.focus();
    await page.keyboard.press(END_OF_NOTE);
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Input.imeSetComposition', { text: 'か', selectionStart: 1, selectionEnd: 1 });
    await expect(shown(page)).toHaveText('か');
    await cdp.send('Input.imeSetComposition', { text: 'かみ', selectionStart: 2, selectionEnd: 2 });
    await expect(shown(page)).toHaveText('かみ');
    // Still composing: nothing drawn around it may have ended it.
    await cdp.send('Input.imeSetComposition', { text: 'かみさ', selectionStart: 3, selectionEnd: 3 });
    await expect(surface).toHaveValue('## かみさ');
    await expect(shown(page)).toHaveText('かみさ');

    await cdp.send('Input.insertText', { text: '神様' });
    await expect(surface).toHaveValue('## 神様');
    await expect(shown(page)).toHaveText('神様');
  });
});

/** What the heading should be at a caret the browser chose. */
function headingFor(text: string, offset: number): string {
  let heading = '';
  let index = 0;
  for (const line of text.split('\n')) {
    if (index > offset) break;
    const match = /^#{1,6}\s+(.*)$/.exec(line);
    if (match) heading = match[1].trim();
    index += line.length + 1;
  }
  return heading;
}
