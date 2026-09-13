import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_GLYPHS,
  colorLabel,
  type ColorLabels,
  type HighlightColor,
} from '../lib/notes';
import { useRovingTabIndex } from '../lib/focus';
import { prefersReducedMotion } from '../lib/prefs';

interface VerseActionsProps {
  /** "John 1:2", for the group's name. */
  reference: string;
  verse: number;
  /** The collection the verse is in now, if any. */
  current?: HighlightColor;
  labels: ColorLabels;
  /** Opened from the verse number — move focus in. Opened by tapping the text — leave it. */
  focusOnOpen: boolean;
  onHighlight: (color: HighlightColor) => void;
  onQuote: () => void;
  onLink: () => void;
  onSendToCanvas?: () => void;
  onClose: () => void;
}

/**
 * What can be done with a verse: mark it into a collection, quote it, link it,
 * put it on a board.
 *
 * Every control is at least 44 × 44 CSS px (2.5.5) — the row used to be five
 * 17px circles and three 17px-tall words. Each swatch is named for the
 * collection it adds to ("Mark as Covenant promises (amber)"), not for its
 * shade, so the choice does not depend on seeing the colour (1.4.1). The row
 * is one Tab stop with arrow keys between its controls (4.1.2), focus moves
 * into it when it was opened from the verse number, and BiblePane returns
 * focus to that number when it closes (2.4.3).
 *
 * On a wide layout it opens centred beneath the verse, as it always has. On a
 * phone the stylesheet docks it above the notes sheet, where a thumb reaches
 * it and where it does not push the rest of the chapter down the screen. It
 * stays inside the verse in the DOM either way, so focus order and "a press
 * outside closes it" are the same in both layouts; when docked it publishes
 * its height so the pane can keep the verse above it.
 */
export function VerseActions({
  reference,
  verse,
  current,
  labels,
  focusOnOpen,
  onHighlight,
  onQuote,
  onLink,
  onSendToCanvas,
  onClose,
}: VerseActionsProps) {
  const group = useRef<HTMLSpanElement>(null);

  // Roving first, so the tab stop exists before focus lands on it.
  useRovingTabIndex(group, { orientation: 'horizontal' });

  useEffect(() => {
    if (!focusOnOpen) return;
    group.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  // Docked (position: fixed, on a phone): tell the pane how tall the bar is and
  // bring the verse up above it. Inline, the verse is already where the reader
  // was looking and nothing should move.
  useLayoutEffect(() => {
    const el = group.current;
    if (!el || getComputedStyle(el).position !== 'fixed') return;
    const root = document.documentElement;
    const write = () => root.style.setProperty('--actions-h', `${el.offsetHeight}px`);
    write();
    const observer = new ResizeObserver(write);
    observer.observe(el);
    el.closest('.verse')?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    return () => {
      observer.disconnect();
      root.style.removeProperty('--actions-h');
    };
  }, []);

  return (
    <span
      className="swatches"
      role="group"
      aria-label={`Actions for ${reference}`}
      data-testid="verse-actions"
      ref={group}
      // A press inside the row is not a press on the verse, which toggles it.
      onClick={(e) => e.stopPropagation()}
    >
      <span className="swatches__set">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            data-color={color}
            data-testid={`swatch-${color}`}
            aria-label={`Mark as ${colorLabel(color, labels)} (${color})`}
            aria-pressed={current === color}
            onClick={() => onHighlight(color)}
          >
            <span className="swatch__disc" data-color={color} aria-hidden="true">
              <span className="swatch__glyph">{HIGHLIGHT_GLYPHS[color]}</span>
            </span>
          </button>
        ))}
      </span>
      <span className="swatches__rule" aria-hidden="true" />
      <span className="swatches__set">
        <button type="button" className="swatches__action" data-testid={`quote-${verse}`} onClick={onQuote}>
          Quote
        </button>
        <button type="button" className="swatches__action" data-testid={`link-${verse}`} onClick={onLink}>
          Link
        </button>
        {onSendToCanvas && (
          <button
            type="button"
            className="swatches__action"
            data-testid={`canvas-${verse}`}
            aria-label="Canvas — put this verse on the board"
            onClick={onSendToCanvas}
          >
            Canvas
          </button>
        )}
        <button
          type="button"
          className="swatches__action swatches__close"
          data-testid="verse-actions-close"
          aria-label={`Close actions for ${reference}`}
          onClick={onClose}
        >
          ✕
        </button>
      </span>
    </span>
  );
}
