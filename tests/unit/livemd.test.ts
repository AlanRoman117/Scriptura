import { inlineSpans, lineKey, tokenizeNote, type LiveLine } from '../../apps/reader/src/lib/livemd';
import { parseMarkdown, type Block, type Inline } from '../../apps/reader/src/lib/markdown';

/** Notes covering every construct, in the languages the reader speaks. */
const CORPUS = [
  '',
  '\n\n',
  '# Title\n\nSome prose.\n\n---\n',
  '## The **covenant** with *Abraham*\n\n> In the beginning\n> was the Word\n\n- one\n- **two**\n* three\n\n1. first\n2) second',
  'A `code **not bold**` span and [[john 3:16@kjv]] and _under_ and ***both***.',
  '```js\nconst a = 1;\n**not bold**\n```\nafter',
  '```scriptura-board\n6f1c0a52-2d3b-4c8e-9a3f-1b2c3d4e5f60\n```\n',
  '```\nnever closed\n# not a heading',
  '  - indented bullet\n   > indented quote\n    10. indented number',
  '「神」は**愛**である。\n### 第一章\n- 項目',
  '上帝爱世人，**甚至**将他的独生子赐给他们。\n> 太初有道',
  'Citation : « Dieu est amour » ; vraiment ? **Oui** !',
  'Unclosed **bold and *italic\nnext line**',
  'trailing spaces   \n\t\ttabs\n',
  '***\n___\n- - -\n#no space\n####### seven',
];

const lineText = (line: LiveLine) => line.spans.map((s) => s.text).join('');

describe('the live tokenizer', () => {
  test.each(CORPUS.map((c) => [JSON.stringify(c).slice(0, 40), c]))(
    'is lossless: %s',
    (_name, source) => {
      const lines = tokenizeNote(source);
      expect(lines.map(lineText).join('\n')).toBe(source);
      expect(lines).toHaveLength(source.split('\n').length);
    }
  );

  test('classifies lines with the preview grammar', () => {
    const kinds = tokenizeNote('# A\n\ntext\n> q\n- b\n1. n\n---\n```\ncode\n```').map((l) => l.kind);
    expect(kinds).toEqual(['heading', 'blank', 'paragraph', 'quote', 'bullet', 'ordered', 'rule', 'fence', 'code', 'fence']);
  });

  test('marks syntax, and only syntax', () => {
    const [heading] = tokenizeNote('## The **word**');
    expect(heading.level).toBe(2);
    expect(heading.spans).toEqual([
      { text: '## ', marks: ['mark'] },
      { text: 'The ', marks: [] },
      { text: '**', marks: ['strong', 'mark'] },
      { text: 'word', marks: ['strong'] },
      { text: '**', marks: ['strong', 'mark'] },
    ]);
  });

  test("a list's number stays shown; a bullet's dash does not", () => {
    expect(tokenizeNote('1. one')[0].spans[0]).toEqual({ text: '1. ', marks: ['prefix'] });
    expect(tokenizeNote('- one')[0].spans[0]).toEqual({ text: '- ', marks: ['mark'] });
  });

  // `**` takes no `*` inside it, in the preview's grammar too, so nested
  // emphasis is written with underscores.
  test('nests emphasis inside strong, and keeps code literal', () => {
    expect(inlineSpans('**a _b_ c**').map((s) => [s.text, s.marks.join('+')])).toEqual([
      ['**', 'strong+mark'],
      ['a ', 'strong'],
      ['_', 'strong+em+mark'],
      ['b', 'strong+em'],
      ['_', 'strong+em+mark'],
      [' c', 'strong'],
      ['**', 'strong+mark'],
    ]);
    expect(inlineSpans('`**x**`').map((s) => s.text)).toEqual(['`', '**x**', '`']);
  });

  test('a fence carries its opening line and language to every line in it', () => {
    const lines = tokenizeNote('text\n```scriptura-board\nid\n```\nafter');
    expect(lines.map((l) => l.kind)).toEqual(['paragraph', 'fence', 'board', 'fence', 'paragraph']);
    expect(lines[2].fence).toEqual({ start: 1, lang: 'scriptura-board' });
    expect(lines[3].fence).toEqual({ start: 1, lang: 'scriptura-board' });
    expect(lines[4].fence).toBeUndefined();
  });

  test('an unclosed fence runs to the end, as in the preview', () => {
    expect(tokenizeNote('```\n# x\n- y').map((l) => l.kind)).toEqual(['fence', 'code', 'code']);
  });

  test('emphasis does not cross a line break', () => {
    const lines = tokenizeNote('**open\nclosed**');
    expect(lines.flatMap((l) => l.spans).every((s) => s.marks.length === 0)).toBe(true);
  });

  test('a line key changes exactly when the drawing would', () => {
    const [a] = tokenizeNote('**x**');
    const [b] = tokenizeNote('**x**');
    const [c] = tokenizeNote('**y**');
    expect(lineKey(a)).toBe(lineKey(b));
    expect(lineKey(a)).not.toBe(lineKey(c));
  });
});

/*
 * The live editor and the preview must agree about what a note says. Strip
 * the syntax from the live lines, flatten the preview's tree, and compare the
 * text that is left. Line breaks are dropped from both: the preview joins a
 * paragraph's lines, and the live editor keeps each on its own.
 */
describe('agreement with the preview', () => {
  const flattenInline = (nodes: Inline[]): string =>
    nodes
      .map((n) =>
        n.type === 'text' || n.type === 'code'
          ? n.value
          : n.type === 'wikilink'
            ? n.target
            : flattenInline(n.children)
      )
      .join('');
  const flattenBlock = (b: Block): string => {
    switch (b.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        return flattenInline(b.children);
      case 'list':
        return b.items.map(flattenInline).join('');
      case 'code':
        return b.value;
      default:
        return '';
    }
  };
  const preview = (source: string) =>
    parseMarkdown(source).map(flattenBlock).join('').replace(/\n/g, '');
  const live = (source: string) =>
    tokenizeNote(source)
      .filter((l) => l.kind !== 'board' && l.kind !== 'blank')
      .flatMap((l) => l.spans)
      .filter((s) => !s.marks.includes('mark') && !s.marks.includes('prefix'))
      .map((s) => s.text)
      .join('')
      .replace(/\n/g, '');

  // The one construct they read differently, documented in livemd.ts.
  const crossesLines = (source: string) => source.includes('Unclosed **bold');

  test.each(CORPUS.filter((c) => !crossesLines(c)).map((c) => [JSON.stringify(c).slice(0, 40), c]))(
    'same text: %s',
    (_name, source) => {
      expect(live(source)).toBe(preview(source));
    }
  );
});
