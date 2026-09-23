import { expect, test, type Page } from '@playwright/test';
import { storedBodies } from '../helpers/note';

/**
 * The live editor: Markdown drawn as it is written, the way Obsidian's live
 * preview works. The page's text is the note, character for character, and
 * a line's markers show only while the caret is on it.
 */

async function open(page: Page) {
  await page.addInitScript(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('scriptura-display') || '{}');
      localStorage.setItem('scriptura-display', JSON.stringify({ ...stored, editor: 'live' }));
    } catch {
      /* the test fails on its own if this did not take */
    }
  });
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('note-new').click();
  const surface = page.getByTestId('notes-surface');
  await expect(surface).toHaveAttribute('contenteditable', /plaintext-only|true/);
  return surface;
}

const noteText = (page: Page) =>
  page.getByTestId('notes-surface').evaluate((el) => (el as HTMLTextAreaElement).value);

test.describe('the live editor', () => {
  test('draws a heading while it is typed, and hides its marker off the line', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('## The prologue');
    const line = surface.locator('.live-line').first();
    await expect(line).toHaveClass(/live-line--h2/);
    // On the caret's line the marker is there to edit.
    await expect(line.locator('.md-mark')).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.type('In the beginning');
    // Off it, only the words.
    await expect(line.locator('.md-mark')).toBeHidden();
    await expect(line).toHaveText('## The prologue');
    await expect.poll(() => noteText(page)).toBe('## The prologue\nIn the beginning');
    const size = (i: number) =>
      surface.locator('.live-line').nth(i).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size(0)).toBeGreaterThan(await size(1));
  });

  test('bold shows as bold, and the caret survives the redraw mid-line', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('the **Word** was');
    await expect(surface.locator('.md-strong:not(.md-mark)')).toHaveText('Word');
    // Back into the middle of the line, and keep typing there.
    await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(4, 4));
    await page.keyboard.type('living ');
    await expect.poll(() => noteText(page)).toBe('the living **Word** was');
    expect(await surface.evaluate((el) => (el as HTMLTextAreaElement).selectionStart)).toBe(11);
  });

  test('Enter, Backspace across lines, and paste are plain text', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('two');
    await expect.poll(() => noteText(page)).toBe('one\ntwo');
    await page.keyboard.press('Home');
    await page.keyboard.press('Backspace');
    await expect.poll(() => noteText(page)).toBe('onetwo');
    await expect(surface.locator('.live-line')).toHaveCount(1);

    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', '\r\n> quoted\r\n');
      data.setData('text/html', '<b>markup</b>');
      document.getElementById('notes-surface')!.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
      );
    });
    await expect.poll(() => noteText(page)).toBe('one\n> quoted\ntwo');
    await expect(surface.locator('.live-line--quote')).toHaveCount(1);
  });

  test('undo and redo, across a formatting button', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('grace and truth');
    await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(0, 5));
    await page.getByTestId('tool-bold').click();
    await expect.poll(() => noteText(page)).toBe('**grace** and truth');
    await surface.focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => noteText(page)).toBe('grace and truth');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => noteText(page)).toBe('grace and ');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(() => noteText(page)).toBe('grace and truth');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(() => noteText(page)).toBe('**grace** and truth');
  });

  test('what is typed is what is stored', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('- first\n- **second**\n\n1. one');
    await expect.poll(() => noteText(page)).toBe('- first\n- **second**\n\n1. one');
    await expect.poll(() => storedBodies(page), { timeout: 10_000 }).toContain('- first\n- **second**\n\n1. one');
  });

  test('a link is drawn as one, and Ctrl or ⌘ + click follows it', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('a thought about [[psalms 23:1]] here\nnext line');
    const link = surface.locator('.md-link:not(.md-mark)');
    await expect(link).toHaveText('psalms 23:1');
    // A plain click only places the caret, as in any text.
    await link.click();
    await expect(page.getByTestId('chapter-title')).not.toContainText('Psalms 23');
    await expect(page.getByTestId('notes-follow-link')).toContainText('Psalms 23:1');
    await link.click({ modifiers: ['ControlOrMeta'] });
    await expect(page.getByTestId('chapter-title')).toContainText('Psalms 23');
  });

  /*
   * Japanese and Chinese are typed through an input method: the text is
   * composed in place, and only committed when a candidate is chosen. Chromium
   * lets a test drive a real composition through the DevTools protocol.
   */
  test('an input method composes undisturbed, and its text is kept', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('**強調** ');
    const cdp = await page.context().newCDPSession(page);
    // Tag the line element: a redraw would replace it.
    await surface.locator('.live-line').first().evaluate((el) => ((el as HTMLElement).dataset.probe = 'kept'));

    for (const partial of ['か', 'かみ', '神']) {
      await cdp.send('Input.imeSetComposition', { text: partial, selectionStart: partial.length, selectionEnd: partial.length });
      // Nothing is redrawn while the composition is open.
      await expect(surface.locator('.live-line').first()).toHaveAttribute('data-probe', 'kept');
    }
    await cdp.send('Input.insertText', { text: '神' });
    await expect.poll(() => noteText(page)).toBe('**強調** 神');

    // And once it ends, the line is drawn again, markers and all.
    await page.keyboard.type('は愛');
    await expect.poll(() => noteText(page)).toBe('**強調** 神は愛');
    await expect(surface.locator('.md-strong:not(.md-mark)')).toHaveText('強調');

    // Chinese, the same way.
    await page.keyboard.press('Enter');
    for (const partial of ['s', 'sh', 'shen', '神']) {
      await cdp.send('Input.imeSetComposition', { text: partial, selectionStart: partial.length, selectionEnd: partial.length });
    }
    await cdp.send('Input.insertText', { text: '神爱世人' });
    await expect.poll(() => noteText(page)).toBe('**強調** 神は愛\n神爱世人');
  });

  test('a quote from the Bible is drawn as a quote, and typing continues below it', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('Before');
    await page.getByTestId('verse-1').click();
    await page.getByTestId('quote-1').click();
    await expect.poll(() => noteText(page)).toMatch(/^Before\n\n> In the beginning was the Word[\s\S]*\[\[john 1:1@bsb\]\]\n\n$/);
    // The caret was handed back on the blank line after the quote.
    await page.keyboard.type('The claim.');
    await expect.poll(() => noteText(page)).toMatch(/\[\[john 1:1@bsb\]\]\n\nThe claim\.$/);
    await expect(surface.locator('.live-line--quote').first()).toBeVisible();
    // Off the caret's line, a quote shows its words and not its `>`.
    await expect(surface.locator('.live-line--quote').first().locator('.md-mark')).toBeHidden();
  });

  test('a board embed is drawn in place, and opens as text when the caret enters it', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('Intro\n```scriptura-board\nno-such-board\n```\nOutro');
    await expect.poll(() => noteText(page)).toBe('Intro\n```scriptura-board\nno-such-board\n```\nOutro');
    // The caret is on the last line, so the board is drawn and its fence hidden.
    await expect(surface.getByTestId('board-embed-missing')).toBeVisible();
    await expect(surface.locator('.live-line--board')).toBeHidden();
    // With the caret inside the fence, the text is there to edit instead.
    await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(28, 28));
    await expect(surface.locator('.live-line--board')).toBeVisible();
    await expect(surface.getByTestId('board-embed-missing')).toBeHidden();
    // And the drawing is never part of the note.
    expect(await noteText(page)).toBe('Intro\n```scriptura-board\nno-such-board\n```\nOutro');
  });

  test('a screen reader hears the words, not the markers, off the caret line', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('## Covenant\nThe **promise** kept');
    await page.getByTestId('note-title').focus();
    // innerText leaves out what is not rendered, as the accessibility tree does.
    const spoken = await surface.evaluate((el) => (el as HTMLElement).innerText);
    expect(spoken).not.toContain('#');
    expect(spoken).not.toContain('*');
    expect(spoken).toContain('Covenant');
    expect(spoken).toContain('The promise kept');
    await expect(surface).toHaveAttribute('role', 'textbox');
    await expect(surface).toHaveAttribute('aria-multiline', 'true');
  });

  test('a long note redraws one line per keystroke', async ({ page }) => {
    const surface = await open(page);
    const note = Array.from({ length: 2000 }, (_, i) => (i % 10 === 0 ? `## Part ${i}` : `Line ${i} with **bold** and [[john 3:${i}]]`)).join('\n');
    await surface.click();
    await page.evaluate((text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      document.getElementById('notes-surface')!.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
      );
    }, note);
    await expect.poll(() => noteText(page)).toBe(note);
    await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(5, 5));
    const timing = await page.evaluate(() => {
      const el = document.getElementById('notes-surface')!;
      const first = el.children[1];
      const started = performance.now();
      for (let i = 0; i < 20; i++) document.execCommand('insertText', false, 'x');
      return { ms: (performance.now() - started) / 20, untouched: el.children[1] === first };
    });
    expect(timing.untouched).toBe(true);
    // Generous for a slow runner; a full redraw of 2,000 lines takes far longer.
    expect(timing.ms).toBeLessThan(50);
  });

  /*
   * The browser's own multi-line insertion (dictation, a keyboard's text
   * replacement) fires an input event per line and per break. Read back and
   * redrawn on every one, 400 lines took four seconds; once per burst, a
   * fraction of one.
   */
  test("the browser's own multi-line insert is read back once, not per line", async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    const result = await page.evaluate(async () => {
      const text = Array.from({ length: 400 }, (_, i) => `Line ${i} **b**`).join('\n');
      const started = performance.now();
      document.execCommand('insertText', false, text);
      await Promise.resolve();
      const el = document.getElementById('notes-surface') as unknown as HTMLTextAreaElement;
      return { ms: performance.now() - started, same: el.value === text };
    });
    expect(result.same).toBe(true);
    expect(result.ms).toBeLessThan(2_000);
  });
});

