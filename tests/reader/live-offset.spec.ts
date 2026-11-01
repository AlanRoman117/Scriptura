import { expect, test, type Page } from '@playwright/test';

/**
 * `offsetOf` must answer as if it still read a copy of everything before the
 * point, at every point of every shape, in a real browser.
 *
 * It used to be `readText(range.cloneContents()).length`, which cost 4,100
 * dead nodes per key on a 50,000 character note, and it is now a walk that
 * keeps `readText`'s rules a second time. So the old logic lives on here, and
 * it calls the app's own `readText`: a rule changed in `readText` alone, or in
 * the walk alone, moves one side of the comparison and fails these tests.
 * That only works for a shape that holds the rule, which is why the shapes
 * below go well past what the editor draws, every tag a browser or a paste
 * might leave among them. Add to them when `readText` learns anything new.
 *
 * Against the dev server, the one place a module can be imported by its source
 * path, and on an empty page there: the question is about one function, not
 * about the app. Typing through the built app is held in `live.spec.ts`.
 */
test.use({ baseURL: `http://127.0.0.1:${process.env.SCRIPTURA_READER_DEV_PORT ?? 5174}` });

/** A DOM shape, as data, so it can cross into the page. A string is a text node. */
type Shape =
  | string
  | { tag: string; attrs?: Record<string, string>; kids?: Shape[] }
  | { comment: string }
  | { pi: string };

const el = (tag: string, ...kids: Shape[]): Shape => ({ tag, kids });
const widget = (...kids: Shape[]): Shape => ({ tag: 'span', attrs: { 'data-widget': '', contenteditable: 'false' }, kids });
const mark = (...kids: Shape[]): Shape => ({ tag: 'span', attrs: { class: 'md-mark' }, kids });
const br: Shape = { tag: 'br' };
const line = (...kids: Shape[]): Shape => el('div', ...kids);
const emptyLine = line(br);
const comment = (text: string): Shape => ({ comment: text });
const pi = (text: string): Shape => ({ pi: text });

/** Each case the old code's comments name, and its neighbours. */
const SHAPES: Record<string, Shape[]> = {
  'nothing at all': [],
  'one empty line': [emptyLine],
  'only empty lines': [emptyLine, emptyLine, emptyLine],
  'plain lines, for points between them and at their starts': [line('one'), line('two'), line('three')],
  'empty lines first, last and between': [emptyLine, line('a'), emptyLine, emptyLine, line('b'), emptyLine],
  'a line left with no <br>': [line('a'), line(), line('b'), line()],
  'marker spans': [
    line(mark('## '), 'Heading'),
    line('plain ', mark('**'), el('span', 'bold'), mark('**'), ' tail'),
    line(mark('- '), el('span', mark('*'), el('span', 'nested'), mark('*'))),
    line(el('span'), 'after an empty span', el('span', '')),
  ],
  'a stray <div> the browser made': [
    line('one', el('div', 'browser made'), 'two'),
    line('three'),
    el('div', el('div', el('div', 'deep')), el('div')),
    el('div', el('div')),
    line(br, el('div')),
  ],
  'loose in the root': ['loose text', el('span', 'span'), 'more', line('a line'), 'after a line', emptyLine, ''],
  'an empty text node': ['', line('', 'a', '', '', 'b', ''), line(''), '', line('c')],
  '\\n in a text node': [line('x\ny'), line('\n'), line('\n\n'), '\n', line('z\n')],
  'a <br> mid-line and last': [line('a', br, 'b', br), line('c'), line(br, br), line(br, br, br, 'd')],
  'a <br> with something after it that reads as nothing': [
    line('a', br, ''),
    line('b', br, comment('c')),
    line('d', br, widget('w')),
    line('e', br, el('span')),
    line(br, ''),
  ],
  'a <br> in an inline': [line(el('span', 'a', br)), line(el('span', br)), line(el('span', br), 'b'), line(el('b', el('i', br)))],
  'a <br> in the root': [br],
  'a <br> last in the root': [line('a'), br],
  'a <br> first and between in the root': [br, line('a'), br, br, line('b')],
  'a <br> and loose text in the root': ['a', br, 'b', br],
  'a <br> holding nodes, which only a script could do': [
    line('a', { tag: 'br', kids: ['inside', el('span', 'deeper')] }, 'b'),
    line({ tag: 'br', kids: ['last'] }),
    { tag: 'br', kids: ['in the root'] },
  ],
  'comments': [
    comment('first'),
    line('a', comment('mid'), 'b'),
    comment('between lines'),
    line(comment('only')),
    line(br, comment('after a br')),
    line(comment('before a br'), br),
    comment('last'),
  ],
  'processing instructions': [pi('first'), line('a', pi('mid'), 'b'), pi('between'), line(br, pi('after'))],
  'a drawn board host': [
    line(mark('```scriptura-board'), widget(el('svg', el('text', 'ignored')), 'WIDGET')),
    line('6f1c0a52'),
    line(mark('```')),
  ],
  'a widget everywhere it might be': [
    widget('in the root'),
    line(widget('alone')),
    line(widget('first'), 'a'),
    line('b', widget('middle'), 'c'),
    line(el('span', 'd', widget('in a span'), 'e')),
    line(widget(line('a line inside'), br, comment('c'), widget('nested'), 'tail')),
    { tag: 'div', attrs: { 'data-widget': '' }, kids: ['a block that is a widget', br] },
    line('f', { tag: 'br', attrs: { 'data-widget': '' } }),
  ],
  'every block readText knows': ['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].flatMap((tag) => [
    el(tag, 'text ' + tag, br),
    el(tag, br),
    el(tag),
    line('x', el(tag, 'y'), 'z'),
  ]),
  'lists and quotes, as a paste might leave them': [
    el('ul', el('li', 'one', el('ul', el('li', 'nested'))), el('li', br), el('li')),
    el('blockquote', el('p', 'quoted'), el('p', br)),
    el('pre', 'a\nb\n'),
  ],
  'tags readText does not know': [
    'SECTION', 'ARTICLE', 'TABLE', 'TBODY', 'TR', 'TD', 'HR', 'IMG', 'A', 'B', 'I', 'EM', 'STRONG', 'FONT', 'CODE',
    'RUBY', 'RT', 'WBR', 'BUTTON', 'INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE', 'TEMPLATE', 'DETAILS', 'SUMMARY', 'CENTER', 'ADDRESS', 'FIGURE',
  ].flatMap((tag) => [el(tag, 'a', br, el('div', 'b'), 'c'), line('d', el(tag), 'e', br), el(tag, br)]),
  'the languages notes are written in, in every run': [
    line(mark('# '), 'בְּרֵאשִׁית בָּרָא אֱלֹהִים'),
    line('فِي ٱلْبَدْءِ', mark('**'), el('span', 'كَانَ ٱلْكَلِمَةُ'), mark('**')),
    line('😀👨‍👩‍👧‍👦🇲🇽', br, '𝔘𝔫𝔦𝔠𝔬𝔡𝔢'),
    line('「神」は', el('span', '愛'), 'である。𠮷野家'),
    line('Dios és amór', widget('👍🏽'), 'é'),
    line('नमस्ते ไทย한글 Việt'),
    emptyLine,
    // A surrogate pair the browser split across two text nodes.
    line('\ud83d', '\ude00'),
    '\ud83d',
    line('\ude00'),
  ],
};

/** Notes as the editor draws them, in the languages it is written in. */
const NOTES = [
  '',
  '\n\n',
  '# Title\n\nSome prose.\n\n---\n',
  '## The **covenant** with *Abraham*\n\n> In the beginning\n> was the Word\n\n- one\n- **two**\n* three\n\n1. first\n2) second',
  'A `code **not bold**` span and [[john 3:16@kjv]] and _under_ and ***both***.',
  '```js\nconst a = 1;\n**not bold**\n```\nafter',
  'before\n```scriptura-board\n6f1c0a52-2d3b-4c8e-9a3f-1b2c3d4e5f60\n```\nafter\n',
  '```\nnever closed\n# not a heading',
  '# בְּרֵאשִׁית **בָּרָא** אֱלֹהִים\n\n> فِي ٱلْبَدْءِ كَانَ ٱلْكَلِمَةُ\n- 😀 **👨‍👩‍👧‍👦** *🇲🇽*\n\n「神」は**愛**である。𠮷\n### 第一章\n上帝爱世人，**甚至**\n1. é **ó** `ñ`\n𝔘𝔫𝔦 [[juan 3:16@vbl]] 👍🏽',
];

declare global {
  interface Window {
    /** Imported in the page; see `load`. */
    __dom: typeof import('../../apps/reader/src/lib/livedom');
    __md: typeof import('../../apps/reader/src/lib/livemd');
    /** Every point in `root`, the walk against the old logic. */
    __compare: (root: HTMLElement) => { points: number; mismatches: string[] };
    /** The old `offsetOf`, whole. */
    __old: (root: HTMLElement, node: Node, offset: number) => number;
  }
}

async function load(page: Page) {
  await page.route('**/blank', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>t</title><body></body>' }));
  await page.goto('/blank');
  // As a string: this file is compiled, and an `import()` inside a function
  // handed to the page could be rewritten for Node on the way.
  await page.evaluate(`Promise.all([import('/src/lib/livedom.ts'), import('/src/lib/livemd.ts')]).then(([dom, md]) => { window.__dom = dom; window.__md = md; })`);
  await page.evaluate(() => {
    // ⚠️ Word for word what `offsetOf` was, with the app's own `readText`.
    const old = (root: HTMLElement, node: Node, offset: number): number => {
      if (node === root) {
        const lines = root.children;
        if (offset < lines.length) return old(root, lines[offset], 0);
        if (lines.length === 0) return 0;
        const last = lines[lines.length - 1];
        return old(root, last, last.childNodes.length);
      }
      const range = document.createRange();
      range.setStart(root, 0);
      range.setEnd(node, offset);
      return window.__dom.readText(range.cloneContents()).length;
    };
    window.__old = old;

    const describe = (node: Node, offset: number) => {
      const path: string[] = [];
      for (let n: Node | null = node; n && n.parentNode; n = n.parentNode) {
        path.unshift(`${n.nodeName}[${Array.from(n.parentNode.childNodes).indexOf(n as ChildNode)}]`);
      }
      return `${path.join('/') || 'root'}@${offset}`;
    };
    window.__compare = (root) => {
      let points = 0;
      const mismatches: string[] = [];
      const visit = (node: Node) => {
        const isData = node instanceof CharacterData;
        const end = isData ? node.data.length : node.childNodes.length;
        for (let at = 0; at <= end; at += 1) {
          points += 1;
          const was = old(root, node, at);
          const is = window.__dom.offsetOf(root, node, at);
          if (was !== is) mismatches.push(`${describe(node, at)}: was ${was}, is ${is}`);
        }
        if (!isData) node.childNodes.forEach(visit);
      };
      visit(root);
      return { points, mismatches: mismatches.slice(0, 20) };
    };
  });
}

/** Builds shapes in the page and compares every point of each. */
const compareShapes = (page: Page, shapes: Record<string, Shape[]>) =>
  page.evaluate((shapes) => {
    const build = (shape: Shape): Node => {
      if (typeof shape === 'string') return document.createTextNode(shape);
      if ('comment' in shape) return document.createComment(shape.comment);
      if ('pi' in shape) return document.createProcessingInstruction('note', shape.pi);
      const node = document.createElement(shape.tag);
      for (const [name, value] of Object.entries(shape.attrs ?? {})) node.setAttribute(name, value);
      // appendChild, not innerHTML: a <br> holding nodes, and text split where
      // it was asked to be, cannot be written as HTML.
      for (const kid of shape.kids ?? []) node.appendChild(build(kid));
      return node;
    };
    return Object.entries(shapes).map(([name, kids]) => {
      const root = document.createElement('div');
      for (const kid of kids) root.appendChild(build(kid));
      document.body.append(root);
      const result = window.__compare(root);
      root.remove();
      return { name, ...result };
    });
  }, shapes);

test.describe('offsetOf answers as the old clone did', () => {
  test.beforeEach(async ({ page }) => {
    await load(page);
  });

  for (const name of Object.keys(SHAPES)) {
    test(`at every point of: ${name}`, async ({ page }) => {
      const [result] = await compareShapes(page, { [name]: SHAPES[name] });
      expect(result.mismatches).toEqual([]);
      // Nothing compared would pass too. A root alone has one point.
      expect(result.points).toBeGreaterThan(name === 'nothing at all' ? 0 : 1);
    });
  }

  test('at every point of a thousand shapes from a seeded generator', async ({ page }) => {
    // Seeded, so a failure is the same failure on the next run; a line says
    // which shape. Shapes no one thought to write are the point of this one.
    let state = 0x5c217;
    const random = (below: number) => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) % below);
    };
    const pick = <T,>(from: readonly T[]) => from[random(from.length)];
    const TEXTS = ['', 'a', 'xyz', '\n', 'a\nb', ' ', 'é', 'é', '😀', '👨‍👩‍👧', 'בְּ', 'كَ', '愛', '𠮷', '\ud83d', '\ude00'];
    const TAGS = ['DIV', 'DIV', 'DIV', 'SPAN', 'SPAN', 'B', 'A', 'P', 'LI', 'UL', 'BLOCKQUOTE', 'PRE', 'H1', 'SECTION', 'TD', 'FONT'];
    const generate = (depth: number): Shape => {
      const roll = random(20);
      if (roll < 7 || depth === 0) return pick(TEXTS);
      if (roll < 11) return br;
      if (roll < 12) return comment(pick(TEXTS));
      if (roll < 13) return pi('x');
      const kids = Array.from({ length: random(5) }, () => generate(depth - 1));
      if (roll < 14) return widget(...kids);
      if (roll < 15) return { tag: 'br', kids };
      return { tag: pick(TAGS).toLowerCase(), kids };
    };
    const shapes: Record<string, Shape[]> = {};
    for (let i = 0; i < 1000; i += 1) shapes[`seeded ${i}`] = Array.from({ length: random(5) }, () => generate(4));

    const results = await compareShapes(page, shapes);
    expect(results.flatMap((r) => r.mismatches.map((m) => `${r.name} ${m}`))).toEqual([]);
    // That the generator is not producing empty roots.
    expect(results.reduce((sum, r) => sum + r.points, 0)).toBeGreaterThan(10_000);
  });

  test('at every point of a note as it is drawn, and each point is the right character', async ({ page }) => {
    const results = await page.evaluate((notes) => {
      const { buildLine, lineStarts, offsetOf, readText } = window.__dom;
      return notes.map((note) => {
        const tokens = window.__md.tokenizeNote(note);
        const root = document.createElement('div');
        tokens.forEach((token, i) => {
          const isBoard = token.kind === 'fence' && token.fence?.lang === 'scriptura-board' && token.fence?.start === i;
          root.append(buildLine(token, { widget: isBoard }));
        });
        document.body.append(root);
        const problems: string[] = [];
        if (readText(root) !== note) problems.push('the page does not read as the note');

        // Held against the note itself, not only against the old code.
        const starts = lineStarts(note);
        Array.from(root.children).forEach((child, i) => {
          if (offsetOf(root, child, 0) !== starts[i]) problems.push(`line ${i} starts at ${offsetOf(root, child, 0)}, not ${starts[i]}`);
          if (offsetOf(root, root, i) !== starts[i]) problems.push(`between lines before ${i}`);
        });
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
          for (let at = 0; at <= n.data.length; at += 1) {
            if (!note.startsWith(n.data.slice(at), offsetOf(root, n, at))) problems.push(`${JSON.stringify(n.data)}@${at}`);
          }
        }
        const compared = window.__compare(root);
        root.remove();
        return { note, problems: [...problems, ...compared.mismatches], points: compared.points };
      });
    }, NOTES);
    for (const { note, problems, points } of results) {
      expect(problems, note).toEqual([]);
      expect(points).toBeGreaterThan(0);
    }
  });

  test('at every point of whatever the browser leaves after real edits', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = document.createElement('div');
      root.contentEditable = 'true';
      document.body.append(root);
      for (const token of window.__md.tokenizeNote('# בְּרֵאשִׁית\n\nplain **bold** tail\n- 😀 item\n\n「神」は*愛*')) {
        root.append(window.__dom.buildLine(token));
      }
      root.focus();

      let state = 0xbeef;
      const random = (below: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state >>> 8) % below;
      };
      const EDITS: [string, string?][] = [
        ['insertText', 'x'],
        ['insertText', '😀'],
        ['insertText', 'é'],
        ['insertText', '\n'],
        ['insertParagraph'],
        ['insertLineBreak'],
        ['delete'],
        ['forwardDelete'],
        ['bold'],
        ['insertHTML', '<div>pasted</div><p>two<br></p>'],
        ['insertHTML', '<!-- c --><ul><li>item</li></ul>'],
        ['insertOrderedList'],
        ['formatBlock', 'blockquote'],
      ];
      const nodes = () => {
        const all: Node[] = [root];
        const walker = document.createTreeWalker(root);
        while (walker.nextNode()) all.push(walker.currentNode);
        return all;
      };
      let points = 0;
      const mismatches: string[] = [];
      const shapes = new Set<string>();
      for (let i = 0; i < 120; i += 1) {
        const candidates = nodes();
        const node = candidates[random(candidates.length)];
        const length = node instanceof CharacterData ? node.data.length : node.childNodes.length;
        document.getSelection()!.collapse(node, random(length + 1));
        const [command, value] = EDITS[random(EDITS.length)];
        document.execCommand(command, false, value);
        shapes.add(root.innerHTML);
        const compared = window.__compare(root);
        points += compared.points;
        for (const m of compared.mismatches) mismatches.push(`after ${command} #${i}: ${m}`);
      }
      return { points, mismatches: mismatches.slice(0, 20), shapes: shapes.size, html: root.innerHTML };
    });
    expect(result.mismatches, result.html).toEqual([]);
    // The edits did edit: each should have left a page unlike the last.
    expect(result.shapes).toBeGreaterThan(40);
    expect(result.points).toBeGreaterThan(1000);
  });

  test('readSelection reads both ends through it', async ({ page }) => {
    const answer = await page.evaluate(() => {
      const root = document.createElement('div');
      root.innerHTML = '<div>one</div><div><br></div><div>tw<span>o</span></div>';
      document.body.append(root);
      const range = document.createRange();
      const span = root.querySelector('span')!;
      range.setStart(root.firstChild!.firstChild!, 1);
      range.setEnd(span.firstChild!, 1);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      return window.__dom.readSelection(root);
    });
    // "one\n\ntwo": from after the "o" to after the last letter.
    expect(answer).toEqual({ start: 1, end: 8 });
  });

  test('a point not in the note', async ({ page }) => {
    const answers = await page.evaluate(() => {
      const before = document.createElement('p');
      before.textContent = 'before the note';
      const root = document.createElement('div');
      root.innerHTML = '<div>one</div><div>two</div>';
      const after = document.createElement('p');
      after.textContent = 'after the note';
      document.body.append(before, root, after);
      const removed = root.lastChild!;
      const host = root.firstChild!.appendChild(document.createElement('span'));
      const inShadow = host.attachShadow({ mode: 'open' }).appendChild(document.createTextNode('shadow'));
      const template = root.firstChild!.appendChild(document.createElement('template'));
      const inTemplate = template.content.appendChild(document.createTextNode('template'));
      const held = document.createElement('div');
      const asked: [string, Node, number][] = [
        // A link tapped as a redraw took it away: what `touchend` can ask.
        ['removed from the note', removed.firstChild!, 0],
        ['never in the page', held, 0],
        ['in a shadow root', inShadow, 1],
        ['in a template', inTemplate, 1],
        ['before the note', before.firstChild!, 2],
      ];
      removed.remove();
      const walk = window.__dom.offsetOf(root, after.firstChild!, 3);
      return { compared: asked.map(([name, node, at]) => [name, window.__old(root, node, at), window.__dom.offsetOf(root, node, at)]), walk };
    });
    for (const [name, was, is] of answers.compared) expect([name, is]).toEqual([name, was]);
    // The one place it is not the old answer, on purpose. A point after the
    // note cloned the note and part of the page around it, and "read" that;
    // neither caller can ask (readSelection checks, a link is in the note).
    expect(answers.walk).toBe(0);
  });
});
