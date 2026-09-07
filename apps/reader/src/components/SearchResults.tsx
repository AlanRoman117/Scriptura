import { useMemo, useState } from 'react';
import type { Bible, SearchResult } from '@scriptura/core/types';

interface SearchResultsProps {
  bible: Bible;
  query: string;
  /** Every match, not a page of them. */
  results: SearchResult[];
  onGo: (bookSlug: string, chapter: number, verse: number) => void;
  onInsert: (result: SearchResult) => void;
  onClose: () => void;
}

/** How many rows to add at a time. */
const PAGE = 100;

/**
 * Every match, and where they fall.
 *
 * The dropdown answers "take me to a verse"; this answers "how often does this
 * word occur, and where" — which the dropdown could not, because it showed the
 * first forty of a number it had no way to walk. *Jesus* is roughly 900 verses
 * and *the* is tens of thousands, so the list grows on request rather than
 * rendering everything: 28,000 rows of DOM is a hung tab, and pretending
 * otherwise is how a reading app becomes unusable on the one query that matters.
 *
 * The per-book breakdown is the more useful answer to a counting question
 * anyway — "Matthew 152, Mark 82" says something a flat list of 900 does not —
 * and doubles as the filter.
 */
export function SearchResults({
  bible,
  query,
  results,
  onGo,
  onInsert,
  onClose,
}: SearchResultsProps) {
  const [book, setBook] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const books = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) counts.set(r.book_slug, (counts.get(r.book_slug) ?? 0) + 1);

    return [...counts.entries()]
      .map(([slug, count]) => {
        const found = bible.book(slug);
        return { slug, count, name: found?.name ?? slug, order: found?.number ?? 0 };
      })
      .sort((a, b) => a.order - b.order);
  }, [bible, results]);

  const filtered = useMemo(
    () => (book ? results.filter((r) => r.book_slug === book) : results),
    [results, book]
  );

  const visible = filtered.slice(0, shown);

  const choose = (slug: string | null) => {
    setBook(slug);
    setShown(PAGE);
  };

  return (
    <section className="results" data-testid="search-results" aria-label="Search results">
      <header className="results__bar">
        <h2 className="results__title">
          <span data-testid="results-total">{results.length}</span>{' '}
          {results.length === 1 ? 'match' : 'matches'} for “{query}”
        </h2>
        <button
          type="button"
          className="results__close"
          data-testid="results-close"
          onClick={onClose}
          aria-label="Close search results"
        >
          ✕
        </button>
      </header>

      <div className="results__books" data-testid="results-books">
        <button
          type="button"
          className="results__book"
          aria-pressed={book === null}
          onClick={() => choose(null)}
        >
          All books <span className="results__book-count">{results.length}</span>
        </button>
        {books.map((b) => (
          <button
            type="button"
            className="results__book"
            key={b.slug}
            data-testid={`results-book-${b.slug}`}
            aria-pressed={book === b.slug}
            onClick={() => choose(book === b.slug ? null : b.slug)}
          >
            {b.name} <span className="results__book-count">{b.count}</span>
          </button>
        ))}
      </div>

      <ul className="results__list" data-testid="results-list">
        {visible.map((r) => (
          <li className="results__item" key={`${r.book_slug}-${r.chapter}-${r.verse}`}>
            <button
              type="button"
              className="results__ref"
              data-testid={`results-go-${r.book_slug}-${r.chapter}-${r.verse}`}
              onClick={() => onGo(r.book_slug, r.chapter, r.verse)}
            >
              <span className="results__ref-label">{r.ref}</span>
              <span className="results__ref-text">{r.text}</span>
            </button>
            <button
              type="button"
              className="results__insert"
              data-testid={`results-insert-${r.book_slug}-${r.chapter}-${r.verse}`}
              title="Quote into the open note"
              aria-label={`Quote ${r.ref} into the open note`}
              onClick={() => onInsert(r)}
            >
              +
            </button>
          </li>
        ))}
      </ul>

      <p className="results__footer">
        {/* Says what is on screen against what exists, so "showing 100" is
            never mistaken for "there are 100". */}
        Showing {visible.length} of {filtered.length}
        {book ? ` in ${books.find((b) => b.slug === book)?.name}` : ''}
        {visible.length < filtered.length && (
          <>
            {' · '}
            <button
              type="button"
              className="results__more"
              data-testid="results-more"
              onClick={() => setShown((n) => n + PAGE)}
            >
              Show {Math.min(PAGE, filtered.length - visible.length)} more
            </button>
          </>
        )}
      </p>
    </section>
  );
}
