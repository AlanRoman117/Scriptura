import { useMemo } from 'react';
import type { Bible } from '@scriptura/core/types';
import {
  HIGHLIGHT_COLORS,
  colorLabel,
  type ColorLabels,
  type Highlight,
  type HighlightColor,
} from '../lib/notes';

interface MarksPanelProps {
  bible: Bible;
  highlights: Highlight[];
  labels: ColorLabels;
  onLabel: (color: HighlightColor, label: string) => void;
  onGo: (bookSlug: string, chapter: number, verse: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

interface Mark extends Highlight {
  /** Canonical book number, for ordering; 0 when the book is unknown here. */
  order: number;
  name: string;
  text: string | null;
}

/**
 * The five colours, read back as five collections.
 *
 * Highlighting was write-only: you could mark a verse in yellow for one study
 * subject and red for another, then had to go hunting through chapters to find
 * them again. Nothing new is stored to fix that — a highlight already carries
 * its colour and its address, so a collection is just that list, read back.
 *
 * Ordered canonically rather than by when it was marked: a colour is a subject,
 * and walking a subject through scripture in order is the point. The date a
 * verse was noticed is rarely the useful axis.
 */
export function MarksPanel({
  bible,
  highlights,
  labels,
  onLabel,
  onGo,
  onRemove,
  onClose,
}: MarksPanelProps) {
  const byColor = useMemo(() => {
    const groups = new Map<HighlightColor, Mark[]>(HIGHLIGHT_COLORS.map((c) => [c, []]));

    for (const h of highlights) {
      // A mark can outlive the translation it was made in — it is anchored to
      // the passage. Show the reference either way; show the text when this
      // translation has it.
      const book = bible.book(h.book_slug);
      const verse = book?.chapters
        .find((c) => c.number === h.chapter)
        ?.verses.find((v) => v.number === h.verse);

      groups.get(h.color)?.push({
        ...h,
        order: book?.number ?? 0,
        name: book?.name ?? h.book_slug,
        text: verse?.text ?? null,
      });
    }

    for (const list of groups.values()) {
      list.sort((a, b) => a.order - b.order || a.chapter - b.chapter || a.verse - b.verse);
    }
    return groups;
  }, [bible, highlights]);

  return (
    <section className="marks" data-testid="marks-panel" aria-label="Marked verses">
      <header className="marks__bar">
        <h2 className="marks__title">Marks</h2>
        <button
          type="button"
          className="marks__close"
          data-testid="marks-close"
          onClick={onClose}
          aria-label="Close marks"
        >
          ✕
        </button>
      </header>

      <p className="marks__hint">
        Each colour is a running list. Name one for the subject you are tracking.
      </p>

      {HIGHLIGHT_COLORS.map((color) => {
        const marks = byColor.get(color) ?? [];
        return (
          <section className="marks__group" key={color} data-testid={`marks-group-${color}`}>
            <header className="marks__group-bar">
              <span className="swatch swatch--static" data-color={color} aria-hidden="true" />
              <input
                className="marks__label"
                data-testid={`marks-label-${color}`}
                aria-label={`Name for the ${color} collection`}
                value={labels[color] ?? ''}
                placeholder={colorLabel(color, {})}
                onChange={(e) => onLabel(color, e.target.value)}
              />
              <span className="marks__count" data-testid={`marks-count-${color}`}>
                {marks.length}
              </span>
            </header>

            {marks.length === 0 ? (
              <p className="marks__empty">Nothing marked in this colour yet.</p>
            ) : (
              <ul className="marks__list">
                {marks.map((m) => (
                  <li className="marks__item" key={m.id}>
                    <button
                      type="button"
                      className="marks__ref"
                      data-testid={`marks-go-${m.book_slug}-${m.chapter}-${m.verse}`}
                      onClick={() => onGo(m.book_slug, m.chapter, m.verse)}
                    >
                      <span className="marks__ref-label">
                        {m.name} {m.chapter}:{m.verse}
                      </span>
                      {m.text && <span className="marks__ref-text">{m.text}</span>}
                    </button>
                    <button
                      type="button"
                      className="marks__remove"
                      data-testid={`marks-remove-${m.book_slug}-${m.chapter}-${m.verse}`}
                      title="Remove this mark"
                      aria-label={`Remove the mark on ${m.name} ${m.chapter}:${m.verse}`}
                      onClick={() => onRemove(m.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
