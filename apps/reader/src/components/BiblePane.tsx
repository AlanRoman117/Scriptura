import { useEffect, useRef, useState } from 'react';
import type { Bible, LoadedBook } from '@scriptura/core/types';
import { requiresAttribution } from '../lib/translation';
import { prefersReducedMotion } from '../lib/prefs';
import { useDismissable, useReturnFocus } from '../lib/focus';
import {
  HIGHLIGHT_COLORS,
  colorLabel,
  highlightId,
  type ColorLabels,
  type Highlight,
  type HighlightColor,
} from '../lib/notes';

interface BiblePaneProps {
  bible: Bible;
  book: LoadedBook;
  chapter: number;
  highlights: Highlight[];
  /** What the reader calls each colour; a mark's name says its collection. */
  labels?: ColorLabels;
  onNavigate: (bookSlug: string, chapter: number) => void;
  onHighlight: (verse: number, color: HighlightColor) => void;
  onQuote: (verse: number) => void;
  onLink: (verse: number) => void;
  onSendToCanvas?: (verse: number) => void;
  focusVerse?: number | null;
  search?: React.ReactNode;
  /** Marks or the library, rendered over the text while open. */
  overlay?: React.ReactNode;
  /** Side-by-side reading, rendered *instead of* the single-column chapter. */
  compare?: React.ReactNode;
  marksOpen?: boolean;
  markCount?: number;
  onToggleMarks?: () => void;
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  helpOpen?: boolean;
  onToggleHelp?: () => void;
}

export function BiblePane({
  bible,
  book,
  chapter,
  highlights,
  labels = {},
  onNavigate,
  onHighlight,
  onQuote,
  onLink,
  onSendToCanvas,
  focusVerse,
  search,
  overlay,
  compare,
  marksOpen = false,
  markCount = 0,
  onToggleMarks,
  libraryOpen = false,
  onToggleLibrary,
  settingsOpen = false,
  onToggleSettings,
  helpOpen = false,
  onToggleHelp,
}: BiblePaneProps) {
  const [openVerse, setOpenVerse] = useState<number | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  // The sticky offsets used to be constants (3.1rem for the bar, 2.9rem for
  // the search box). 44px controls and a text-size preference make both
  // wrong, so the heights are measured and written onto the scrolling pane,
  // where the stylesheet reads them for the sticky title, the search box and
  // the scroll padding that keeps a focused verse clear of them (2.4.11).
  //
  // `--pane-top` is where the pane starts in the viewport. Anything above it —
  // the durability notice, today — pushes the search suggestions down, and the
  // room they have above the software keyboard is measured from the top of
  // the screen, not from the top of the pane. The pane's own size changes when
  // that notice comes or goes, so observing the pane catches it.
  useEffect(() => {
    const node = reader.current;
    const barEl = bar.current;
    if (!node || !barEl) return;
    const target = node.closest<HTMLElement>('.pane') ?? node;
    const searchEl = node.querySelector<HTMLElement>('.search');
    const write = () => {
      target.style.setProperty('--bar-h', `${barEl.offsetHeight}px`);
      target.style.setProperty('--search-h', `${searchEl?.offsetHeight ?? 0}px`);
      target.style.setProperty('--pane-top', `${Math.max(0, Math.round(target.getBoundingClientRect().top))}px`);
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(barEl);
    observer.observe(target);
    if (searchEl) observer.observe(searchEl);
    window.addEventListener('resize', write);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', write);
    };
  }, [search]);
  /** The verse whose actions are open — the whole <p>, so a press on it is not "outside". */
  const openVerseEl = useRef<HTMLParagraphElement | null>(null);

  // Swatches left open on a verse you have navigated away from are stale.
  useEffect(() => setOpenVerse(null), [book.slug, chapter]);

  // Escape closes them — only them, if something opened later is on top — and
  // so does a press anywhere outside the verse. Focus goes back to the number
  // that opened them (2.4.3).
  useDismissable(openVerse !== null, () => setOpenVerse(null), openVerseEl, { ignore: '.verse' });
  useReturnFocus(openVerse !== null);

  useEffect(() => {
    if (focusVerse == null) return;
    const el = document.querySelector(`.verse[data-verse="${focusVerse}"]`);
    // The stylesheet cannot reach a scroll the script starts, so the motion
    // preference is asked here (2.3.3). The flash class stays: under reduced
    // motion the CSS draws it as a still outline rather than an animation.
    el?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    el?.classList.add('verse--flash');
    const t = window.setTimeout(() => el?.classList.remove('verse--flash'), 1600);
    return () => window.clearTimeout(t);
  }, [focusVerse, book.slug, chapter]);

  // A sticky element gives no signal that it is pinned, so detect it by
  // comparing the heading's position against where it parks. Only then does it
  // draw its rule — a permanent divider under an unpinned heading is noise.
  //
  // Deliberately not IntersectionObserver: `rootMargin` accepts px and % only,
  // so the `rem` offset this needs is not expressible there. (It throws on
  // construction, which takes the whole pane down with it.)
  useEffect(() => {
    const node = title.current;
    const scroller = node?.closest('.pane');
    if (!node || !scroller) return;

    const check = () => {
      const barHeight = parseFloat(getComputedStyle(node).top) || 0;
      const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      setStuck(top <= barHeight + 1);
    };

    check();
    scroller.addEventListener('scroll', check, { passive: true });
    return () => scroller.removeEventListener('scroll', check);
  }, [book.slug, chapter]);
  const current = book.chapters.find((c) => c.number === chapter);
  const meta = bible.meta;

  return (
    <div className="reader" ref={reader}>
      <header className="reader__bar" ref={bar}>
        {/* A landmark of its own: "where am I, and how do I move" is the first
            thing a screen reader user looks for (2.4.8). */}
        <nav className="reader__nav" aria-label="Passage">
          <select
            className="reader__select"
            aria-label="Book"
            data-testid="book-select"
            value={book.slug}
            onChange={(e) => onNavigate(e.target.value, 1)}
          >
            {bible.books.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="reader__select reader__select--chapter"
            aria-label="Chapter"
            data-testid="chapter-select"
            value={chapter}
            onChange={(e) => onNavigate(book.slug, Number(e.target.value))}
          >
            {book.chapters.map((c) => (
              <option key={c.number} value={c.number}>
                {c.number}
              </option>
            ))}
          </select>
        </nav>
        {/* The translation badge used to be decoration, and was the first thing
            dropped when the bar ran out of room. It is a control now — the way
            in to the library — so nothing here is dropped; only the Marks label
            is, and its count stands in for it. */}
        {/* Disclosures, not toggles: each opens a panel, so aria-expanded and
            aria-controls say so (4.1.2). The name starts with the visible text
            (2.5.3) and then says what the abbreviation stands for (3.1.4). */}
        <button
          type="button"
          className="reader__chip reader__chip--translation"
          data-testid="library-open"
          aria-expanded={libraryOpen}
          aria-controls="library-panel"
          aria-label={`${meta.id.toUpperCase()} — ${meta.name}. Choose or add a translation`}
          onClick={onToggleLibrary}
        >
          {meta.id.toUpperCase()}
        </button>
        <button
          type="button"
          className="reader__chip"
          data-testid="marks-open"
          aria-expanded={marksOpen}
          aria-controls="marks-panel"
          aria-label={`Marks (${markCount}) — verses you have marked, by colour`}
          onClick={onToggleMarks}
        >
          <span className="reader__chip-label">Marks</span>
          <span className="reader__chip-count" data-empty={markCount === 0 || undefined}>
            {markCount}
          </span>
        </button>
        <button
          type="button"
          className="reader__chip reader__chip--icon"
          data-testid="settings-open"
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
          aria-label="Settings — display, storage, export, and assistant access"
          onClick={onToggleSettings}
        >
          ⚙
        </button>
        {/* Help lives here in every state (3.2.6), last in the bar. */}
        <button
          type="button"
          className="reader__chip reader__chip--icon"
          data-testid="help-open"
          aria-expanded={helpOpen}
          aria-controls="help-panel"
          aria-label="Help — finding passages, searching, notes, marks, boards, keyboard, and what the abbreviations mean"
          onClick={onToggleHelp}
        >
          ?
        </button>
      </header>

      {search}

      {overlay}

      <article
        className={compare ? 'chapter chapter--compare' : 'chapter'}
        id="scripture"
        tabIndex={-1}
        data-testid="chapter"
        hidden={!!overlay}
      >
        <h1 className="chapter__title" ref={title} data-stuck={stuck} data-testid="chapter-title">
          {book.name} {chapter}
        </h1>
        {compare ? (
          compare
        ) : current ? (
          // The translation's language, so a screen reader switches voice for
          // Spanish, French or Japanese scripture instead of reading it with
          // English phonemes (3.1.2).
          <div className="chapter__text" lang={meta.language}>
            {current.verses.map((v) => {
              const id = highlightId({ book_slug: book.slug, chapter, verse: v.number });
              const mark = highlights.find((h) => h.id === id);
              const open = openVerse === v.number;
              return (
                <p
                  className="verse"
                  key={v.number}
                  ref={open ? openVerseEl : undefined}
                  data-verse={v.number}
                  data-highlight={mark?.color ?? undefined}
                  data-open={open || undefined}
                  // The whole verse is the target. Reaching for a control at
                  // the margin and then back out to the far end of the line is
                  // a lot of travel for what should be one quick act.
                  onClick={() => {
                    // …but a drag that selected text is not a click on the
                    // verse. Reading and copying must not trip the swatches.
                    if (!window.getSelection()?.isCollapsed) return;
                    setOpenVerse(open ? null : v.number);
                  }}
                >
                  {/* The verse number is the keyboard path to the same action.
                      Tabbing 176 verses of Psalm 119 is no worse than before —
                      but it is now a control that was already on the page,
                      rather than an invisible one hiding in the margin. */}
                  <button
                    type="button"
                    className="verse__num"
                    data-testid={`verse-${v.number}`}
                    // The collection is in the name, so which colour a verse
                    // is in does not depend on seeing the colour (1.4.1).
                    aria-label={
                      mark
                        ? `Mark ${book.name} ${chapter}:${v.number} — in ${colorLabel(mark.color, labels)} (${mark.color})`
                        : `Mark ${book.name} ${chapter}:${v.number}`
                    }
                    aria-expanded={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenVerse(open ? null : v.number);
                    }}
                  >
                    {v.number}
                  </button>
                  <span className="verse__text">{v.text}</span>

                  {open && (
                    <span
                      className="swatches"
                      role="group"
                      aria-label={`Actions for verse ${v.number}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {HIGHLIGHT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="swatch"
                          data-color={color}
                          data-testid={`swatch-${color}`}
                          aria-label={`Mark as ${colorLabel(color, labels)} (${color})`}
                          aria-pressed={mark?.color === color}
                          onClick={() => {
                            onHighlight(v.number, color);
                            setOpenVerse(null);
                          }}
                        />
                      ))}
                      <span className="swatches__rule" aria-hidden="true" />
                      <button
                        type="button"
                        className="swatches__action"
                        data-testid={`quote-${v.number}`}
                        title="Add to note"
                        onClick={() => {
                          onQuote(v.number);
                          setOpenVerse(null);
                        }}
                      >
                        Quote
                      </button>
                      <button
                        type="button"
                        className="swatches__action"
                        data-testid={`link-${v.number}`}
                        title="Insert a link into the note"
                        onClick={() => {
                          onLink(v.number);
                          setOpenVerse(null);
                        }}
                      >
                        Link
                      </button>
                      {onSendToCanvas && (
                        <button
                          type="button"
                          className="swatches__action"
                          data-testid={`canvas-${v.number}`}
                          title="Put this verse on the board"
                          onClick={() => {
                            onSendToCanvas(v.number);
                            setOpenVerse(null);
                          }}
                        >
                          Canvas
                        </button>
                      )}
                    </span>
                  )}
                </p>
              );
            })}
          </div>
        ) : (
          <p className="empty">This chapter is not in {meta.name}.</p>
        )}
      </article>

      {/* CC BY-SA obliges the notice where the material appears, so it sits with
          the text rather than in an About page. Public-domain texts show nothing. */}
      {requiresAttribution(meta) && (
        <footer className="attribution" data-testid="attribution">
          {meta.attribution} ·{' '}
          {/* The link's own text says whose source (2.4.9). */}
          <a href={meta.source_url} target="_blank" rel="noreferrer noopener">
            {meta.name} source
          </a>
        </footer>
      )}
    </div>
  );
}
