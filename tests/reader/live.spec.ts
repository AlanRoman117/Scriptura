import { expect, test, type Page } from '@playwright/test';
import { markerShown, storedBodies, switchEditor } from '../helpers/note';

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
    await expect.poll(() => markerShown(line.locator('.md-mark'))).toBe(true);
    await page.keyboard.press('Enter');
    await page.keyboard.type('In the beginning');
    // Off it, only the words.
    await expect.poll(() => markerShown(line.locator('.md-mark'))).toBe(false);
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
    // ⚠️ Not Home: macOS binds no "start of line" to it in a text field, so the
    // caret stayed at the end there and Backspace took the "o" (see CLAUDE.md).
    await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(4, 4));
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
    // The commit lands in the bare run after the marks, which is what would be
    // drawn, so the line is kept rather than drawn again.
    await expect(surface.locator('.live-line').first()).toHaveAttribute('data-probe', 'kept');

    // Typing on, the line still reads right, markers and all.
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
    await expect.poll(() => markerShown(surface.locator('.live-line--quote').first().locator('.md-mark'))).toBe(false);
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

  /*
   * ⚠️ Hidden from sight, never from a screen reader (1.3.1). The markers are
   * how a line is known to be a heading or a word bold; with display: none they
   * left the accessibility tree and a heading was read as plain words. They are
   * clipped to a pixel instead, inline, so the line still reads as one line.
   * Checked in Chromium's own accessibility tree, and the drawn bullet — which
   * stands in for the dash — must not be read on top of it.
   */
  test('off the caret line, markers are out of sight but still read', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('## Covenant\nThe **promise** kept\n- item');
    await page.getByTestId('note-title').focus();
    for (const marker of await surface.locator('.md-mark').all()) {
      expect(await markerShown(marker)).toBe(false);
    }
    expect(await surface.evaluate((el) => (el as HTMLElement).innerText)).toBe('## Covenant\nThe **promise** kept\n- item');

    const cdp = await page.context().newCDPSession(page);
    const { root } = (await cdp.send('DOM.getDocument')) as { root: { nodeId: number } };
    const { nodeId } = (await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#notes-surface' })) as { nodeId: number };
    type AX = { nodeId: string; parentId?: string; role?: { value: string }; name?: { value: string } };
    const [box] = ((await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false })) as { nodes: AX[] }).nodes;
    const all = ((await cdp.send('Accessibility.getFullAXTree')) as { nodes: AX[] }).nodes;
    const inside = new Set([box.nodeId]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const n of all) if (n.parentId && inside.has(n.parentId) && !inside.has(n.nodeId)) grew = inside.add(n.nodeId) !== null;
    }
    const spoken = all.filter((n) => inside.has(n.nodeId) && n.role?.value === 'StaticText').map((n) => n.name?.value ?? '');
    expect(box.role?.value).toBe('textbox');
    expect(spoken).toEqual(expect.arrayContaining(['## ', '**', '- ']));
    expect(spoken.join('')).not.toContain('•');
    await expect(surface).toHaveAttribute('aria-multiline', 'true');
  });

  test('offers no Preview, which Plain text brings back', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('note-preview')).toHaveCount(0);
    await switchEditor(page, 'plain');
    await expect(page.getByTestId('note-preview')).toBeVisible();
    await page.getByTestId('note-preview').click();
    await expect(page.getByTestId('notes-preview')).toBeVisible();
    // Back to Live, writing — never a preview left open in the other editor.
    await switchEditor(page, 'live');
    await expect(page.getByTestId('notes-preview')).toHaveCount(0);
    await expect(page.getByTestId('notes-surface')).toHaveAttribute('role', 'textbox');
    await switchEditor(page, 'plain');
    await expect(page.getByTestId('notes-surface')).toHaveJSProperty('tagName', 'TEXTAREA');
  });

  /*
   * The focus ring is drawn inside the note (outline-offset -2px). With the
   * text against the edge it sat over the caret at the start of every line.
   */
  for (const editor of ['live', 'plain'] as const) {
    test(`the caret at the start of a line is clear of the focus ring (${editor})`, async ({ page }) => {
      const surface = await open(page);
      if (editor === 'plain') await switchEditor(page, 'plain');
      await surface.click();
      await page.keyboard.type('In the beginning');
      const gap = await surface.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const ring = parseFloat(style.outlineWidth) + Math.max(0, -parseFloat(style.outlineOffset));
        let textLeft: number;
        if (el instanceof HTMLTextAreaElement) {
          textLeft = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
        } else {
          const range = document.createRange();
          const text = el.querySelector('.live-line')!.firstChild!;
          range.setStart(text, 0);
          range.setEnd(text, 0);
          textLeft = range.getBoundingClientRect().left;
        }
        return textLeft - box.left - ring;
      });
      expect(gap).toBeGreaterThanOrEqual(8);
    });
  }

  // The title draws its ring inside too, and had no padding at all.
  test("the note title's text is clear of its focus ring", async ({ page }) => {
    await open(page);
    const title = page.getByTestId('note-title');
    await title.focus();
    await page.keyboard.type('Prologue');
    const gap = await title.evaluate((el) => {
      const style = getComputedStyle(el);
      const ring = parseFloat(style.outlineWidth) + Math.max(0, -parseFloat(style.outlineOffset));
      return parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft) - ring;
    });
    expect(gap).toBeGreaterThanOrEqual(8);
    // And its words line up with the note's.
    const left = (id: string) =>
      page.getByTestId(id).evaluate((el) => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft));
    expect(Math.abs((await left('note-title')) - (await left('notes-surface')))).toBeLessThan(1);
  });

  /*
   * Direction is per line, from the line's own text — not from the interface
   * language, since a note's language is its writer's. A Hebrew word quoted in
   * a study note runs right to left beside English.
   */
  test('a Hebrew line runs right to left, beside a left-to-right one', async ({ page }) => {
    const surface = await open(page);
    await surface.click();
    await page.keyboard.type('Shalom:\n\n');
    await page.keyboard.insertText('שלום עולם');
    await expect.poll(() => noteText(page)).toBe('Shalom:\n\nשלום עולם');
    const direction = (i: number) =>
      surface.locator('.live-line').nth(i).evaluate((el) => getComputedStyle(el).direction);
    expect(await direction(0)).toBe('ltr');
    expect(await direction(2)).toBe('rtl');
    // Typing in it keeps the note exact: offsets are logical, not visual.
    await page.keyboard.insertText(' ברוך');
    await expect.poll(() => noteText(page)).toBe('Shalom:\n\nשלום עולם ברוך');
    // The preview, with Plain text, agrees paragraph by paragraph.
    await switchEditor(page, 'plain');
    await page.getByTestId('note-preview').click();
    const paragraphs = page.getByTestId('notes-preview').locator('.preview__p');
    await expect(paragraphs).toHaveCount(2);
    expect(await paragraphs.nth(0).evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    expect(await paragraphs.nth(1).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
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
    const timing = await page.evaluate(async () => {
      const el = document.getElementById('notes-surface')!;
      const first = el.children[1];
      const typed = el.children[0];
      const started = performance.now();
      for (let i = 0; i < 20; i++) document.execCommand('insertText', false, 'x');
      const ms = (performance.now() - started) / 20;
      // The read-back runs in a microtask after the inserts: look after it.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { ms, untouched: el.children[1] === first, kept: el.children[0] === typed };
    });
    expect(timing.untouched).toBe(true);
    // The line typed into is kept as well: the x's land in the heading's own
    // text, and what the browser left is what would be drawn.
    expect(timing.kept).toBe(true);
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

  /*
   * What the browser types, the editor keeps. A line the browser edited used
   * to be removed and drawn again after every keystroke, and the selection
   * written again with it, even when both were already exactly right. The
   * browser reports each of those to the system's input method as a change —
   * one more per key than a textarea makes — and dictation typing a thousand
   * keys a second into the editor (Voxtype through `wtype`) lost half of them,
   * while the same dictation into a textarea lost none. These hold the two
   * things an engine depends on: the text node it is typing into stays, and
   * the selection is not taken away and put back.
   */
  test.describe('a burst of keys', () => {
    /** Counts the selection being taken away: what dictation cannot survive. */
    const spyOnSelection = (page: Page) =>
      page.evaluate(() => {
        const w = window as unknown as { __resets: number };
        w.__resets = 0;
        const original = Selection.prototype.removeAllRanges;
        Selection.prototype.removeAllRanges = function () {
          w.__resets += 1;
          return original.call(this);
        };
      });
    const resets = (page: Page) => page.evaluate(() => (window as unknown as { __resets: number }).__resets);
    /** Remembers a line and its text node, to see whether they survive. */
    const stamp = (page: Page, line = 0, node: 'first' | 'last' = 'first') =>
      page.evaluate(
        ([i, which]) => {
          const el = document.getElementById('notes-surface')!.children[i as number];
          (window as unknown as { __stamp: unknown }).__stamp = { line: el, text: which === 'first' ? el.firstChild : el.lastChild };
        },
        [line, node]
      );
    const kept = (page: Page, line = 0, node: 'first' | 'last' = 'first') =>
      page.evaluate(
        ([i, which]) => {
          const el = document.getElementById('notes-surface')!.children[i as number];
          const s = (window as unknown as { __stamp: { line: Element; text: Node } }).__stamp;
          return el === s.line && (which === 'first' ? el.firstChild : el.lastChild) === s.text;
        },
        [line, node]
      );
    const caret = (page: Page) =>
      page.evaluate(() => {
        const r = document.getSelection()!.getRangeAt(0);
        const s = (window as unknown as { __stamp: { text: Node } }).__stamp;
        return { inStamped: r.startContainer === s.text, offset: r.startOffset, collapsed: r.collapsed };
      });

    test('typing into a plain paragraph keeps its text node, and never takes the selection away', async ({ page }) => {
      const surface = await open(page);
      await surface.click();
      await page.keyboard.type('In the beginning');
      await stamp(page);
      await spyOnSelection(page);
      await page.keyboard.type(' was the Word');
      await expect.poll(() => noteText(page)).toBe('In the beginning was the Word');
      expect(await kept(page)).toBe(true);
      expect(await resets(page)).toBe(0);
      expect(await caret(page)).toEqual({ inStamped: true, offset: 29, collapsed: true });
    });

    // Keys sent without waiting for each to be handled, with a frame wanted
    // between them, as a device's own typing arrives. Every one must land.
    test('sixty keys fired at once all arrive, in order', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const surface = await open(page);
      await surface.click();
      await page.evaluate(() => {
        const again = () => requestAnimationFrame(again);
        requestAnimationFrame(again);
      });
      const text = 'Doing a quick test for dictation to make sure it comes along right';
      const cdp = await page.context().newCDPSession(page);
      const sent: Promise<unknown>[] = [];
      for (const ch of text) {
        sent.push(cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, unmodifiedText: ch }));
        sent.push(cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }));
      }
      await Promise.all(sent);
      await expect.poll(() => noteText(page)).toBe(text);
      expect(errors).toEqual([]);
    });

    /*
     * An input method, and dictation on macOS and Windows, compose a phrase,
     * commit it, and revise earlier words by replacing a range of what was
     * committed. Chromium lets a test drive exactly that through the DevTools
     * protocol. The text must come out right, the line and its text node must
     * survive every commit, and the selection must not be taken away.
     */
    test('a dictation-like session of compositions, commits and revisions', async ({ page }) => {
      const surface = await open(page);
      await surface.click();
      await page.keyboard.type('Note: ');
      await stamp(page);
      await spyOnSelection(page);
      const cdp = await page.context().newCDPSession(page);
      const compose = (text: string, extra: Record<string, number> = {}) =>
        cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length, ...extra });

      await compose('Hel');
      await compose('Hello');
      await cdp.send('Input.insertText', { text: 'Hello' });
      await expect.poll(() => noteText(page)).toBe('Note: Hello');
      expect(await kept(page)).toBe(true);
      expect(await resets(page)).toBe(0);
      expect(await caret(page)).toEqual({ inStamped: true, offset: 11, collapsed: true });

      await compose(' world');
      await cdp.send('Input.insertText', { text: ' world' });
      await expect.poll(() => noteText(page)).toBe('Note: Hello world');
      expect(await kept(page)).toBe(true);
      expect(await resets(page)).toBe(0);

      // Revising "Hello" to "Hallo" over the committed range.
      await compose('Hallo', { replacementStart: 6, replacementEnd: 11 });
      await cdp.send('Input.insertText', { text: 'Hallo' });
      await expect.poll(() => noteText(page)).toBe('Note: Hallo world');
      expect(await kept(page)).toBe(true);
      expect(await resets(page)).toBe(0);
      expect(await caret(page)).toMatchObject({ inStamped: true, collapsed: true });

      // Appending by range, as an engine does at the end of a phrase.
      await compose('!', { replacementStart: 17, replacementEnd: 17 });
      await cdp.send('Input.insertText', { text: '!' });
      await expect.poll(() => noteText(page)).toBe('Note: Hallo world!');
      expect(await kept(page)).toBe(true);
      expect(await resets(page)).toBe(0);

      // "New line", then a phrase on it: the new line is drawn (a blank line
      // becoming a paragraph), and from then on kept.
      await page.keyboard.press('Enter');
      await expect.poll(() => noteText(page)).toBe('Note: Hallo world!\n');
      expect(await kept(page)).toBe(true);
      await compose('Amen');
      await cdp.send('Input.insertText', { text: 'Amen' });
      await expect.poll(() => noteText(page)).toBe('Note: Hallo world!\nAmen');
      await stamp(page, 1);
      const before = await resets(page);
      await compose(' indeed');
      await cdp.send('Input.insertText', { text: ' indeed' });
      await expect.poll(() => noteText(page)).toBe('Note: Hallo world!\nAmen indeed');
      expect(await kept(page, 1)).toBe(true);
      expect(await resets(page)).toBe(before);
    });

    test('the editor\'s undo waits for an open composition to end', async ({ page }) => {
      const surface = await open(page);
      await surface.click();
      await page.keyboard.type('Note: ');
      await surface.locator('.live-line').first().evaluate((el) => ((el as HTMLElement).dataset.probe = 'kept'));
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.imeSetComposition', { text: 'か', selectionStart: 1, selectionEnd: 1 });
      await page.keyboard.press('Control+z');
      await expect(surface.locator('.live-line').first()).toHaveAttribute('data-probe', 'kept');
      await cdp.send('Input.insertText', { text: '神' });
      await expect.poll(() => noteText(page)).toBe('Note: 神');
    });

    /*
     * Keeping a line is only right when it is what would be drawn. These are
     * the edits that still need a redraw, and get one.
     */
    test('a line is still drawn again when the browser left it other than it would be drawn', async ({ page }) => {
      const surface = await open(page);
      await surface.click();

      // Closing a bold run: the bare text node becomes marks and a strong span.
      await page.keyboard.type('the **Word');
      await stamp(page);
      await page.keyboard.type('**');
      await expect(surface.locator('.md-strong:not(.md-mark)')).toHaveText('Word');
      expect(await kept(page)).toBe(false);

      // A letter typed at the edge of a marker lands inside the marker's
      // span, which tokenizes the same; it is moved out by the redraw.
      await page.keyboard.type(' was');
      await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(12, 12));
      await page.keyboard.type('x');
      await expect.poll(() => noteText(page)).toBe('the **Word**x was');
      expect(await surface.locator('.md-mark').allTextContents()).toEqual(['**', '**']);
      await expect(surface.locator('.md-strong:not(.md-mark)')).toHaveText('Word');

      // A <br> the browser left on a line with text, and an empty line that
      // lost the <br> that holds it open.
      await surface.evaluate((el) => {
        const field = el as unknown as HTMLTextAreaElement;
        field.setSelectionRange(field.value.length, field.value.length);
      });
      await page.keyboard.press('Enter');
      await page.keyboard.type('Hello');
      await surface.evaluate((el) => {
        const last = el.children[1];
        last.append(document.createElement('br'));
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      });
      await expect.poll(() => surface.locator('.live-line').nth(1).locator('br').count()).toBe(0);
      await expect.poll(() => noteText(page)).toBe('the **Word**x was\nHello');
      await page.keyboard.press('Enter');
      await surface.evaluate((el) => {
        el.children[2].replaceChildren();
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      });
      await expect.poll(() => surface.locator('.live-line').nth(2).evaluate((el) => el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR')).toBe(true);

      // A paragraph becoming a heading.
      await page.keyboard.type('Intro');
      await stamp(page, 2);
      const at = (await noteText(page)).lastIndexOf('Intro');
      await surface.evaluate((el, at) => (el as HTMLTextAreaElement).setSelectionRange(at, at), at);
      await page.keyboard.type('## ');
      await expect(surface.locator('.live-line').nth(2)).toHaveClass(/live-line--h2/);
      await expect(surface.locator('.live-line').nth(2).locator('.md-mark')).toHaveText('## ');
      expect(await kept(page, 2)).toBe(false);

      // Text the browser inserted with a line break of its own, outside any
      // composition: the whole note is drawn again from what it left.
      await surface.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(0, 0));
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.insertText', { text: 'one\ntwo\n' });
      await expect.poll(() => noteText(page)).toBe('one\ntwo\nthe **Word**x was\nHello\n## Intro');
      expect(await surface.locator('.live-line').evaluateAll((els) => els.map((el) => el.className.includes('paragraph')).slice(0, 2))).toEqual([true, true]);
      expect(await surface.locator('.live-line br').count()).toBe(0);
    });
  });
});
