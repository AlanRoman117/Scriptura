/**
 * A note's Markdown, split into styled runs for the live editor.
 *
 * The live editor draws the note *as it is written*: a `## ` line is a heading
 * while it is typed, and `**word**` is bold. It can only do that safely if
 * drawing never changes the text, so this tokenizer is **lossless**: every
 * character of the source lands in exactly one span, in order, and the spans
 * of a line joined together are that line. Markers (`##`, `**`, `>` …) are
 * spans too, flagged `mark`, which the editor hides when the caret is on
 * another line — hidden, never removed, so the text in the page is always the
 * note, and a caret offset in the note is a position in the page.
 *
 * The grammar is `markdown.ts`'s: the same line patterns, imported, and inline
 * spans in the same order of precedence as `parseInline`. A test strips the
 * markers from every line and compares what is left with the preview's tree.
 *
 * ⚠️ Inline emphasis does not cross a line break here, though the preview
 * allows it inside a paragraph. Each line is drawn on its own so a keystroke
 * redraws one line; `**` left open at the end of a line stays literal until it
 * is closed on the same line.
 *
 * Kept free of React and the DOM, so jest can test it.
 */
import { BOARD_FENCE, BULLET, FENCE, HEADING, ORDERED, QUOTE, RULE } from './markdown';

/**
 * - `mark`: syntax, hidden off the active line.
 * - `prefix`: syntax that stays shown, because it carries meaning (a list's number).
 * - the rest: how the text is drawn.
 */
export type Mark = 'mark' | 'prefix' | 'strong' | 'em' | 'code' | 'link';

export interface Span {
  text: string;
  marks: Mark[];
}

export type LineKind =
  | 'blank'
  | 'paragraph'
  | 'heading'
  | 'bullet'
  | 'ordered'
  | 'quote'
  | 'rule'
  /** An opening or closing ``` line. */
  | 'fence'
  /** A line inside a code fence. */
  | 'code'
  /** A line inside a board embed's fence. */
  | 'board';

export interface LiveLine {
  kind: LineKind;
  /** A heading's level, 1–6. */
  level?: number;
  /** For the lines of a fenced block: the index of its opening line, and its language. */
  fence?: { start: number; lang: string };
  spans: Span[];
}

const span = (text: string, marks: Mark[]): Span => ({ text, marks });

/** Merges neighbours with the same marks, so a plain line is one text node. */
function compact(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (!s.text) continue;
    const last = out[out.length - 1];
    if (last && last.marks.length === s.marks.length && last.marks.every((m, i) => m === s.marks[i])) {
      last.text += s.text;
    } else {
      out.push({ text: s.text, marks: [...s.marks] });
    }
  }
  return out;
}

/**
 * Inline runs, in `parseInline`'s order: code, `[[link]]`, `**strong**`,
 * `*em*`/`_em_`. `outer` carries the styles of the spans this one sits in.
 */
export function inlineSpans(source: string, outer: Mark[] = []): Span[] {
  const out: Span[] = [];
  let i = 0;
  let text = '';
  const flush = () => {
    if (text) out.push(span(text, outer));
    text = '';
  };
  const wrapped = (open: string, inner: Span[], close: string, style: Mark) => {
    flush();
    out.push(span(open, [...outer, style, 'mark']));
    out.push(...inner);
    out.push(span(close, [...outer, style, 'mark']));
  };

  while (i < source.length) {
    const rest = source.slice(i);

    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      wrapped('`', [span(code[1], [...outer, 'code'])], '`', 'code');
      i += code[0].length;
      continue;
    }
    const link = /^\[\[([^\]]+)\]\]/.exec(rest);
    if (link) {
      wrapped('[[', [span(link[1], [...outer, 'link'])], ']]', 'link');
      i += link[0].length;
      continue;
    }
    const strong = /^\*\*([^*]+)\*\*/.exec(rest);
    if (strong) {
      wrapped('**', inlineSpans(strong[1], [...outer, 'strong']), '**', 'strong');
      i += strong[0].length;
      continue;
    }
    const em = /^([*_])([^*_]+)\1/.exec(rest);
    if (em) {
      wrapped(em[1], inlineSpans(em[2], [...outer, 'em']), em[1], 'em');
      i += em[0].length;
      continue;
    }
    text += source[i];
    i += 1;
  }
  flush();
  return out;
}

/** A line that opens with syntax (`## `, `> `, `1. `) followed by inline text. */
function prefixed(line: string, content: string, prefix: Mark): Span[] {
  const at = line.length - content.length;
  return compact([span(line.slice(0, at), [prefix]), ...inlineSpans(content)]);
}

/** Every line of a note, classified and split into runs. */
export function tokenizeNote(source: string): LiveLine[] {
  const lines = source.split('\n');
  const out: LiveLine[] = [];

  // The open fence, as parseMarkdown reads one: everything up to the next
  // fence line is its body, and an unclosed fence runs to the end.
  let fence: { start: number; lang: string } | null = null;

  lines.forEach((line, index) => {
    if (fence) {
      if (FENCE.test(line)) {
        out.push({ kind: 'fence', fence, spans: compact([span(line, ['mark'])]) });
        fence = null;
      } else {
        const kind = fence.lang === BOARD_FENCE ? 'board' : 'code';
        out.push({ kind, fence, spans: compact([span(line, ['code'])]) });
      }
      return;
    }

    const opening = FENCE.exec(line);
    if (opening) {
      fence = { start: index, lang: opening[1] ?? '' };
      out.push({ kind: 'fence', fence, spans: compact([span(line, ['mark'])]) });
      return;
    }

    if (line.trim() === '') {
      out.push({ kind: 'blank', spans: compact([span(line, [])]) });
      return;
    }
    if (RULE.test(line)) {
      out.push({ kind: 'rule', spans: compact([span(line, ['mark'])]) });
      return;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ kind: 'heading', level: heading[1].length, spans: prefixed(line, heading[2], 'mark') });
      return;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      out.push({ kind: 'quote', spans: prefixed(line, quote[1], 'mark') });
      return;
    }
    const ordered = ORDERED.exec(line);
    if (ordered) {
      out.push({ kind: 'ordered', spans: prefixed(line, ordered[1], 'prefix') });
      return;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      out.push({ kind: 'bullet', spans: prefixed(line, bullet[1], 'mark') });
      return;
    }
    out.push({ kind: 'paragraph', spans: compact(inlineSpans(line)) });
  });

  return out;
}

/** What identifies a drawn line: equal keys draw identical DOM. */
export const lineKey = (line: LiveLine): string => JSON.stringify(line);
