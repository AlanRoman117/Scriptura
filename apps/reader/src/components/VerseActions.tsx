import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_GLYPHS,
  colorLabel,
  type ColorLabels,
  type HighlightColor,
} from '../lib/notes';
import type { SwatchState } from '../lib/selection';
import { useRovingTabIndex } from '../lib/focus';
import { prefersReducedMotion } from '../lib/prefs';
import { useI18n } from '../i18n';

interface VerseActionsProps {
  /** "John 1:2", or "John 1:3-5", or "John 1:1, 14": what the row will act on. */
  reference: string;
  /** The book's name as the reference writes it, and the language it is in: the Bible's. */
  book: { name: string; lang: string };
  /** How many verses are selected. */
  count: number;
  /** The verse the row hangs under; its number is the suffix of the row's test ids. */
  verse: number;
  /** For each collection: whether all the selected verses are in it, some, or none. */
  states: Record<HighlightColor, SwatchState>;
  labels: ColorLabels;
  /** Opened from the verse number — move focus in. Opened by tapping the text — leave it. */
  focusOnOpen: boolean;
  /**
   * The verses between the first and the last selected, when some are left
   * out: its words ("Select 3-18") and what pressing it does.
   */
  fill?: { label: string; onFill: () => void };
  /** The row's own element, for the dismiss stack. */
  rowRef: RefObject<HTMLDivElement | null>;
  onHighlight: (color: HighlightColor) => void;
  onQuote: () => void;
  onLink: () => void;
  onSendToCanvas?: () => void;
  onClose: () => void;
}

/**
 * What can be done with the selected verses: mark them into a collection,
 * quote them, link them, put them on a board.
 *
 * Every control is at least 44 × 44 CSS px (2.5.5) — the row used to be five
 * 17px circles and three 17px-tall words. Each swatch is named for the
 * collection it adds to ("Mark as Covenant promises (amber)"), not for its
 * shade, so the choice does not depend on seeing the colour (1.4.1). The row
 * is one Tab stop with arrow keys between its controls (4.1.2), focus moves
 * into it when it was opened from a verse number, and BiblePane returns focus
 * to that number when it closes (2.4.3).
 *
 * One row for the whole selection. With several verses it says so in words —
 * "3 verses · John 1:3-5" — because a row that will quote or mark five verses
 * must not look like one that will act on one: a press adds a verse, and a
 * reader who pressed a second one meaning to move the row has a group they
 * did not ask for. A swatch is pressed when every selected verse is in its
 * collection and `mixed` when only some are.
 *
 * On a wide layout it opens centred beneath its verse, as it always has, and
 * with several verses selected it sticks to the edge of the pane as the
 * chapter scrolls, so the button that fills a range is on screen at the far
 * end of it. On a phone the stylesheet docks it above the notes sheet, where
 * a thumb reaches it and where it does not push the rest of the chapter down
 * the screen. It follows its verse in the DOM either way, so focus order is
 * the same in both layouts; it publishes its height so the pane can keep a
 * verse clear of it.
 */
export function VerseActions({
  reference,
  book,
  count,
  verse,
  states,
  labels,
  focusOnOpen,
  fill,
  rowRef,
  onHighlight,
  onQuote,
  onLink,
  onSendToCanvas,
  onClose,
}: VerseActionsProps) {
  const { t } = useI18n();
  const group = rowRef;
  const many = count > 1;
  // The book's name is the Bible's word, in its language (3.1.2), inside a
  // sentence in the interface's: "3 verses · 约翰福音 1:3-5".
  const summary = t.verseActions.summary(count, reference);
  const nameAt = summary.indexOf(book.name);

  // Roving first, so the tab stop exists before focus lands on it.
  useRovingTabIndex(group, { orientation: 'horizontal' });

  // Once per mount: BiblePane keys the row by the verse it hangs under, so a
  // verse added from its number brings a new row, and focus into it.
  const focusNow = useRef(focusOnOpen);
  useEffect(() => {
    if (!focusNow.current) return;
    group.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [group]);

  // Tell the pane how tall the row is: docked on a phone, or stuck to the
  // pane's edge beside the Bible, it covers text, and a verse focused from the
  // keyboard has to come to rest clear of it (2.4.11).
  useLayoutEffect(() => {
    const el = group.current;
    if (!el) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty('--actions-h', heightOf(el));
    write();
    // For what changes the row without drawing it again: the pane's width.
    const observer = new ResizeObserver(write);
    observer.observe(el);
    // Docked (position: fixed, on a phone): bring the verse up above the bar.
    // Inline, the verse is already where the reader was looking and nothing
    // should move.
    if (getComputedStyle(el).position === 'fixed') {
      el.previousElementSibling?.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
    return () => {
      observer.disconnect();
      root.style.removeProperty('--actions-h');
    };
  }, [group]);

  // ⚠️ And after every drawing of the row, in the same frame. An observer is
  // told at the browser's next rendering opportunity, which is not promised
  // before the reader's next key: a second verse made the row a group, twice
  // as tall, and Tab came before the news of it. The pane still kept clear
  // the height of a one-verse row, and the focused verse came to rest under
  // the group's (macOS CI, where the opportunity came 300ms later).
  useLayoutEffect(() => {
    const el = group.current;
    if (el) document.documentElement.style.setProperty('--actions-h', heightOf(el));
  });

  return (
    <div
      className="swatches"
      role="group"
      aria-label={many ? t.verseActions.groupMany(count, reference) : t.verseActions.group(reference)}
      data-testid="verse-actions"
      data-many={many || undefined}
      ref={group}
    >
      {/* What the row will act on, in words, once it is more than one verse —
          and beside it the way to a long passage without a press per verse, a
          drag or a modifier key (2.5.1, 2.5.7): the first verse, the last,
          and this. The line keeps one height whether the button is there or
          not, so the page under the row moves once, when a second verse makes
          it a group, and not again as gaps open and are filled. */}
      {many && (
        <span className="swatches__head">
          <span className="swatches__summary" data-testid="verse-summary">
            {nameAt === -1 ? (
              summary
            ) : (
              <>
                {summary.slice(0, nameAt)}
                <span lang={book.lang}>{book.name}</span>
                {summary.slice(nameAt + book.name.length)}
              </>
            )}
          </span>
          {fill && (
            <button type="button" className="swatches__action swatches__fill" data-testid="verse-fill" onClick={fill.onFill}>
              {fill.label}
            </button>
          )}
        </span>
      )}
      <span className="swatches__set">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            data-color={color}
            data-testid={`swatch-${color}`}
            aria-label={t.verseActions.mark(colorLabel(color, labels, t.colours), t.colourWords[color])}
            aria-pressed={states[color] === 'all' ? true : states[color] === 'some' ? 'mixed' : false}
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
          {t.verseActions.quote}
        </button>
        <button type="button" className="swatches__action" data-testid={`link-${verse}`} onClick={onLink}>
          {t.verseActions.link}
        </button>
        {onSendToCanvas && (
          <button
            type="button"
            className="swatches__action"
            data-testid={`canvas-${verse}`}
            aria-label={many ? t.verseActions.canvasNameMany : t.verseActions.canvasName}
            onClick={onSendToCanvas}
          >
            {t.verseActions.canvas}
          </button>
        )}
        <button
          type="button"
          className="swatches__action swatches__close"
          data-testid="verse-actions-close"
          aria-label={many ? t.verseActions.clear : t.verseActions.close(reference)}
          onClick={onClose}
        >
          ✕
        </button>
      </span>
    </div>
  );
}

/** The row's height, rounded up: a fraction of a pixel under it is still under it. */
const heightOf = (el: HTMLElement): string => `${Math.ceil(el.getBoundingClientRect().height)}px`;
