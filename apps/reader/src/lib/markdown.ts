/**
 * A small Markdown reader, for previewing a note in place.
 *
 * Hand-written rather than a dependency, and it parses to a **tree, never to
 * an HTML string**: nothing here can reach `innerHTML`, so a note — which is
 * arbitrary text, and may have been drafted by an assistant — cannot inject
 * markup into the app that is rendering it. That property is worth more here
 * than completeness.
 *
 * The subset is what someone actually writes in a study note: headings, bold,
 * italic, code, lists, quotes, rules, `[[links]]`, and an embedded board.
 * Anything unrecognised stays as the text it is, which is the right failure for
 * a format whose whole appeal is that it reads fine unrendered.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'wikilink'; target: string };

export type Block =
  | { type: 'heading'; level: number; children: Inline[]; offset: number }
  | { type: 'paragraph'; children: Inline[]; offset: number }
  | { type: 'list'; ordered: boolean; items: Inline[][]; offset: number }
  | { type: 'quote'; children: Inline[]; offset: number }
  | { type: 'code'; lang: string; value: string; offset: number }
  | { type: 'board'; id: string; offset: number }
  | { type: 'rule'; offset: number };

/** The fence a board is embedded with. */
export const BOARD_FENCE = 'scriptura-board';

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*```\s*(\S*)\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];

  // Offsets are carried through so the preview can put the caret back where
  // the reader clicked — the whole reason a preview is bearable in one pane.
  const offsets: number[] = [];
  let at = 0;
  for (const line of lines) {
    offsets.push(at);
    at += line.length + 1;
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const offset = offsets[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const lang = fence[1] ?? '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++; // the closing fence
      // A board is a fenced block so it survives as plain text everywhere else;
      // only this app knows how to draw it.
      if (lang === BOARD_FENCE) {
        blocks.push({ type: 'board', id: body.join('').trim(), offset });
      } else {
        blocks.push({ type: 'code', lang, value: body.join('\n'), offset });
      }
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule', offset });
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        children: parseInline(heading[2]),
        offset,
      });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        parts.push(QUOTE.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ type: 'quote', children: parseInline(parts.join('\n')), offset });
      continue;
    }

    const ordered = ORDERED.test(line);
    if (ordered || BULLET.test(line)) {
      const items: Inline[][] = [];
      const matcher = ordered ? ORDERED : BULLET;
      while (i < lines.length && matcher.test(lines[i])) {
        items.push(parseInline(matcher.exec(lines[i])![1]));
        i++;
      }
      blocks.push({ type: 'list', ordered, items, offset });
      continue;
    }

    const parts: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !HEADING.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
      !RULE.test(lines[i]) &&
      !FENCE.test(lines[i])
    ) {
      parts.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(parts.join('\n')), offset });
  }

  return blocks;
}

/**
 * Inline spans, scanned left to right.
 *
 * Code is matched before emphasis so `**` inside backticks stays literal —
 * which matters in a Bible study note more than it sounds, since a quoted
 * reference can carry almost any punctuation.
 */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = '';
  let i = 0;

  const flush = () => {
    if (text) out.push({ type: 'text', value: text });
    text = '';
  };

  while (i < source.length) {
    const rest = source.slice(i);

    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      flush();
      out.push({ type: 'code', value: code[1] });
      i += code[0].length;
      continue;
    }

    const link = /^\[\[([^\]]+)\]\]/.exec(rest);
    if (link) {
      flush();
      out.push({ type: 'wikilink', target: link[1] });
      i += link[0].length;
      continue;
    }

    const strong = /^\*\*([^*]+)\*\*/.exec(rest);
    if (strong) {
      flush();
      out.push({ type: 'strong', children: parseInline(strong[1]) });
      i += strong[0].length;
      continue;
    }

    const em = /^([*_])([^*_]+)\1/.exec(rest);
    if (em) {
      flush();
      out.push({ type: 'em', children: parseInline(em[2]) });
      i += em[0].length;
      continue;
    }

    text += source[i];
    i++;
  }

  flush();
  return out;
}

/** The fenced block that embeds a board in a note. */
export const boardEmbed = (id: string): string => '```' + BOARD_FENCE + '\n' + id + '\n```';

/**
 * Replace every board embed with readable Markdown.
 *
 * Used on export: in the app a fence draws the board, but a `.md` opened
 * anywhere else would show a code block containing a UUID, which is worse than
 * useless. The reader's own files should say what the board actually held.
 */
export function inlineBoardEmbeds(body: string, render: (id: string) => string | null): string {
  const fence = new RegExp('```' + BOARD_FENCE + '\\n([\\s\\S]*?)\\n?```', 'g');
  return body.replace(fence, (whole, id: string) => render(id.trim()) ?? whole);
}
