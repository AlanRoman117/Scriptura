import { useEffect, useRef, useState } from 'react';
import type { Bible, LoadedBook } from '@scriptura/core/types';
import { requiresAttribution } from '../lib/translation';
import { HIGHLIGHT_COLORS, highlightId, type Highlight, type HighlightColor } from '../lib/notes';

interface BiblePaneProps {
  bible: Bible;
  book: LoadedBook;
  chapter: number;
  highlights: Highlight[];
  onNavigate: (bookSlug: string, chapter: number) => void;
  onHighlight: (verse: number, color: HighlightColor) => void;
  onQuote: (verse: number) => void;
  onLink: (verse: number) => void;
  focusVerse?: number | null;
  search?: React.ReactNode;
  /** The collections view, rendered over the text when open. */
  marks?: React.ReactNode;
  marksOpen?: boolean;
  markCount?: number;
  onToggleMarks?: () => void;
}

export function BiblePane({
  bible,
  book,
  chapter,
  highlights,
  onNavigate,
  onHighlight,
  onQuote,
  onLink,
  focusVerse,
  search,
  marks,
  marksOpen = false,
  markCount = 0,
  onToggleMarks,
}: BiblePaneProps) {
  const [openVerse, setOpenVerse] = useState<number | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [stuck, setStuck] = useState(false);

  // Swatches left open on a verse you have navigated away from are stale.
  useEffect(() => setOpenVerse(null), [book.slug, chapter]);

  // Escape closes them, like any other transient surface.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenVerse(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (focusVerse == null) return;
    const el = document.querySelector(`.verse[data-verse="${focusVerse}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    <div className="reader">
      <header className="reader__bar">
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
        <span className="reader__translation" title={meta.name}>
          {meta.id.toUpperCase()}
        </span>
        <button
          type="button"
          className="reader__marks"
          data-testid="marks-open"
          aria-pressed={marksOpen}
          title="Verses you have marked, by colour"
          onClick={onToggleMarks}
        >
          Marks
          {markCount > 0 && <span className="reader__marks-count">{markCount}</span>}
        </button>
      </header>

      {search}

      {marksOpen && marks}

      <article className="chapter" data-testid="chapter" hidden={marksOpen}>
        <h1 className="chapter__title" ref={title} data-stuck={stuck} data-testid="chapter-title">
          {book.name} {chapter}
        </h1>
        {current ? (
          <div className="chapter__text">
            {current.verses.map((v) => {
              const id = highlightId({ book_slug: book.slug, chapter, verse: v.number });
              const mark = highlights.find((h) => h.id === id);
              const open = openVerse === v.number;
              return (
                <p
                  className="verse"
                  key={v.number}
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
                    aria-label={`Mark ${book.name} ${chapter}:${v.number}`}
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
                          aria-label={`Highlight ${color}`}
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
          <a href={meta.source_url} target="_blank" rel="noreferrer noopener">
            source
          </a>
        </footer>
      )}
    </div>
  );
}
