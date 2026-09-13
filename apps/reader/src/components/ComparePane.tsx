import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { alignChapters, compareChapterOf } from '@scriptura/compare/chapters';
import type { Bible } from '@scriptura/core/types';
import { requiresAttribution } from '../lib/translation';

interface ComparePaneProps {
  /** The active translation first, then each comparison, in the order chosen. */
  bibles: Bible[];
  bookSlug: string;
  chapter: number;
  onDrop: (id: string) => void;
  onQuote: (translationId: string, verse: number) => void;
}

/**
 * One chapter, side by side.
 *
 * The comparison itself is `@scriptura/compare/chapters` — the server's own
 * implementation, running here against the translations in IndexedDB, so an
 * offline comparison is the same computation as `/compare/chapter` rather than
 * a second one that drifts.
 *
 * ⚠️ Rows align on the **verse number**, never the array index: critical-text
 * translations legitimately omit verses (Acts 8:37 is the standard case), and
 * index alignment would silently show different verses beside each other from
 * the omission onward — the exact failure a comparison exists to prevent.
 *
 * Below 40rem of its own width — a phone, or a pane dragged narrow — the same
 * rows are read as a list: each verse, then each translation's words under its
 * name. A table there scrolled sideways, which on a phone means reading one
 * column at a time with a thumb and losing the verse number off the left edge
 * (1.4.10). Measured on the pane rather than the window, because the split
 * layout can make a narrow pane on a wide screen.
 */
const STACK_BELOW = 640;
export function ComparePane({ bibles, bookSlug, chapter, onDrop, onQuote }: ComparePaneProps) {
  const { columns, rows } = useMemo(() => {
    const comparisons = compareChapterOf(bibles, bookSlug, chapter);
    return { columns: comparisons, rows: alignChapters(comparisons) };
  }, [bibles, bookSlug, chapter]);

  const owed = bibles.filter((b) => requiresAttribution(b.meta));
  /** Each column is read in its own language (3.1.2). */
  const languageOf = (translation: string) =>
    bibles.find((b) => b.meta.id === translation)?.meta.language;
  const nameOf = (translation: string) =>
    bibles.find((b) => b.meta.id === translation)?.meta.name ?? translation.toUpperCase();

  const root = useRef<HTMLElement>(null);
  const [stacked, setStacked] = useState(false);
  // Before paint, so a phone never flashes the table first.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setStacked(el.getBoundingClientRect().width < STACK_BELOW);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="compare" ref={root} data-testid="compare" data-layout={stacked ? 'stack' : 'table'} aria-label="Translations side by side">
      {stacked ? (
        <>
          <div className="compare__bar" role="group" aria-label="Translations compared">
            {columns.map((c, i) => (
              <span key={c.translation} className="compare__chip">
                <span aria-hidden="true">{c.translation.toUpperCase()}</span>
                <span className="visually-hidden">{nameOf(c.translation)}</span>
                {i > 0 && (
                  <button
                    type="button"
                    className="compare__drop compare__drop--inline"
                    data-testid={`compare-drop-${c.translation}`}
                    aria-label={`Stop comparing ${c.translation.toUpperCase()}`}
                    onClick={() => onDrop(c.translation)}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          <ol className="compare__stack" data-testid="compare-stack" role="list">
            {rows.map((row) => (
              <li key={row.number} className="compare__verse" data-verse={row.number}>
                <span className="compare__num">
                  <span className="visually-hidden">Verse </span>
                  {row.number}
                </span>
                <dl className="compare__readings">
                  {row.cells.map((text, i) => {
                    const id = columns[i].translation;
                    return (
                      <div key={id} className="compare__reading">
                        <dt className="compare__reading-id">
                          <span aria-hidden="true">{id.toUpperCase()}</span>
                          <span className="visually-hidden">{nameOf(id)}</span>
                        </dt>
                        {text === null ? (
                          <dd className="compare__absent" lang="en">
                            Not in {id.toUpperCase()}
                          </dd>
                        ) : (
                          <dd className="compare__reading-text">
                            <span className="compare__text" lang={languageOf(id)}>
                              {text}
                            </span>
                            <button
                              type="button"
                              className="compare__quote"
                              data-testid={`compare-quote-${id}-${row.number}`}
                              aria-label={`Quote ${id.toUpperCase()} verse ${row.number}`}
                              onClick={() => onQuote(id, row.number)}
                            >
                              +
                            </button>
                          </dd>
                        )}
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ol>
        </>
      ) : (
      <div className="compare__scroll">
        <table className="compare__table">
          <thead>
            <tr>
              <th scope="col" className="compare__num-head">
                <span className="visually-hidden">Verse</span>
              </th>
              {columns.map((c, i) => (
                <th scope="col" key={c.translation} className="compare__head">
                  <span className="compare__head-name">{c.book ?? bookSlug}</span>
                  <span className="compare__head-id">{c.translation.toUpperCase()}</span>
                  {/* The first column is what you are reading; dropping it
                      would leave the pane with no primary text. */}
                  {i > 0 && (
                    <button
                      type="button"
                      className="compare__drop"
                      data-testid={`compare-drop-${c.translation}`}
                      aria-label={`Stop comparing ${c.translation.toUpperCase()}`}
                      onClick={() => onDrop(c.translation)}
                    >
                      ✕
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.number} data-verse={row.number}>
                <th scope="row" className="compare__num">
                  {row.number}
                </th>
                {row.cells.map((text, i) => (
                  <td key={columns[i].translation} className="compare__cell" lang={languageOf(columns[i].translation)}>
                    {text === null ? (
                      // Absent, not empty: say so in words, because a blank
                      // cell reads as a rendering bug rather than a
                      // versification fact — and a dash with a tooltip said
                      // it only to a mouse.
                      <span className="compare__absent" lang="en">
                        Not in {columns[i].translation.toUpperCase()}
                      </span>
                    ) : (
                      <>
                        <span className="compare__text">{text}</span>
                        <button
                          type="button"
                          className="compare__quote"
                          data-testid={`compare-quote-${columns[i].translation}-${row.number}`}
                          aria-label={`Quote ${columns[i].translation.toUpperCase()} verse ${row.number}`}
                          onClick={() => onQuote(columns[i].translation, row.number)}
                        >
                          +
                        </button>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* CC BY-SA wants the notice where the material appears — and in a
          comparison the material can be in any column. */}
      {owed.length > 0 && (
        <footer className="attribution" data-testid="compare-attribution">
          {owed.map((b) => (
            <span key={b.meta.id} className="attribution__line">
              {b.meta.attribution} ·{' '}
              <a href={b.meta.source_url} target="_blank" rel="noreferrer noopener">
                {b.meta.name} source
              </a>
            </span>
          ))}
        </footer>
      )}
    </section>
  );
}
