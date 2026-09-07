import { useState } from 'react';
import type { SearchResult } from '@scriptura/core/types';
import type { ResolvedReference } from '../lib/search';

interface SearchBarProps {
  query: string;
  results: SearchResult[];
  reference: ResolvedReference | null;
  total: number;
  onQuery: (q: string) => void;
  onGo: (bookSlug: string, chapter: number, verse?: number) => void;
  onInsert: (result: SearchResult) => void;
  onClose: () => void;
}

/**
 * One box for finding things: a reference jumps, anything else searches.
 *
 * This is where the verse dropdown went. `John 3:16`, `Juan 3:16`, `jn 3` and
 * `43 3:16` all resolve, plus ranges — one control doing what three dropdowns
 * would, and without crowding a bar that is already tight on a narrow pane.
 */
export function SearchBar({
  query,
  results,
  reference,
  total,
  onQuery,
  onGo,
  onInsert,
  onClose,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const open = focused && query.trim().length > 0;

  return (
    <div className="search" data-testid="search">
      <input
        className="search__input"
        data-testid="search-input"
        type="search"
        aria-label="Search or go to a reference"
        placeholder='Search, or go to "John 3:16"'
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        // Delayed so a click on a result lands before the panel closes.
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onQuery('');
            onClose();
          }
          if (e.key === 'Enter' && reference) {
            onGo(reference.book_slug, reference.chapter, reference.verse);
            setFocused(false);
          }
        }}
      />

      {open && (
        <div className="search__panel" data-testid="search-panel">
          {reference && (
            <button
              type="button"
              className="search__jump"
              data-testid="search-jump"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onGo(reference.book_slug, reference.chapter, reference.verse);
                setFocused(false);
              }}
            >
              Go to {reference.book} {reference.chapter}
              {reference.verse !== undefined ? `:${reference.verse}` : ''}
            </button>
          )}

          <p className="search__count" data-testid="search-count">
            {total === 0
              ? 'No matches'
              : `${total} match${total === 1 ? '' : 'es'}${
                  results.length < total ? ` — showing ${results.length}` : ''
                }`}
          </p>

          <ul className="search__results">
            {results.map((r) => (
              <li key={`${r.book_slug}-${r.chapter}-${r.verse}`} className="search__result">
                <button
                  type="button"
                  className="search__ref"
                  data-testid={`search-result-${r.book_slug}-${r.chapter}-${r.verse}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onGo(r.book_slug, r.chapter, r.verse);
                    setFocused(false);
                  }}
                >
                  <span className="search__result-ref">{r.ref}</span>
                  <span className="search__result-text">{r.text}</span>
                </button>
                <button
                  type="button"
                  className="search__insert"
                  data-testid={`search-insert-${r.book_slug}-${r.chapter}-${r.verse}`}
                  title="Insert into the open note"
                  aria-label={`Insert ${r.ref} into the open note`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInsert(r)}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
