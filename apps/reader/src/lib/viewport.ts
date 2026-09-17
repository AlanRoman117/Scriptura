/**
 * The viewport as the reader actually sees it, and one way to drag.
 *
 * A phone has two viewports. The layout viewport is what `100vh` and
 * `position: fixed` measure against; the *visual* viewport is the part not
 * under the software keyboard. iOS does not shrink the first when the
 * keyboard opens — it scrolls the second — so anything sized or anchored in
 * `vh`/`dvh` sits behind the keyboard the moment a textarea is focused. The
 * hook here publishes the visual viewport as `--vvh` and `--vv-top`, and the
 * stylesheet sizes the sheet and the search panel from those instead.
 *
 * `usePointerDrag` is the one drag implementation. Every earlier drag (the
 * pane divider, canvas pan, card drag, card resize) listened on `window` for
 * pointermove and pointerup and nothing else, so a browser-interrupted touch —
 * a pinch, an edge swipe, pull-to-refresh — fired `pointercancel`, which no one
 * heard, and left the gesture half-finished with `user-select: none` still on
 * the document. Capturing the pointer keeps the moves coming even when the
 * finger leaves the element, and cancel is treated exactly like up.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** Publish `--vvh` (visual viewport height) and `--vv-top` (its offset) on <html>. */
export function useVisualViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let frame = 0;

    const write = () => {
      frame = 0;
      root.style.setProperty('--vvh', `${Math.round(vv?.height ?? window.innerHeight)}px`);
      root.style.setProperty('--vv-top', `${Math.round(vv?.offsetTop ?? 0)}px`);
    };
    // One write per frame: the keyboard animates and fires resize every step.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    write();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
}

export interface DragHandlers<T extends Element> {
  /** Return `false` to ignore this press (a nested control, a card on the pan surface). */
  onStart?: (e: ReactPointerEvent<T>) => void | boolean;
  onMove: (e: ReactPointerEvent<T>) => void;
  onEnd?: (e: ReactPointerEvent<T>) => void;
}

export interface DragProps<T extends Element> {
  onPointerDown: (e: ReactPointerEvent<T>) => void;
  onPointerMove: (e: ReactPointerEvent<T>) => void;
  onPointerUp: (e: ReactPointerEvent<T>) => void;
  onPointerCancel: (e: ReactPointerEvent<T>) => void;
  onLostPointerCapture: (e: ReactPointerEvent<T>) => void;
}

/**
 * Props to spread onto the element a drag starts on.
 *
 * The helper adds nothing to the coordinates it passes through — no threshold,
 * no inertia, no rounding — so a pan of −200px measures exactly −200px, which
 * tests/reader/canvas.spec.ts asserts. Only one pointer drags at a time; a
 * second press while one is active is ignored (a pinch is the caller's to
 * detect from its own pointer bookkeeping).
 */
export function usePointerDrag<T extends Element>(handlers: DragHandlers<T>): DragProps<T> {
  const active = useRef<number | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;

  const end = useCallback((e: ReactPointerEvent<T>) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    document.body.classList.remove('dragging');
    latest.current.onEnd?.(e);
  }, []);

  return {
    onPointerDown: useCallback((e: ReactPointerEvent<T>) => {
      if (active.current !== null) return;
      if (latest.current.onStart?.(e) === false) return;
      active.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone (a cancelled touch); the up or cancel
        // that follows still ends the gesture through the guard above.
      }
      document.body.classList.add('dragging');
    }, []),
    onPointerMove: useCallback((e: ReactPointerEvent<T>) => {
      if (active.current !== e.pointerId) return;
      latest.current.onMove(e);
    }, []),
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}
