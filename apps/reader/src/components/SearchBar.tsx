import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, FormEvent } from 'react';
import type { SearchResult } from '@scriptura/core/types';
import { startsWeakMatches, type MatchOptions, type ResolvedReference } from '../lib/search';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { useI18n } from '../i18n';

interface SearchBarProps {
  query: string;
  /** The translation's language, for the verse text in the suggestions (3.1.2). */
  lang?: string;
  /** A reference the open translation resolves, for the placeholder: "Juan 3:16" in RV1909. */
  example?: string;
  results: SearchResult[];
  reference: ResolvedReference | null;
  total: number;
  /** The query `results` and `total` were computed for; see App. */
  resultsFor: string;
  options: MatchOptions;
  onOptions: (next: MatchOptions) => void;
  onQuery: (q: string) => void;
  onGo: (bookSlug: string, chapter: number, verse?: number) => void;
  onInsert: (result: SearchResult) => void;
  /** Opens the full results view, which can walk the whole match set. */
  onSeeAll: () => void;
}

/**
 * One box for finding things: a reference jumps, anything else searches.
 *
 * This is where the verse dropdown went. `John 3:16`, `Juan 3:16`, `jn 3` and
 * `43 3:16` all resolve, plus ranges — one control doing what three dropdowns
 * would, and without crowding a bar that is already tight on a narrow pane.
 *
 * It is a search form. Enter submits: a resolved reference is opened, and any
 * other text opens the full results view — which is also how a phone gets the
 * results out from under the keyboard. The suggestions stay open while the
 * query is non-empty until the reader dismisses them (Escape, a press outside,
 * choosing a result, the close button), never because focus moved. They used
 * to close 150ms after the input blurred, which made them unreachable by Tab
 * and turned every control in them into a mouse-only target (2.1.1).
 *
 * ⚠️ No popup ARIA on the input. `aria-expanded`, `aria-haspopup` and
 * `aria-controls` are not permitted on a searchbox and axe fails the page for
 * them; the panel is an in-flow region reached by Tab or Down arrow instead.
 */
export function SearchBar({
  query,
  lang,
  example = 'John 3:16',
  results,
  reference,
  total,
  resultsFor,
  options,
  onOptions,
  onQuery,
  onGo,
  onInsert,
  onSeeAll,
}: SearchBarProps) {
  const { t } = useI18n();
  // Dismissed by the reader, until the next keystroke. Typing reopens: Enter
  // closes the panel to clear the way for the passage, but the input keeps
  // focus, so without this a second reference typed would show nothing.
  const [dismissed, setDismissed] = useState(false);
  const open = query.trim().length > 0 && !dismissed;
  const root = useRef<HTMLFormElement>(null);
  const panel = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const wordHint = useId();
  const caseHint = useId();

  const dismiss = () => setDismissed(true);

  // Escape and a press outside close the suggestions — through the shared
  // stack, so only them if the verse actions opened later are on top. Focus
  // returns to the input if it was inside the panel when it closed.
  useDismissable(open, dismiss, root);
  useReturnFocus(open);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (reference) {
      onGo(reference.book_slug, reference.chapter, reference.verse);
      dismiss();
    } else if (query.trim()) {
      onSeeAll();
      dismiss();
    }
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      panel.current?.querySelector<HTMLElement>('button, input')?.focus();
    }
  };

  return (
    <form className="search" data-testid="search" role="search" ref={root} onSubmit={submit}>
      <input
        ref={input}
        className="search__input"
        data-testid="search-input"
        type="search"
        aria-label={t.search.label}
        aria-describedby={hintId}
        placeholder={t.search.placeholder(example)}
        value={query}
        onChange={(e) => {
          onQuery(e.target.value);
          setDismissed(false);
        }}
        onKeyDown={onInputKey}
      />
      <span id={hintId} className="visually-hidden">
        {t.search.hint}
      </span>

      {open && (
        <section className="search__panel" data-testid="search-panel" ref={panel} aria-label={t.search.suggestions}>
          <div className="search__panel-bar">
            {reference && (
              <button
                type="button"
                className="search__jump"
                data-testid="search-jump"
                onClick={() => {
                  onGo(reference.book_slug, reference.chapter, reference.verse);
                  dismiss();
                }}
              >
                {t.search.goTo(
                  `${reference.book} ${reference.chapter}${reference.verse !== undefined ? `:${reference.verse}` : ''}`
                )}
              </button>
            )}
            <button
              type="button"
              className="search__close"
              data-testid="search-close"
              aria-label={t.search.close}
              onClick={() => {
                dismiss();
                input.current?.focus();
              }}
            >
              ✕
            </button>
          </div>

          {/* Kept out of the grammar on purpose: `-word` and `"phrase"` are
              things you type, but a reader who does not know what "whole word"
              means will never discover a syntax for it. Enter on a checkbox
              would submit the form in Chromium, so it is swallowed here. */}
          <fieldset
            className="search__options"
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          >
            <legend className="visually-hidden">{t.search.matching}</legend>
            <label className="search__option">
              <input
                type="checkbox"
                data-testid="search-whole-word"
                aria-describedby={wordHint}
                checked={options.mode === 'word'}
                onChange={(e) => onOptions({ ...options, mode: e.target.checked ? 'word' : 'substring' })}
              />
              {t.search.wholeWords}
              <span id={wordHint} className="visually-hidden">
                {t.search.wholeWordsHint}
              </span>
            </label>
            <label className="search__option">
              <input
                type="checkbox"
                data-testid="search-match-case"
                aria-describedby={caseHint}
                checked={!!options.caseSensitive}
                onChange={(e) => onOptions({ ...options, caseSensitive: e.target.checked })}
              />
              {t.search.matchCase}
              <span id={caseHint} className="visually-hidden">
                {t.search.matchCaseHint}
              </span>
            </label>
          </fieldset>

          <p className="search__count" data-testid="search-count" data-query={resultsFor}>
            {total === 0
              ? t.search.noMatches
              : `${t.search.matches(total)}${results.length < total ? t.search.showing(results.length) : ''}`}
            {/* The dropdown is for jumping to a verse. Anything past the first
                few dozen needs somewhere with room to walk them. */}
            {results.length < total && (
              <>
                {' · '}
                <button
                  type="button"
                  className="search__see-all"
                  data-testid="search-see-all"
                  onClick={() => {
                    onSeeAll();
                    dismiss();
                  }}
                >
                  {t.search.seeAll(total)}
                </button>
              </>
            )}
          </p>

          <ul className="search__results" role="list">
            {results.map((r, i) => (
              <li key={`${r.book_slug}-${r.chapter}-${r.verse}`} className="search__result">
                {/* A short query never reaches the full results view — all 17
                    matches for `Tito` fit here — so the rule has to be drawn
                    here too, or the ranking looks like no ranking at all. */}
                {startsWeakMatches(results[i - 1], r) && (
                  <p className="search__divider" data-testid="search-divider">
                    {t.search.weakBelow}
                  </p>
                )}
                <button
                  type="button"
                  className="search__ref"
                  data-testid={`search-result-${r.book_slug}-${r.chapter}-${r.verse}`}
                  onClick={() => {
                    onGo(r.book_slug, r.chapter, r.verse);
                    dismiss();
                  }}
                >
                  <span className="search__result-ref">{r.ref}</span>
                  <span className="search__result-text" lang={lang}>
                    {r.text}
                  </span>
                </button>
                <button
                  type="button"
                  className="search__insert"
                  data-testid={`search-insert-${r.book_slug}-${r.chapter}-${r.verse}`}
                  aria-label={t.search.insert(r.ref)}
                  onClick={() => onInsert(r)}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
