import { useState } from 'react';
import type { SearchResult } from '@scriptura/core/types';
import { startsWeakMatches, type MatchOptions, type ResolvedReference } from '../lib/search';

interface SearchBarProps {
  query: string;
  results: SearchResult[];
  reference: ResolvedReference | null;
  total: number;
  options: MatchOptions;
  onOptions: (next: MatchOptions) => void;
  onQuery: (q: string) => void;
  onGo: (bookSlug: string, chapter: number, verse?: number) => void;
  onInsert: (result: SearchResult) => void;
  onClose: () => void;
  /** Opens the full results view, which can walk the whole match set. */
  onSeeAll: () => void;
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
  options,
  onOptions,
  onQuery,
  onGo,
  onInsert,
  onClose,
  onSeeAll,
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

          {/* Kept out of the grammar on purpose: `-word` and `"phrase"` are
              things you type, but a reader who does not know what "whole word"
              means will never discover a syntax for it. */}
          <div className="search__options" onMouseDown={(e) => e.preventDefault()}>
            <label className="search__option">
              <input
                type="checkbox"
                data-testid="search-whole-word"
                checked={options.mode === 'word'}
                onChange={(e) => onOptions({ ...options, mode: e.target.checked ? 'word' : 'substring' })}
              />
              Whole words only
            </label>
            <label className="search__option">
              <input
                type="checkbox"
                data-testid="search-match-case"
                checked={!!options.caseSensitive}
                onChange={(e) => onOptions({ ...options, caseSensitive: e.target.checked })}
              />
              Match case
            </label>
          </div>

          <p className="search__count" data-testid="search-count">
            {total === 0
              ? 'No matches'
              : `${total} match${total === 1 ? '' : 'es'}${
                  results.length < total ? ` — showing ${results.length}` : ''
                }`}
            {/* The dropdown is for jumping to a verse. Anything past the first
                few dozen needs somewhere with room to walk them. */}
            {results.length < total && (
              <>
                {' · '}
                <button
                  type="button"
                  className="search__see-all"
                  data-testid="search-see-all"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSeeAll();
                    setFocused(false);
                  }}
                >
                  See all {total}
                </button>
              </>
            )}
          </p>

          <ul className="search__results">
            {results.map((r, i) => (
              <li key={`${r.book_slug}-${r.chapter}-${r.verse}`} className="search__result">
                {/* A short query never reaches the full results view — all 17
                    matches for `Tito` fit here — so the rule has to be drawn
                    here too, or the ranking looks like no ranking at all. */}
                {startsWeakMatches(results[i - 1], r) && (
                  <p className="search__divider" data-testid="search-divider">
                    Below: inside a longer word
                  </p>
                )}
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
