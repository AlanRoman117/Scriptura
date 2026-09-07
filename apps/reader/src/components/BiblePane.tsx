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
}

export function BiblePane({
  bible,
  book,
  chapter,
  highlights,
  onNavigate,
  onHighlight,
}: BiblePaneProps) {
  const [openVerse, setOpenVerse] = useState<number | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [stuck, setStuck] = useState(false);

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
      </header>

      <article className="chapter" data-testid="chapter">
        <h1 className="chapter__title" ref={title} data-stuck={stuck} data-testid="chapter-title">
          {book.name} {chapter}
        </h1>
        {current ? (
          <div className="chapter__text">
            {current.verses.map((v) => {
              const id = highlightId({
                translation: meta.id,
                book_slug: book.slug,
                chapter,
                verse: v.number,
              });
              const mark = highlights.find((h) => h.id === id);
              return (
                <p
                  className="verse"
                  key={v.number}
                  data-verse={v.number}
                  data-highlight={mark?.color ?? undefined}
                >
                  {/* aria-hidden so a screen reader reads scripture as prose
                      rather than interleaving every verse number into the
                      sentence. The button beside it carries the real label. */}
                  <sup className="verse__num" aria-hidden="true">
                    {v.number}
                  </sup>
                  <button
                    type="button"
                    className="verse__handle"
                    data-testid={`verse-${v.number}`}
                    aria-label={`Highlight ${book.name} ${chapter}:${v.number}`}
                    aria-expanded={openVerse === v.number}
                    onClick={() => setOpenVerse(openVerse === v.number ? null : v.number)}
                  />
                  <span className="verse__text">{v.text}</span>

                  {openVerse === v.number && (
                    <span className="swatches" role="group" aria-label="Highlight colour">
                      {HIGHLIGHT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="swatch"
                          data-color={color}
                          data-testid={`swatch-${color}`}
                          aria-label={color}
                          aria-pressed={mark?.color === color}
                          onClick={() => {
                            onHighlight(v.number, color);
                            setOpenVerse(null);
                          }}
                        />
                      ))}
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
