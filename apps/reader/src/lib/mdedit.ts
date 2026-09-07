/**
 * The formatting a toolbar applies, as pure text operations.
 *
 * Separated from the toolbar because the interesting part is the *selection*
 * arithmetic — where the caret lands after a heading is toggled, what happens
 * when three lines are selected — and that is worth testing directly rather
 * than through a browser and a click.
 *
 * Every operation toggles: applying bold to already-bold text removes it, and
 * a second click on H2 goes back to a paragraph. A toolbar button that only
 * ever adds syntax is a trap for exactly the reader this is for, who does not
 * know how to take it out again.
 */

export interface Edit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

const lineBounds = (text: string, at: number) => {
  const start = text.lastIndexOf('\n', at - 1) + 1;
  const found = text.indexOf('\n', at);
  return { start, end: found === -1 ? text.length : found };
};

/** The full lines covered by a selection. */
function selectedLines(text: string, start: number, end: number) {
  const from = lineBounds(text, start).start;
  const to = lineBounds(text, end).end;
  return { from, to, lines: text.slice(from, to).split('\n') };
}

function replaceRange(text: string, from: number, to: number, next: string): Edit {
  return {
    text: text.slice(0, from) + next + text.slice(to),
    selectionStart: from,
    selectionEnd: from + next.length,
  };
}

/** `# `, `## ` … applied to every selected line, or removed if already there. */
export function toggleHeading(text: string, start: number, end: number, level: number): Edit {
  const { from, to, lines } = selectedLines(text, start, end);
  const prefix = '#'.repeat(level) + ' ';
  const allHave = lines.every((l) => l.startsWith(prefix));

  const next = lines
    .map((line) => {
      const bare = line.replace(/^#{1,6}\s+/, '');
      return allHave ? bare : prefix + bare;
    })
    .join('\n');
  return replaceRange(text, from, to, next);
}

/** How many of `ch` sit at the end of `s`. */
function runAtEnd(s: string, ch: string): number {
  let n = 0;
  while (n < s.length && s[s.length - 1 - n] === ch) n += 1;
  return n;
}

/** How many of `ch` sit at the start of `s`. */
function runAtStart(s: string, ch: string): number {
  let n = 0;
  while (n < s.length && s[n] === ch) n += 1;
  return n;
}

/**
 * `**bold**`, `*italic*`, `` `code` `` around the selection.
 *
 * ⚠️ The "already wrapped" test compares the **whole run** of marker
 * characters, not just the marker's own length. Asking for italic on a word
 * already inside `**` finds a `*` on each side and would otherwise read as
 * "already italic" and un-bold it — so `**Word**` becomes `*Word*` and the
 * reader watches a button labelled *I* remove their bold.
 */
export function toggleWrap(text: string, start: number, end: number, marker: string): Edit {
  const selected = text.slice(start, end);
  const ch = marker[0];
  const width = marker.length;

  // Wrapped inside the selection — the reader selected the markers too.
  if (
    selected.length > width * 2 &&
    runAtStart(selected, ch) === width &&
    runAtEnd(selected, ch) === width
  ) {
    return replaceRange(text, start, end, selected.slice(width, -width));
  }

  // Wrapped just outside it, which is what double-clicking a bold word gives.
  if (runAtEnd(text.slice(0, start), ch) === width && runAtStart(text.slice(end), ch) === width) {
    return replaceRange(text, start - width, end + width, selected);
  }

  if (!selected) {
    // Nothing selected: leave the caret between the markers, ready to type.
    const next = marker + marker;
    return {
      text: text.slice(0, start) + next + text.slice(start),
      selectionStart: start + width,
      selectionEnd: start + width,
    };
  }

  // The *words* stay selected, not the markers around them. Selecting the
  // markers too means the next keystroke deletes the thing just formatted —
  // and it also makes a second style (bold then italic) impossible to apply.
  return {
    text: text.slice(0, start) + marker + selected + marker + text.slice(end),
    selectionStart: start + width,
    selectionEnd: end + width,
  };
}

export type LineStyle = 'bullet' | 'number' | 'quote';

const LINE_PREFIX: Record<LineStyle, RegExp> = {
  bullet: /^[-*+]\s+/,
  number: /^\d+[.)]\s+/,
  quote: /^>\s?/,
};

/** Bullets, numbers, or a blockquote across every selected line. */
export function toggleLineStyle(text: string, start: number, end: number, style: LineStyle): Edit {
  const { from, to, lines } = selectedLines(text, start, end);
  const pattern = LINE_PREFIX[style];
  const allHave = lines.every((l) => l.trim() === '' || pattern.test(l));

  let n = 0;
  const next = lines
    .map((line) => {
      const bare = line.replace(/^(?:[-*+]\s+|\d+[.)]\s+|>\s?)/, '');
      if (allHave) return bare;
      n += 1;
      if (style === 'bullet') return `- ${bare}`;
      if (style === 'number') return `${n}. ${bare}`;
      return `> ${bare}`;
    })
    .join('\n');
  return replaceRange(text, from, to, next);
}

/** Insert at the caret, replacing any selection, and leave the caret after it. */
export function insertAt(text: string, start: number, end: number, snippet: string): Edit {
  return {
    text: text.slice(0, start) + snippet + text.slice(end),
    selectionStart: start + snippet.length,
    selectionEnd: start + snippet.length,
  };
}
