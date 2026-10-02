/**
 * Menus that step aside while the reader reads, on a small screen.
 *
 * On a phone the reading bar, the search box and the chapter title were all
 * pinned, and with the notes' grip below them an iPhone SE in landscape had
 * 164 of its 375 pixels left for scripture. At 400% zoom on a desktop — the
 * same narrow layout — the pinned bars are taller than the window. So the
 * menus recede when the reader scrolls on, and come back when they scroll
 * back, reach the top, move focus into them, or press the pane's menu button.
 *
 * ⚠️ Receded is out of sight, never out of reach. The menus stay in the
 * accessibility tree and the Tab order — never `display: none`, never
 * `visibility: hidden`, never `inert` — so a screen reader still finds the
 * passage landmark and the Help chip, and focus arriving in them brings them
 * back on screen (2.4.11). The button means no one depends on a scroll
 * gesture (2.5.1), and nothing here runs on a timer (2.2.3).
 *
 * The decision is a pure function, so jest can state it exactly; the hook
 * only feeds it scroll positions. No imports beyond React, and no
 * `import.meta`, for the same reason as lib/geometry.ts.
 *
 * The hook listens for `keydown` on the document, which lib/focus.ts asks
 * components not to do. It handles no key and stops none: it only notes that
 * a key was pressed. Escape and every other key still belong to the dismiss
 * stack there.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Menus = 'shown' | 'hidden';

/** How far the reader scrolls on before the menus leave, in px. */
export const HIDE_AFTER = 48;
/** How far back before they return. Shorter: asking for them should be easy. */
export const SHOW_AFTER = 24;

export interface ScrollSample {
  /** The scroller's `scrollTop`. */
  top: number;
  /** Its `clientHeight`. */
  height: number;
  scrollHeight: number;
}

export interface RecedeState {
  menus: Menus;
  /**
   * Where travel is measured from: the highest point since the menus were
   * shown, or the lowest since they were hidden. A reader who wavers a few
   * pixels either way has not changed direction.
   */
  anchor: number;
  /** The scroller's height at the last sample. */
  height: number;
}

export const INITIAL: RecedeState = { menus: 'shown', anchor: 0, height: 0 };

/**
 * The menus' state after one more scroll position.
 *
 * `gain` is how much taller the scroller becomes when its menus leave: nothing
 * for scripture, whose bars are sticky and keep their place in the flow, and
 * the height of the picker row and the tabs for a note, which is laid out
 * beneath them. A note's menus leave only once the reader has scrolled that
 * far: the room they give back is then filled with the lines just scrolled
 * past, and the line being read stays where it is (see `padFor`).
 */
export function nextMenus(state: RecedeState, sample: ScrollSample, gain = 0): RecedeState {
  const range = Math.max(0, sample.scrollHeight - sample.height);
  // An elastic overscroll runs past either end and springs back, which would
  // read as a scroll the other way.
  const top = Math.min(range, Math.max(0, sample.top));

  // The scroller itself changed size — its menus came or went, the keyboard
  // opened, the phone turned. Whatever the position did then was not the
  // reader's doing: measure from here, and decide nothing.
  if (sample.height !== state.height) return { ...state, anchor: top, height: sample.height };

  if (state.menus === 'shown') {
    const anchor = Math.min(state.anchor, top);
    if (top >= gain && top - anchor >= HIDE_AFTER) return { ...state, menus: 'hidden', anchor: top };
    return anchor === state.anchor ? state : { ...state, anchor };
  }

  const anchor = Math.max(state.anchor, top);
  if (top <= 0 || anchor - top >= SHOW_AFTER) return { ...state, menus: 'shown', anchor: top };
  return anchor === state.anchor ? state : { ...state, anchor };
}

/**
 * The same position, measured from afresh: for a scroll the reader did not
 * make. Nothing is decided on it.
 */
export function rebase(state: RecedeState, sample: ScrollSample): RecedeState {
  const range = Math.max(0, sample.scrollHeight - sample.height);
  return { ...state, anchor: Math.min(range, Math.max(0, sample.top)), height: sample.height };
}

/**
 * Padding for the top of a scroller that grew by `gain` when its menus left,
 * so that what the reader was looking at stays where it was.
 *
 * The scroller's top edge moves up by `gain`; padding its content by the same
 * amount moves every line back down to where it stood, and the room above is
 * filled by the lines scrolled past. No scroll position is written — a
 * position set under a moving finger is where touch scrolling goes wrong.
 * Scrolled less than `gain` (the button, pressed near the top), only that
 * much can be held, and the text moves up into the room, which is what was
 * asked for. Without this the text jumped a menu's height each time, and the
 * lines it jumped over could only be read by scrolling back — which brought
 * the menus back, and the lines went out of view again.
 */
export function padFor(gain: number, top: number): number {
  return Math.max(0, Math.min(gain, top));
}

/** The keys that scroll a pane when the reader is not typing into something. */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);

/**
 * Whether a key press is the reader scrolling. In a field the same keys move
 * the caret or change the value, and what scrolls then is the browser keeping
 * the caret in view.
 */
export function scrollsByKey(key: string, typing: boolean): boolean {
  return !typing && SCROLL_KEYS.has(key);
}

interface RecedingOptions {
  /** Whether anything recedes at all: the phone layout, with something to read. */
  enabled: boolean;
  /** The reader's preference: recede while scrolling, or only from the button. */
  auto: boolean;
  /** Which descendant's scrolling counts, when the listener sits on an ancestor. */
  match?: string;
  /** The menus themselves, as a selector: they stay while the reader is working in them. */
  menus: string;
  /** How much taller the scroller gets without its menus (see `nextMenus`). */
  gain?: () => number;
}

export interface Receding {
  menus: Menus;
  /** How far the scroller was scrolled when the menus last changed (for `padFor`). */
  at: number;
  /** Give this to the element whose scrolling is watched, or an ancestor of it. */
  watch: (node: HTMLElement | null) => void;
  show: () => void;
  hide: () => void;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'));

/*
 * Whether the reader's last input was a key. One pair of listeners for the
 * page, added when the first pane asks.
 *
 * Not `:focus-visible`: focus handed on by script — to the book picker, when
 * the storage notice is dismissed — matches it after a tap as well, and that
 * would pin the menus for a reader who has never touched a key.
 */
let keyboard = false;
let listening = false;
function followInput(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  const byKey = () => {
    keyboard = true;
  };
  const byPointer = () => {
    keyboard = false;
  };
  document.addEventListener('keydown', byKey, true);
  document.addEventListener('pointerdown', byPointer, true);
  document.addEventListener('touchstart', byPointer, { capture: true, passive: true });
  document.addEventListener('wheel', byPointer, { capture: true, passive: true });
}

/**
 * Whether the reader is working in the menus, so they must stay: focus is in
 * them, and it is a field being typed into (its keyboard is up, on a phone)
 * or the reader is driving with keys. Focus merely left behind by a finger —
 * on the select a chapter was just chosen from — holds nothing, or the menus
 * would stay for the whole of that chapter.
 */
export function workingIn(menus: string): boolean {
  const active = document.activeElement;
  if (!active?.closest(menus)) return false;
  return keyboard || active.matches(TEXT_FIELD);
}

/** A field that is typed into. A ticked box is an input too, and holds nothing. */
const TEXT_FIELD = 'textarea, input:not([type]), input[type="text"], input[type="search"]';

/**
 * The menus' state for one pane.
 *
 * Scroll events do not bubble, so the listener captures: `watch` can be given
 * the scroller itself, or — for a note, whose scroller is one of three
 * elements depending on the editor — the group around it, with `match`
 * naming which descendants count. A board has no scroller at all — it is
 * panned, not scrolled — so the canvas gives `watch` nothing and calls `hide`
 * itself when the reader starts moving things.
 *
 * ⚠️ Only the reader's own scrolling counts: a finger dragging, the wheel, a
 * scroll key, the scrollbar. A pane also scrolls when focus moves to a verse
 * out of view, when a pressed verse is brought clear of its actions, when a
 * caret is followed — and if those brought the menus back, they came back
 * over the very thing the browser had just scrolled into view, which was
 * placed for the menus being away (2.4.11). So a scroll is trusted only after
 * one of those inputs, and a tap or a move of focus withdraws the trust.
 */
export function useRecedingMenus(options: RecedingOptions): Receding {
  const [view, setView] = useState<{ menus: Menus; at: number }>({ menus: 'shown', at: 0 });
  const [node, setNode] = useState<HTMLElement | null>(null);
  const state = useRef<RecedeState>(INITIAL);
  const latest = useRef(options);
  latest.current = options;

  const set = useCallback(
    (next: Menus) => {
      if (state.current.menus === next) return;
      state.current = { ...state.current, menus: next };
      const { match } = latest.current;
      const scroller = match ? node?.querySelector<HTMLElement>(match) : node;
      setView({ menus: next, at: scroller?.scrollTop ?? 0 });
    },
    [node]
  );
  const show = useCallback(() => set('shown'), [set]);
  const hide = useCallback(() => set('hidden'), [set]);

  const { enabled } = options;
  useEffect(() => {
    if (!node || !enabled) return;
    followInput();
    const counts = (el: EventTarget | null): el is HTMLElement => {
      const { match } = latest.current;
      return el instanceof HTMLElement && (match ? el.matches(match) : el === node);
    };
    // Where the scroller is the watched element itself, its size is known
    // before it moves: the first scroll is then travel, not a change of size.
    if (!latest.current.match) {
      state.current = { ...state.current, anchor: node.scrollTop, height: node.clientHeight };
    }

    /** Whether the scrolls arriving now are the reader's. */
    let theirs = false;
    const trust = () => {
      theirs = true;
    };
    const withdraw = () => {
      theirs = false;
    };
    const onKey = (e: KeyboardEvent) => {
      theirs = scrollsByKey(e.key, isTyping(e.target));
    };
    // A press on the scroller itself, not on anything in it, is its scrollbar.
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && counts(e.target)) theirs = true;
    };

    const onScroll = (e: Event) => {
      const el = e.target;
      if (!counts(el)) return;
      const { auto, menus: within, gain } = latest.current;
      const sample = { top: el.scrollTop, height: el.clientHeight, scrollHeight: el.scrollHeight };
      const before = state.current;
      // At the top of a text its menus are there, however the reader got
      // there and whatever they have switched off. Nothing is covered by it:
      // the menus sit above the text's first line.
      if (sample.top <= 0 && before.menus === 'hidden') {
        state.current = { ...rebase(before, sample), menus: 'shown' };
        setView({ menus: 'shown', at: 0 });
        return;
      }
      if (!theirs) {
        state.current = rebase(before, sample);
        return;
      }
      const after = nextMenus(before, sample, gain?.() ?? 0);
      if (after.menus === before.menus) {
        state.current = after;
        return;
      }
      // The position is still tracked while the reader has the automatic part
      // switched off, or focus holds the menus, so that turning either back
      // measures from where they are and not from where they were.
      if (!auto || (after.menus === 'hidden' && workingIn(within))) {
        state.current = { ...after, menus: before.menus };
        return;
      }
      state.current = after;
      setView({ menus: after.menus, at: Math.max(0, sample.top) });
    };

    const passive = { capture: true, passive: true } as const;
    node.addEventListener('scroll', onScroll, passive);
    node.addEventListener('touchmove', trust, passive);
    node.addEventListener('wheel', trust, passive);
    node.addEventListener('keydown', onKey, true);
    node.addEventListener('pointerdown', onPointerDown, true);
    node.addEventListener('click', withdraw, true);
    node.addEventListener('focusin', withdraw, true);
    return () => {
      node.removeEventListener('scroll', onScroll, { capture: true });
      node.removeEventListener('touchmove', trust, { capture: true });
      node.removeEventListener('wheel', trust, { capture: true });
      node.removeEventListener('keydown', onKey, true);
      node.removeEventListener('pointerdown', onPointerDown, true);
      node.removeEventListener('click', withdraw, true);
      node.removeEventListener('focusin', withdraw, true);
    };
  }, [node, enabled]);

  // Focus arriving in the receded menus brings them back: nothing that has
  // focus is off the screen (2.4.11). On the document, because a pane's menus
  // are not all inside it — the notes' and the board's tabs belong to the sheet.
  // (That the pane does not also scroll to look for them is BiblePane's and
  // the stylesheet's doing.)
  //
  // A key pressed with focus already inside receded menus shows them too:
  // focus a finger left on a picker would otherwise be worked blind.
  useEffect(() => {
    if (!enabled) return;
    followInput();
    const inMenus = (el: EventTarget | null) => el instanceof Element && !!el.closest(latest.current.menus);
    const onFocus = (e: FocusEvent) => {
      if (inMenus(e.target)) show();
    };
    const onKey = () => {
      if (state.current.menus === 'hidden' && inMenus(document.activeElement)) show();
    };
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [enabled, show]);

  // Nothing recedes while there is nothing to recede from — a panel over the
  // chapter, no note open, no board. Coming back, the menus are showing: a
  // state left hidden would return with the chapter, at the top of it, under
  // a button offering to show menus that were plainly there.
  useEffect(() => {
    if (enabled || state.current.menus === 'shown') return;
    state.current = { ...state.current, menus: 'shown' };
    setView({ menus: 'shown', at: 0 });
  }, [enabled]);

  return { menus: enabled ? view.menus : 'shown', at: view.at, watch: setNode, show, hide };
}
