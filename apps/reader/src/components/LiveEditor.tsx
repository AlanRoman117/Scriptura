import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { tokenizeNote, lineKey, type LiveLine } from '../lib/livemd';
import { buildLine, isDrawnLine, lineIndex, lineStarts, pointAt, readSelection, readText, widgetHost } from '../lib/livedom';
import { History, type ChangeKind, type Snapshot } from '../lib/history';
import { BOARD_FENCE } from '../lib/markdown';
import type { NoteSurface } from '../lib/surface';

interface LiveEditorProps {
  /** The note's text. */
  value: string;
  /** Which note it is — a new one starts a new undo history. */
  noteId: string;
  onChange: (text: string) => void;
  /** The caret moved or the text changed; the pane follows the heading and link under it. */
  onCaret?: () => void;
  /** Ctrl/⌘ + click on a `[[link]]`. */
  onFollowLink?: (offset: number) => void;
  /** A board embedded in the note, drawn in place while the caret is elsewhere. */
  renderBoard?: (id: string) => ReactNode;
  label: string;
  placeholder: string;
  ref?: Ref<NoteSurface>;
}

/** Whether this browser accepts `contenteditable="plaintext-only"` (every current engine does). */
const PLAINTEXT_ONLY = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('div');
    probe.contentEditable = 'plaintext-only';
    return probe.contentEditable === 'plaintext-only';
  } catch {
    return false;
  }
})();

/** What an `inputType` does to the undo history. */
const kindOf = (inputType: string): ChangeKind =>
  inputType === 'insertText' || inputType === 'insertCompositionText'
    ? 'type'
    : inputType.startsWith('delete')
      ? 'delete'
      : 'other';

/**
 * The note, drawn as it is written — Markdown that takes shape while it is
 * typed, the way Obsidian's live preview does.
 *
 * A `contenteditable` region whose text is the note, character for character
 * (see lib/livemd.ts and lib/livedom.ts). The browser is left to insert and
 * delete text itself — phone keyboards and input methods do things no script
 * can intercept reliably — and the editor then reads the text back and redraws
 * the lines that changed, putting the caret back by its offset. A line's
 * markers are hidden unless the caret is on it.
 *
 * ⚠️ **Nothing is redrawn during an IME composition.** Japanese and Chinese
 * are written through one, and touching the DOM in the middle of it breaks
 * the candidate window or commits half a word. The text is read back when the
 * composition ends.
 *
 * ⚠️ **The undo history is the editor's own** (lib/history.ts). Redrawing the
 * DOM leaves the browser's native one meaningless, so every undo and redo is
 * intercepted.
 *
 * It presents the same small surface as a textarea (`NoteSurface`), so the
 * toolbar, quoting from the Bible and the caret-restoring effects work the
 * same with either editor.
 */
export function LiveEditor({
  value,
  noteId,
  onChange,
  onCaret,
  onFollowLink,
  renderBoard,
  label,
  placeholder,
  ref,
}: LiveEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  /** The text the page shows, as far as the editor knows. */
  const text = useRef(value);
  /** The selection, kept while the editor does not have focus — a textarea keeps its own. */
  const selection = useRef({ start: 0, end: 0 });
  const keys = useRef<string[]>([]);
  const starts = useRef<number[]>([0]);
  const lines = useRef<LiveLine[]>([]);
  const history = useRef(new History());
  const composing = useRef(false);
  /** The state before the edit the browser is about to make, and what kind it is. */
  const pending = useRef<{ before: Snapshot; kind: ChangeKind } | null>(null);
  /** A pointer press is placing the caret itself, so focusing must not move it. */
  const pressing = useRef(false);
  const observer = useRef<MutationObserver | null>(null);
  /** A read-back is queued for the end of the current task. */
  const queued = useRef(false);
  /** What the browser changed since the last draw. */
  const touched = useRef<MutationRecord[]>([]);
  const [widgets, setWidgets] = useState<{ host: HTMLElement; id: string }[]>([]);
  // Read from a document listener, which should not be re-bound every render.
  const caretMoved = useRef(onCaret);
  caretMoved.current = onCaret;

  const snapshot = (): Snapshot => ({ text: text.current, ...selection.current });

  /** Marks the lines the selection touches, so their markers show. A board's fence counts as one line. */
  const markActive = () => {
    const el = root.current;
    if (!el) return;
    const focused = document.activeElement === el;
    let from = lineIndex(starts.current, selection.current.start);
    let to = lineIndex(starts.current, selection.current.end);
    const all = lines.current;
    const fenceOf = (i: number) => (all[i]?.fence?.lang === BOARD_FENCE ? all[i].fence : undefined);
    const first = fenceOf(from);
    if (first) from = Math.min(from, first.start);
    const last = fenceOf(to);
    if (last) {
      while (to + 1 < all.length && all[to + 1].fence?.start === last.start) to += 1;
    }
    Array.from(el.children).forEach((line, i) => line.classList.toggle('is-active', focused && i >= from && i <= to));
  };

  /** Draws `next`, re-creating only the lines that changed. */
  const draw = (next: string) => {
    const el = root.current;
    if (!el) return;
    const tokens = tokenizeNote(next);
    const nextKeys = tokens.map(lineKey);
    const oldKeys = [...keys.current];
    const children = Array.from(el.children);

    // Lines the browser touched since the last draw are stale whatever their key says.
    const records = [...touched.current, ...(observer.current?.takeRecords() ?? [])];
    touched.current = [];
    for (const record of records) {
      // A board drawing itself into its host is not an edit.
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest('[data-widget]')) continue;
      let node: Node | null = record.target;
      while (node && node.parentNode !== el) node = node.parentNode;
      const index = node ? children.indexOf(node as Element) : -1;
      if (index !== -1) oldKeys[index] = '';
    }

    const boardAt = (i: number) => tokens[i].kind === 'fence' && tokens[i].fence?.lang === BOARD_FENCE && tokens[i].fence?.start === i;
    const build = (i: number) => buildLine(tokens[i], { widget: boardAt(i) });

    const foreign =
      children.length !== oldKeys.length ||
      el.childNodes.length !== children.length ||
      children.some((c) => !isDrawnLine(c));
    if (foreign) {
      el.replaceChildren(...tokens.map((_, i) => build(i)));
    } else {
      let head = 0;
      while (head < oldKeys.length && head < nextKeys.length && oldKeys[head] === nextKeys[head]) head += 1;
      let tail = 0;
      while (
        tail < oldKeys.length - head &&
        tail < nextKeys.length - head &&
        oldKeys[oldKeys.length - 1 - tail] === nextKeys[nextKeys.length - 1 - tail]
      ) {
        tail += 1;
      }
      const anchor = children[oldKeys.length - tail] ?? null;
      for (let i = head; i < oldKeys.length - tail; i++) children[i].remove();
      const fresh = [];
      for (let i = head; i < nextKeys.length - tail; i++) fresh.push(build(i));
      for (const line of fresh) el.insertBefore(line, anchor);
    }

    observer.current?.takeRecords();
    touched.current = [];
    keys.current = nextKeys;
    lines.current = tokens;
    starts.current = lineStarts(next);
    el.toggleAttribute('data-empty', next === '');

    // Every drawn board, with the id its fence holds.
    const found: { host: HTMLElement; id: string }[] = [];
    Array.from(el.children).forEach((line, i) => {
      const host = widgetHost(line);
      if (!host) return;
      const body: string[] = [];
      for (let j = i + 1; j < tokens.length && tokens[j].kind === 'board'; j++) body.push(tokens[j].spans.map((s) => s.text).join(''));
      found.push({ host, id: body.join('').trim() });
    });
    setWidgets((prev) =>
      prev.length === found.length && prev.every((w, i) => w.host === found[i].host && w.id === found[i].id) ? prev : found
    );
  };

  /** Puts the page's selection where `selection` says, if the editor has focus. */
  const place = () => {
    const el = root.current;
    if (!el || document.activeElement !== el) return;
    markActive();
    const s = pointAt(el, starts.current, selection.current.start);
    const e = pointAt(el, starts.current, selection.current.end);
    const range = document.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    const current = document.getSelection();
    current?.removeAllRanges();
    current?.addRange(range);
    keepCaretInView(el, range);
  };

  /** Adopts a new text from outside or from the history: redraw, and move the caret. */
  const replace = (next: Snapshot, kind: ChangeKind | null) => {
    if (kind) history.current.record(snapshot(), next, kind);
    text.current = next.text;
    selection.current = clamp(next, next.text.length);
    draw(next.text);
    place();
    markActive();
  };

  /** After the browser edited the page: read the text back, redraw, record it. */
  const sync = () => {
    const el = root.current;
    if (!el || composing.current) return;
    const read = readText(el);
    const at = readSelection(el) ?? selection.current;
    const before = pending.current?.before ?? snapshot();
    const kind = pending.current?.kind ?? 'other';
    pending.current = null;
    text.current = read;
    selection.current = clamp(at, read.length);
    draw(read);
    place();
    if (read !== before.text) {
      history.current.record(before, snapshot(), kind);
      onChange(read);
    }
    onCaret?.();
  };

  /** Inserts `insert` over the selection as one edit of its own. */
  const insert = (insert: string, kind: ChangeKind) => {
    const { start, end } = selection.current;
    const t = text.current;
    const next = { text: t.slice(0, start) + insert + t.slice(end), start: start + insert.length, end: start + insert.length };
    replace(next, kind);
    onChange(next.text);
    onCaret?.();
  };

  const undo = (forward: boolean) => {
    const step = forward ? history.current.redo(snapshot()) : history.current.undo(snapshot());
    if (!step) return;
    replace(step, null);
    onChange(step.text);
    onCaret?.();
  };

  // The textarea-shaped surface the pane and the app talk to.
  const handle = (): NoteSurface => ({
    get value() {
      return text.current;
    },
    get selectionStart() {
      return selection.current.start;
    },
    get selectionEnd() {
      return selection.current.end;
    },
    setSelectionRange(start: number, end: number) {
      selection.current = clamp({ start, end }, text.current.length);
      place();
      markActive();
    },
    focus() {
      root.current?.focus({ preventScroll: true });
      place();
    },
    isFocused: () => document.activeElement === root.current,
    element: () => root.current,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, handle, []);

  // The element answers to a textarea's `value`, `selectionStart`,
  // `selectionEnd` and `setSelectionRange` too, so a script that works with
  // one — a browser extension, an assistive tool, a test — works with this.
  useLayoutEffect(() => {
    const el = root.current!;
    const surface = handle();
    Object.defineProperties(el, {
      value: { get: () => surface.value, configurable: true },
      selectionStart: { get: () => surface.selectionStart, configurable: true },
      selectionEnd: { get: () => surface.selectionEnd, configurable: true },
      setSelectionRange: { value: surface.setSelectionRange, configurable: true },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⚠️ The native `beforeinput`, not React's `onBeforeInput` — React's is a
  // polyfill built on `keypress` and `textInput`, which carries no
  // `inputType` and never sees Enter, undo or a deletion.
  const beforeInput = useRef<(event: InputEvent) => void>(() => {});
  beforeInput.current = (event: InputEvent) => {
    if (event.isComposing || composing.current) return;
    const type = event.inputType;
    if (type === 'historyUndo' || type === 'historyRedo') {
      event.preventDefault();
      undo(type === 'historyRedo');
      return;
    }
    if (type.startsWith('format')) {
      event.preventDefault();
      return;
    }
    if (type === 'insertParagraph' || type === 'insertLineBreak') {
      event.preventDefault();
      insert('\n', 'type');
      return;
    }
    pending.current = { before: snapshot(), kind: kindOf(type) };
  };
  useEffect(() => {
    const el = root.current!;
    const listener = (event: Event) => beforeInput.current(event as InputEvent);
    el.addEventListener('beforeinput', listener);
    return () => el.removeEventListener('beforeinput', listener);
  }, []);

  // Watch for the browser's own edits, so a line it touched is redrawn.
  useLayoutEffect(() => {
    const el = root.current!;
    // Records are delivered to the callback before the input event that
    // follows them, so they are collected here for the next draw to read.
    observer.current = new MutationObserver((records) => touched.current.push(...records));
    observer.current.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.current?.disconnect();
  }, []);

  // A different note: its own text and its own history.
  useLayoutEffect(() => {
    history.current.clear();
    text.current = value;
    selection.current = { start: 0, end: 0 };
    keys.current = [];
    root.current?.replaceChildren();
    draw(value);
    markActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // The text changed from outside — a quote from the Bible, a formatting
  // button, an accepted proposal. Recorded as a step of its own. Layout
  // effect, so it is in the page before the effects that place the caret.
  useLayoutEffect(() => {
    if (value === text.current || composing.current) return;
    replace({ text: value, ...clamp(selection.current, value.length) }, 'other');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // The selection, followed wherever it goes while it is in the editor.
  useEffect(() => {
    const onSelectionChange = () => {
      const el = root.current;
      if (!el || composing.current || document.activeElement !== el) return;
      const at = readSelection(el);
      if (!at) return;
      selection.current = clamp(at, text.current.length);
      markActive();
      caretMoved.current?.();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  return (
    <>
      <div
        ref={root}
        id="notes-surface"
        className="notes__surface live"
        data-testid="notes-surface"
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        contentEditable={PLAINTEXT_ONLY ? 'plaintext-only' : true}
        suppressContentEditableWarning
        spellCheck
        tabIndex={0}
        onPointerDown={() => {
          pressing.current = true;
        }}
        onFocus={() => {
          // Keyboard focus returns to where the caret was, as a textarea's does;
          // a press puts it where the press landed.
          if (!pressing.current) place();
          pressing.current = false;
          markActive();
        }}
        onBlur={() => {
          pressing.current = false;
          markActive();
        }}
        onKeyDown={(e) => {
          const mod = e.ctrlKey || e.metaKey;
          if (!mod || e.altKey) return;
          const key = e.key.toLowerCase();
          if (key === 'z' || key === 'y') {
            e.preventDefault();
            undo(key === 'y' || e.shiftKey);
          }
        }}
        onInput={(e) => {
          if ((e.nativeEvent as InputEvent).isComposing || queued.current) return;
          // ⚠️ Once per burst, not once per event. Inserting several lines
          // fires an input event per line and per break, all in one task;
          // reading back and redrawing on each made a pasted chapter
          // quadratic, and rewrote the DOM while the browser was still
          // inserting into it. A microtask still runs before the next paint.
          queued.current = true;
          queueMicrotask(() => {
            queued.current = false;
            sync();
          });
        }}
        onCompositionStart={() => {
          pending.current = { before: snapshot(), kind: 'type' };
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          sync();
        }}
        onPaste={(e) => {
          // Plain text only, as one step — never the markup a web page carries.
          e.preventDefault();
          insert(e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'), 'other');
        }}
        onDrop={(e) => {
          // Dropped text would arrive as markup and in a place the history cannot
          // describe; dragging text within a note is rare enough to leave out.
          e.preventDefault();
        }}
        onClick={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          if (!(e.target as HTMLElement).closest('.md-link')) return;
          e.preventDefault();
          onFollowLink?.(selection.current.start);
        }}
      />
      {renderBoard && widgets.map((w, i) => createPortal(renderBoard(w.id), w.host, `${w.id}:${i}`))}
    </>
  );
}

const clamp = <T extends { start: number; end: number }>(at: T, length: number): { start: number; end: number } => {
  const start = Math.max(0, Math.min(at.start, length));
  const end = Math.max(start, Math.min(at.end, length));
  return { start, end };
};

/** Scrolls the editor so the caret is visible — what a textarea does for itself. */
function keepCaretInView(el: HTMLElement, range: Range) {
  const rect = range.getClientRects()[0] ?? (range.startContainer as Element).getBoundingClientRect?.();
  if (!rect) return;
  const box = el.getBoundingClientRect();
  if (rect.top < box.top) el.scrollTop -= box.top - rect.top;
  else if (rect.bottom > box.bottom) el.scrollTop += rect.bottom - box.bottom;
}
