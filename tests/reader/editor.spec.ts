import { expect, test } from '@playwright/test';

/**
 * The writing surface: tools for people who do not write Markdown, and a way
 * to see what the syntax actually did.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('chapter')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('note-new').click();
}

/** Select the whole body, the way a reader would before formatting it. */
async function selectAll(page: import('@playwright/test').Page) {
  await page.getByTestId('notes-surface').click();
  await page.keyboard.press('ControlOrMeta+a');
}

test.describe('formatting tools', () => {
  test('appear with focus and withdraw when it leaves', async ({ page }) => {
    await open(page);
    // Collapsed by default is the point — but absent is not the same thing.
    await expect(page.getByTestId('editor-tools')).toHaveCount(0);

    await page.getByTestId('notes-surface').click();
    await expect(page.getByTestId('editor-tools')).toBeVisible();

    await page.getByTestId('note-title').click();
    await expect(page.getByTestId('editor-tools')).toHaveCount(0);
  });

  test('a heading applies and toggles back off', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').fill('The prologue');
    await selectAll(page);
    await page.getByTestId('tool-h2').click();
    await expect(page.getByTestId('notes-surface')).toHaveValue('## The prologue');

    // A tool that can only add syntax strands the reader it exists for.
    await selectAll(page);
    await page.getByTestId('tool-h2').click();
    await expect(page.getByTestId('notes-surface')).toHaveValue('The prologue');
  });

  test('bold wraps the selection and leaves the caret usable', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').fill('the Word');
    const surface = page.getByTestId('notes-surface');
    await surface.click();
    await surface.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 8));
    await page.getByTestId('tool-bold').click();
    await expect(surface).toHaveValue('the **Word**');

    // The word stays selected, not its markers — so focus came back to the
    // textarea and a second style can go on top of the first.
    const picked = await surface.evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd)
    );
    expect(picked).toBe('Word');

    await page.getByTestId('tool-italic').click();
    await expect(surface).toHaveValue('the ***Word***');
  });

  test('a list numbers every selected line', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').fill('one\ntwo\nthree');
    await selectAll(page);
    await page.getByTestId('tool-number').click();
    await expect(page.getByTestId('notes-surface')).toHaveValue('1. one\n2. two\n3. three');
  });
});

test.describe('reading it back', () => {
  test('renders the syntax, and a click returns to the right place', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').fill(
      '# Opening\n\nThe **Word** was with God.\n\n- first\n- second\n\n> a quotation'
    );
    await page.getByTestId('note-preview').click();

    const preview = page.getByTestId('notes-preview');
    // A note's `#` is its own top level, not the page's: the chapter title is
    // the h1 and the notes pane is an h2, so note headings start at h3.
    await expect(preview.locator('h3')).toHaveText('Opening');
    await expect(preview.locator('h1')).toHaveCount(0);
    await expect(preview.locator('strong')).toHaveText('Word');
    await expect(preview.locator('ul li')).toHaveCount(2);
    await expect(preview.locator('blockquote')).toContainText('a quotation');

    // Clicking a block goes back to writing with the caret in that block —
    // reading and fixing as one gesture rather than a mode to leave first.
    await preview.locator('blockquote').click();
    const surface = page.getByTestId('notes-surface');
    await expect(surface).toBeVisible();
    const at = await surface.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    const body = await surface.inputValue();
    expect(body.slice(at)).toBe('> a quotation');
  });

  test('the cursor affordances stay in the editor', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').fill('# Opening\n\nsee [[psalms 23:1]]');
    await expect(page.getByTestId('notes-heading')).toBeVisible();

    // Both describe where the caret is; in a rendered view the sticky heading
    // would sit directly above the same heading, rendered.
    await page.getByTestId('note-preview').click();
    await expect(page.getByTestId('notes-heading')).toHaveCount(0);
    await expect(page.getByTestId('notes-follow-link')).toHaveCount(0);
  });

  test('a link in the preview opens its passage', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').fill('see [[psalms 23:1]]');
    await page.getByTestId('note-preview').click();
    await page.getByTestId('preview-link-psalms-23-1').click();
    await expect(page.getByTestId('chapter-title')).toContainText('Psalms 23');
  });

  test('markup in a note is rendered as text, never as markup', async ({ page }) => {
    // A note is arbitrary text and may have been drafted by an assistant.
    await open(page);
    await page.getByTestId('notes-surface').fill('<img src=x onerror="window.__pwned=1">');
    await page.getByTestId('note-preview').click();
    await expect(page.getByTestId('notes-preview')).toContainText('<img src=x');
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(page.getByTestId('notes-preview').locator('img')).toHaveCount(0);
  });
});

test.describe('a board inside a note', () => {
  test('embeds as a diagram, and opens from there', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-title').fill('Prologue study');

    await page.getByTestId('verse-1').click();
    await page.getByTestId('canvas-1').click();
    await page.getByTestId('verse-3').click();
    await page.getByTestId('canvas-3').click();

    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-to-note').click();
    // The board closed behind the button, so the note says what arrived.
    await expect(page.getByTestId('note-done')).toHaveText('✓ Added the board “Study board”');
    await expect(page.getByTestId('announcer')).toHaveText('Added the board “Study board” in “Prologue study”');

    // Back in the note, the fence is plain text…
    await expect(page.getByTestId('notes-surface')).toContainText('scriptura-board');
    // …and renders as the board, the way a mermaid fence would.
    await page.getByTestId('note-preview').click();
    const embed = page.getByTestId('notes-preview').locator('.embed');
    await expect(embed).toBeVisible();
    // `.embed__card` rather than `rect`: each card also carries a rect inside
    // its clipPath, which is geometry, not a drawn box.
    await expect(embed.locator('.embed__card')).toHaveCount(2);
    await expect(embed.locator('text').first()).toContainText('John 1:1');

    await embed.locator('.embed__open').click();
    await expect(page.getByTestId('canvas')).toBeVisible();
  });

  test('a card title never spills out of the box it is drawn in', async ({ page }) => {
    // The shape a wide board takes — a genealogy from Adam to Jesus, say. The
    // card shrinks with the board and the label does not, so a fixed character
    // limit spills out of the box at any real scale.
    await open(page);
    for (let v = 1; v <= 10; v++) {
      await page.getByTestId(`verse-${v}`).click();
      await page.getByTestId(`canvas-${v}`).click();
    }
    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-add-text').click();
    const cards = await page.locator('.card').evaluateAll((all) =>
      all.map((c) => (c as HTMLElement).dataset.testid!.replace('card-', ''))
    );
    // Wide glyphs as well as a long title: a proportional estimate passes on
    // narrow letters and spills on these.
    await page
      .getByTestId(`card-title-${cards[cards.length - 1]}`)
      .fill('WWWWW From Adam through Abraham to David MMMMM');

    await page.getByTestId('board-to-note').click();
    await page.getByTestId('note-preview').click();

    const embed = page.getByTestId('notes-preview').locator('.embed');
    await expect(embed).toBeVisible();

    // Measured with getComputedTextLength — the advance width of the glyphs
    // actually drawn. A bounding box would not do: clipping is a paint
    // operation, so the box still reports the full untruncated width and the
    // test would pass on the clip alone while the label was really cut off.
    const overflow = await embed.evaluate((figure) => {
      const groups = [...figure.querySelectorAll('g')].filter((g) => g.querySelector('text'));
      return groups.map((g) => {
        const box = g.querySelector('.embed__card') as SVGRectElement;
        const text = g.querySelector('text') as SVGTextElement;
        // 12 = the x offset on each side, matching LABEL_PAD in the component.
        return Math.round(text.getComputedTextLength() + 12 - box.width.baseVal.value);
      });
    });
    expect(overflow).toHaveLength(11);
    for (const over of overflow) expect(over).toBeLessThanOrEqual(0);
  });

  test('an embed whose board is deleted says so rather than vanishing', async ({ page }) => {
    await open(page);
    await page.getByTestId('verse-1').click();
    await page.getByTestId('canvas-1').click();
    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-to-note').click();

    await page.getByTestId('canvas-open').click();
    await page.getByTestId('board-delete').click();
    await page.getByTestId('board-delete').click();
    await page.getByTestId('canvas-close').click();

    await page.getByTestId('note-preview').click();
    await expect(page.getByTestId('board-embed-missing')).toBeVisible();
  });
});

test.describe('the preview from the keyboard', () => {
  test('each block has an Edit control that puts the caret there', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').fill('# Opening\n\nThe **Word** was with God.\n\n> a quotation');
    await page.getByTestId('note-preview').click();

    // Third block is the quotation; the control is reachable and visible once focused.
    const edit = page.getByTestId('preview-edit-2');
    await edit.focus();
    await expect(edit).toBeVisible();
    await page.keyboard.press('Enter');

    const surface = page.getByTestId('notes-surface');
    await expect(surface).toBeVisible();
    const at = await surface.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    expect((await surface.inputValue()).slice(at)).toBe('> a quotation');
  });

  test('an empty preview is a button back to writing', async ({ page }) => {
    await open(page);
    await page.getByTestId('note-preview').click();
    const empty = page.getByTestId('notes-preview');
    await expect(empty).toHaveRole('button');
    await empty.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('notes-surface')).toBeVisible();
  });
});

test.describe('the formatting tools from the keyboard (2.1.1, 4.1.2)', () => {
  test('Shift+Tab from the note reaches the toolbar; arrows move; a tool formats and returns', async ({ page }) => {
    await open(page);
    const surface = page.getByTestId('notes-surface');
    await surface.fill('the Word');
    await surface.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 8));

    await page.keyboard.press('Shift+Tab');
    const tools = page.getByTestId('editor-tools');
    await expect(tools).toBeVisible();
    await expect(page.getByTestId('tool-h1')).toBeFocused();

    // One Tab stop: the other tools are out of the Tab order.
    await expect(page.getByTestId('tool-bold')).toHaveAttribute('tabindex', '-1');

    // H1 → H2 → H3 → Bold (the separators are not stops).
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('tool-bold')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(surface).toHaveValue('the **Word**');
    await expect(surface).toBeFocused();
    const picked = await surface.evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd)
    );
    expect(picked).toBe('Word');
  });

  test('the tools stay while focus moves between them and the note, and go when it leaves', async ({ page }) => {
    await open(page);
    await page.getByTestId('notes-surface').click();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('editor-tools')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('notes-surface')).toBeFocused();
    await expect(page.getByTestId('editor-tools')).toBeVisible();

    await page.getByTestId('note-title').focus();
    await expect(page.getByTestId('editor-tools')).toHaveCount(0);
  });
});
