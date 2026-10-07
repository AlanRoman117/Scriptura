/**
 * The live editor's DOM: drawing a line, reading the text back, and turning a
 * caret between a position in the page and an offset in the note.
 *
 * Every function here leans on one invariant, kept by `livemd.ts`: the text in
 * the page *is* the note. The root holds one element per line, a line's text
 * nodes spell that line exactly, and markers are hidden with CSS, never
 * removed. So reading the note back is a walk over text nodes, and a caret
 * offset is a count of characters — no mapping tables to keep in step.
 *
 * ⚠️ Nothing here uses `innerHTML`. A note is arbitrary text, and may have been
 * drafted by an assistant; it reaches the page only through `textContent` and
 * text nodes, as in the preview.
 *
 * Only elements marked `data-widget` (a drawn board) are not text: reading
 * skips them, and they are `contenteditable="false"` so the caret cannot
 * enter them.
 */
import type { LiveLine } from './livemd';

/** The elements this module drew, so a line the browser made itself is recognised as foreign. */
const drawn = new WeakSet<Element>();

export const isDrawnLine = (el: Element): boolean => drawn.has(el);

const BLOCK = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/** The classes a line is drawn with. One place, so the drawing and the matching cannot drift. */
function classesOf(line: LiveLine): string[] {
  const classes = ['live-line', `live-line--${line.kind}`];
  if (line.level) classes.push(`live-line--h${line.level}`);
  if (line.fence?.lang === 'scriptura-board') classes.push('live-line--in-board');
  return classes;
}

/** The class a marked span is drawn with. */
const classOfMarks = (marks: readonly string[]): string => marks.map((m) => `md-${m}`).join(' ');

/** One line of the note, as an element. `widget` asks for a host for a drawn board. */
export function buildLine(line: LiveLine, { widget = false }: { widget?: boolean } = {}): HTMLElement {
  const el = document.createElement('div');
  el.className = classesOf(line).join(' ');
  // Each line takes its direction from its own first strong character, so a
  // Hebrew or Arabic line runs right to left beside English or Japanese ones.
  // Not tied to the interface language: a note's language is its writer's.
  el.dir = 'auto';

  for (const s of line.spans) {
    if (s.marks.length === 0) {
      el.append(document.createTextNode(s.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = classOfMarks(s.marks);
    span.textContent = s.text;
    el.append(span);
  }
  // An empty block has no height and no place for the caret without one.
  if (line.spans.length === 0) el.append(document.createElement('br'));
  if (widget) {
    const host = document.createElement('span');
    host.className = 'live-widget';
    host.dataset.widget = '';
    host.contentEditable = 'false';
    el.append(host);
  }
  drawn.add(el);
  return el;
}

/**
 * Whether a line the browser has edited is already what `buildLine` would
 * draw for `line`, so it can be kept as it is.
 *
 * Strict on purpose: the same classes, one `<span>` holding one text node for
 * each marked span, text nodes spelling each bare run, a `<br>` only on an
 * empty line, nothing else. Compared span by span, never as the line's joined
 * text, so a letter the browser put inside a marker's span — typing at the
 * edge of `**` — is a mismatch and the line is drawn again.
 *
 * ⚠️ The reason this exists: an edited line used to be rebuilt after every
 * keystroke, and the selection written again, whatever the browser had left.
 * Dictation typing a thousand keys a second into the editor lost half of
 * them (`tests/reader/live.spec.ts`, "a burst of keys").
 */
export function matchesLine(el: Element, line: LiveLine, { widget = false }: { widget?: boolean } = {}): boolean {
  if (!drawn.has(el) || el.tagName !== 'DIV') return false;
  const classes = Array.from(el.classList).filter((c) => c !== 'is-active');
  const wanted = classesOf(line);
  if (classes.length !== wanted.length || classes.some((c, i) => c !== wanted[i])) return false;

  const nodes = Array.from(el.childNodes);
  const host = widgetHost(el);
  if (!!host !== widget) return false;
  if (host) {
    if (nodes[nodes.length - 1] !== host) return false;
    nodes.pop();
  }

  if (line.spans.length === 0) return nodes.length === 1 && nodes[0] instanceof HTMLBRElement;

  let at = 0;
  for (const span of line.spans) {
    if (span.marks.length === 0) {
      // A bare run: one or more text nodes spelling it, none of them empty.
      let text = '';
      while (at < nodes.length && nodes[at].nodeType === Node.TEXT_NODE && text.length < span.text.length) {
        const data = (nodes[at] as Text).data;
        if (data === '') return false;
        text += data;
        at += 1;
      }
      if (text !== span.text) return false;
      continue;
    }
    const node = nodes[at];
    if (!(node instanceof HTMLSpanElement) || node.className !== classOfMarks(span.marks)) return false;
    if (node.childNodes.length !== 1 || node.firstChild!.nodeType !== Node.TEXT_NODE) return false;
    if ((node.firstChild as Text).data !== span.text) return false;
    at += 1;
  }
  return at === nodes.length;
}

/** The host a board is drawn into, if this line has one. */
export const widgetHost = (line: Element): HTMLElement | null =>
  line.querySelector<HTMLElement>(':scope > [data-widget]');

/**
 * The note's text, read back from whatever the browser left in the page.
 *
 * Tolerant on purpose: after an edit the page may hold a `<div>` the browser
 * made, a `<br>`, or a `\n` inside a text node, and none of it may lose a
 * character. Blocks are lines, a `<br>` is a line break unless it only holds
 * an empty block open, and text is text. The next redraw puts it all back into
 * the canonical form.
 */
export function readText(root: Node): string {
  const lines: string[] = [];
  let current: string | null = null;

  const endLine = () => {
    if (current !== null) lines.push(current);
    current = null;
  };
  const append = (s: string) => {
    current = (current ?? '') + s;
  };

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        append((child as Text).data);
      } else if (child instanceof Element) {
        if (child.hasAttribute('data-widget')) continue;
        if (child.tagName === 'BR') {
          // The last <br> in a block only holds an empty line open.
          if (child.nextSibling || !BLOCK.has(node.nodeName)) append('\n');
          else current ??= '';
          continue;
        }
        if (BLOCK.has(child.tagName)) {
          endLine();
          current = '';
          walk(child);
          endLine();
        } else {
          walk(child);
        }
      }
    }
  };

  walk(root);
  endLine();
  return lines.join('\n');
}

/**
 * The offset in the note of a point in the page.
 *
 * Measured by reading back everything before the point, with the same rules as
 * `readText` — so it is right even while the page is out of step with the
 * note, between an edit and its redraw.
 */
export function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  // A point between two lines of the root is the start of the second.
  if (node === root) {
    const lines = root.children;
    if (offset < lines.length) return offsetOf(root, lines[offset], 0);
    if (lines.length === 0) return 0;
    const last = lines[lines.length - 1];
    return offsetOf(root, last, last.childNodes.length);
  }
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  const fragment = range.cloneContents();
  // A point at the very start of a line clones that line empty; readText
  // then counts it as a line, which is the "\n" before the point.
  return readText(fragment).length;
}

/** The current selection as offsets in the note, or null when it is not in `root`. */
export function readSelection(root: HTMLElement): { start: number; end: number } | null {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOf(root, range.startContainer, range.startOffset);
  const end = range.collapsed ? start : offsetOf(root, range.endContainer, range.endOffset);
  return { start, end };
}

/**
 * The point in the page for an offset in the note. Needs the page to be in
 * step with the note — call it only after a redraw — and `starts`, the offset
 * each line starts at.
 */
export function pointAt(root: HTMLElement, starts: readonly number[], offset: number): { node: Node; offset: number } {
  const lines = root.children;
  if (lines.length === 0) return { node: root, offset: 0 };

  const index = Math.min(lineIndex(starts, offset), lines.length - 1);
  const line = lines[index];
  let left = offset - starts[index];

  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('[data-widget]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  let last: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (left <= n.data.length) return { node: n, offset: left };
    left -= n.data.length;
    last = n;
  }
  return last ? { node: last, offset: last.data.length } : { node: line, offset: 0 };
}

/** The offset each line of `text` starts at. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

/** The index of the line an offset falls on. */
export function lineIndex(starts: readonly number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
