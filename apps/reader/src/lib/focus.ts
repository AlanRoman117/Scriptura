/**
 * Where focus goes, and what Escape closes.
 *
 * Three small hooks that every transient surface in the reader uses, so a new
 * panel cannot get this wrong by forgetting:
 *
 * - `useReturnFocus` remembers what had focus when a surface opened and gives
 *   it back when the surface closes. Without it, closing a panel or the verse
 *   actions dropped focus onto <body>, and a keyboard user started over from
 *   the top of the page (2.4.3).
 *
 * - `useDismissable` is one stack for every open surface. A single document
 *   listener closes only the topmost entry on Escape, and closes an entry when
 *   a press lands outside it. Before this, four components each listened on
 *   `window` for Escape and one key closed all of them at once — the swatches,
 *   a connection in progress, and the search suggestions, together.
 *
 * - `useRovingTabIndex` makes a group of controls one Tab stop with arrow keys
 *   between them, which is what `role="toolbar"` promises and what a row of
 *   five swatches needs to be walked rather than tabbed through (4.1.2).
 *
 * The stack is module state, not React state, for the same reason the
 * one-proposal guard in App is a ref: it has to be true the instant it
 * changes, and two surfaces opening in one tick must both be on it.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/* ── Return focus ─────────────────────────────────────────────────────────── */

/**
 * Remember the focused element when `open` turns true; give focus back when
 * `open` turns false *or the component unmounts* — panels here only exist
 * while open, so unmount is how most of them close.
 *
 * `fallback` is a selector for when the remembered element is gone (the "See
 * all" button that opened the results lives in a panel that closed with it),
 * or when the surface was opened by a pointer in a browser that does not focus
 * buttons on click.
 */
export function useReturnFocus(open: boolean, fallback?: string): void {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    return () => {
      // After the closing render, so the element we return to is the one on
      // screen now, not one about to be replaced.
      requestAnimationFrame(() => {
        // Only if focus was actually lost. Quote and Link close the verse
        // actions *and* move focus into the note on purpose; giving it back
        // to the verse number here would take it away again, and the reader
        // would type their reflection into nothing.
        const now = document.activeElement;
        if (now && now !== document.body && document.contains(now)) return;
        const remembered =
          previous instanceof HTMLElement && previous !== document.body && document.contains(previous)
            ? previous
            : null;
        const target = remembered ?? (fallback ? document.querySelector<HTMLElement>(fallback) : null);
        target?.focus({ preventScroll: true });
      });
    };
  }, [open, fallback]);
}

/* ── The dismiss stack ────────────────────────────────────────────────────── */

interface Entry {
  ref: RefObject<HTMLElement | null>;
  close: () => void;
  /** `false` disables outside-press closing (a modal owns its backdrop). */
  outside: boolean;
  /** Presses inside elements matching this are left to those elements. */
  ignore?: string;
}

const stack: Entry[] = [];
let listening = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  // A native <dialog> handles its own Escape through `cancel`; if one is open
  // and on top, leave the key to it.
  const top = stack[stack.length - 1];
  if (top.ref.current instanceof HTMLDialogElement && top.ref.current.open) return;
  e.preventDefault();
  top.close();
}

function onPointerDown(e: PointerEvent) {
  if (stack.length === 0) return;
  const top = stack[stack.length - 1];
  if (!top.outside) return;
  const target = e.target as Element;
  // A press on a sibling that opens the same kind of surface (another verse)
  // is that sibling's to handle: closing here first would reflow the page
  // under the pointer before its click arrived, and the click would land on
  // whatever had moved into the spot.
  if (top.ignore && target.closest?.(top.ignore)) return;
  const el = top.ref.current;
  if (el && !el.contains(target)) top.close();
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onPointerDown);
}

/**
 * Keep a surface on the dismiss stack while `open` is true.
 *
 * `ref` is the surface's root; a press outside it closes it (unless
 * `outside: false`). Escape closes whichever surface is on top, and only that
 * one. Entries leave the stack when they close or unmount, wherever they were
 * in it, so a parent closing under an open child does not strand the child.
 */
export function useDismissable(
  open: boolean,
  close: () => void,
  ref: RefObject<HTMLElement | null>,
  options: { outside?: boolean; ignore?: string } = {}
): void {
  const latest = useRef(close);
  latest.current = close;
  const outside = options.outside ?? true;
  const ignore = options.ignore;

  useEffect(() => {
    if (!open) return;
    listen();
    const entry: Entry = { ref, close: () => latest.current(), outside, ignore };
    stack.push(entry);
    return () => {
      const at = stack.indexOf(entry);
      if (at !== -1) stack.splice(at, 1);
    };
  }, [open, ref, outside, ignore]);
}

/** Test seam: what is on the stack right now. */
export const dismissableCount = (): number => stack.length;

/* ── Roving tabindex ──────────────────────────────────────────────────────── */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * One Tab stop for a group; arrows move within it.
 *
 * The group's controls are whatever matches inside `ref` at the time a key is
 * pressed, so children may come and go. The last-focused control keeps
 * `tabIndex=0` and the rest `-1`, so Tab lands where the reader left off and
 * Shift+Tab from the next control comes back to the same place.
 */
export function useRovingTabIndex(
  ref: RefObject<HTMLElement | null>,
  options: { orientation?: 'horizontal' | 'vertical' | 'both' } = {}
): void {
  const orientation = options.orientation ?? 'horizontal';

  const controls = useCallback(
    () => (ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)) : []),
    [ref]
  );

  const assign = useCallback(
    (current: HTMLElement | null) => {
      const all = controls();
      if (all.length === 0) return;
      const active = current && all.includes(current) ? current : all[0];
      for (const el of all) el.tabIndex = el === active ? 0 : -1;
    },
    [controls]
  );

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    assign(null);

    const onFocusIn = (e: FocusEvent) => assign(e.target as HTMLElement);
    const onKey = (e: KeyboardEvent) => {
      const all = controls();
      const at = all.indexOf(document.activeElement as HTMLElement);
      if (at === -1) return;
      const forward =
        (orientation !== 'vertical' && e.key === 'ArrowRight') ||
        (orientation !== 'horizontal' && e.key === 'ArrowDown');
      const back =
        (orientation !== 'vertical' && e.key === 'ArrowLeft') ||
        (orientation !== 'horizontal' && e.key === 'ArrowUp');
      let next = -1;
      if (forward) next = (at + 1) % all.length;
      else if (back) next = (at - 1 + all.length) % all.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = all.length - 1;
      if (next === -1) return;
      e.preventDefault();
      assign(all[next]);
      all[next].focus();
    };

    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('keydown', onKey);
    };
  }, [ref, orientation, assign, controls]);
}
