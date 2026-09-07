import {
  boardEmbed,
  inlineBoardEmbeds,
  parseInline,
  parseMarkdown,
} from '../../apps/reader/src/lib/markdown';
import {
  insertAt,
  toggleHeading,
  toggleLineStyle,
  toggleWrap,
} from '../../apps/reader/src/lib/mdedit';

describe('parsing a note', () => {
  test('headings, paragraphs and rules', () => {
    const blocks = parseMarkdown('# Title\n\nSome prose.\n\n---\n');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'rule']);
    expect(blocks[0]).toMatchObject({ level: 1 });
  });

  test('a block knows where it started, so a click can put the caret back', () => {
    const source = '# Title\n\nSome prose.';
    const blocks = parseMarkdown(source);
    expect(source.slice(blocks[0].offset, blocks[0].offset + 7)).toBe('# Title');
    expect(source.slice(blocks[1].offset)).toBe('Some prose.');
  });

  test('lists group their items, ordered or not', () => {
    const blocks = parseMarkdown('- one\n- two\n\n1. first\n2. second');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: true });
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  test('a quote keeps its lines together', () => {
    const blocks = parseMarkdown('> In the beginning\n> was the Word');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quote');
  });

  test('an embedded board is its own block, not a code listing', () => {
    const blocks = parseMarkdown(`before\n\n${boardEmbed('abc-123')}\n\nafter`);
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'board', 'paragraph']);
    expect(blocks[1]).toMatchObject({ id: 'abc-123' });
  });

  test('an ordinary fence is still a code block', () => {
    const blocks = parseMarkdown('```js\nconst a = 1;\n```');
    expect(blocks[0]).toMatchObject({ type: 'code', lang: 'js', value: 'const a = 1;' });
  });
});

describe('inline spans', () => {
  test('bold, italic, code and links', () => {
    expect(parseInline('a **b** c *d* e `f` [[john 3:16]]')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'strong', children: [{ type: 'text', value: 'b' }] },
      { type: 'text', value: ' c ' },
      { type: 'em', children: [{ type: 'text', value: 'd' }] },
      { type: 'text', value: ' e ' },
      { type: 'code', value: 'f' },
      { type: 'text', value: ' ' },
      { type: 'wikilink', target: 'john 3:16' },
    ]);
  });

  test('code wins over emphasis, so markers inside it stay literal', () => {
    expect(parseInline('`a **b** c`')).toEqual([{ type: 'code', value: 'a **b** c' }]);
  });

  test('an unmatched marker is just text', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ type: 'text', value: '2 * 3 = 6' }]);
  });
});

describe('formatting operations', () => {
  test('a heading toggles off when applied twice', () => {
    const once = toggleHeading('Title', 0, 5, 2);
    expect(once.text).toBe('## Title');
    expect(toggleHeading(once.text, 0, once.text.length, 2).text).toBe('Title');
  });

  test('changing level replaces the marker rather than stacking it', () => {
    expect(toggleHeading('## Title', 0, 8, 3).text).toBe('### Title');
  });

  test('bold wraps a selection and unwraps it again', () => {
    const on = toggleWrap('the Word', 4, 8, '**');
    expect(on.text).toBe('the **Word**');
    // Double-clicking a bold word selects the word, not its markers.
    expect(toggleWrap(on.text, 6, 10, '**').text).toBe('the Word');
  });

  test('italic inside bold adds a layer rather than removing the bold', () => {
    // A single `*` on each side of the selection is also what `**` looks like
    // from the inside, and unwrapping there would have the I button delete the
    // reader's bold.
    const bold = toggleWrap('the Word', 4, 8, '**');
    const both = toggleWrap(bold.text, bold.selectionStart, bold.selectionEnd, '*');
    expect(both.text).toBe('the ***Word***');
    // And a genuinely italic word still un-italicises.
    expect(toggleWrap('the *Word*', 5, 9, '*').text).toBe('the Word');
  });

  test('wrapping leaves the words selected, not the markers', () => {
    // Selecting the markers too means the next keystroke deletes what was just
    // formatted, and a second style can never be applied on top.
    const on = toggleWrap('the Word', 4, 8, '**');
    expect(on.text.slice(on.selectionStart, on.selectionEnd)).toBe('Word');

    const both = toggleWrap(on.text, on.selectionStart, on.selectionEnd, '*');
    expect(both.text).toBe('the ***Word***');
  });

  test('bold with nothing selected leaves the caret ready to type', () => {
    const edit = toggleWrap('a ', 2, 2, '**');
    expect(edit.text).toBe('a ****');
    expect(edit.selectionStart).toBe(4);
    expect(edit.selectionEnd).toBe(4);
  });

  test('a list numbers every selected line, and clears them all', () => {
    const on = toggleLineStyle('one\ntwo\nthree', 0, 13, 'number');
    expect(on.text).toBe('1. one\n2. two\n3. three');
    expect(toggleLineStyle(on.text, 0, on.text.length, 'number').text).toBe('one\ntwo\nthree');
  });

  test('switching list style does not stack prefixes', () => {
    const bullets = toggleLineStyle('one\ntwo', 0, 7, 'bullet');
    expect(toggleLineStyle(bullets.text, 0, bullets.text.length, 'number').text).toBe(
      '1. one\n2. two'
    );
  });

  test('an operation on a partial selection still takes whole lines', () => {
    // The caret sits inside "two"; the bullet belongs to the line, not the word.
    const edit = toggleLineStyle('one\ntwo', 5, 5, 'bullet');
    expect(edit.text).toBe('one\n- two');
  });

  test('insert replaces the selection and leaves the caret after it', () => {
    const edit = insertAt('a  b', 2, 2, 'X');
    expect(edit.text).toBe('a X b');
    expect(edit.selectionStart).toBe(3);
  });
});

describe('board embeds on export', () => {
  test('are replaced with something readable outside the app', () => {
    const body = `Notes\n\n${boardEmbed('b1')}\n\nmore`;
    const out = inlineBoardEmbeds(body, (id) => `## Board ${id}\n\n- John 1:1`);
    expect(out).toContain('## Board b1');
    expect(out).not.toContain('scriptura-board');
  });

  test('an embed whose board is gone is left alone rather than blanked', () => {
    const body = boardEmbed('missing');
    expect(inlineBoardEmbeds(body, () => null)).toBe(body);
  });
});
