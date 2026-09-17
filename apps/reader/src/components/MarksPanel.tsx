import { useRef, useMemo } from 'react';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { ConfirmButton } from './ConfirmButton';
import { useI18n } from '../i18n';
import type { Bible } from '@scriptura/core/types';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_GLYPHS,
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
  /** The mark most recently removed, until the next change: removal is reversible (3.3.6). */
  onUndo?: (() => void) | null;
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
  onUndo,
  onClose,
}: MarksPanelProps) {
  const { t, fmt } = useI18n();
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

  const root = useRef<HTMLElement>(null);
  // Only mounted while open: Escape closes it, and focus returns to the
  // control that opened it when it unmounts (2.4.3).
  useDismissable(true, onClose, root, { outside: false });
  useReturnFocus(true, '[data-testid="marks-open"]');

  return (
    <section ref={root} className="marks" id="marks-panel" data-testid="marks-panel" aria-label={t.marks.label}>
      <header className="marks__bar">
        {/* The chapter's h1 is hidden while this panel covers it, so this is
            the page's level-1 heading for as long as it is open (2.4.10). */}
        <h1 className="marks__title">{t.marks.title}</h1>
        {onUndo && (
          <button type="button" className="marks__close" data-testid="marks-undo" onClick={onUndo}>
            {t.common.undoRemove}
          </button>
        )}
        <button
          type="button"
          className="marks__close"
          data-testid="marks-close"
          onClick={onClose}
          aria-label={t.marks.close}
        >
          ✕
        </button>
      </header>

      <p className="marks__hint">
        {t.marks.hint}
      </p>

      {HIGHLIGHT_COLORS.map((color) => {
        const marks = byColor.get(color) ?? [];
        return (
          <section className="marks__group" key={color} data-testid={`marks-group-${color}`}>
            {/* Five collections are five sections; the editable label is the
                control, and this is the heading a screen reader navigates by. */}
            <h2 className="visually-hidden">{colorLabel(color, labels, t.colours)}</h2>
            <header className="marks__group-bar">
              <span className="swatch__disc swatch__disc--static" data-color={color} aria-hidden="true">
                <span className="swatch__glyph">{HIGHLIGHT_GLYPHS[color]}</span>
              </span>
              <input
                className="marks__label"
                data-testid={`marks-label-${color}`}
                aria-label={t.marks.nameFor(t.colourWords[color])}
                value={labels[color] ?? ''}
                placeholder={colorLabel(color, {}, t.colours)}
                onChange={(e) => onLabel(color, e.target.value)}
              />
              <span className="marks__count" data-testid={`marks-count-${color}`}>
                {fmt.number(marks.length)}
              </span>
            </header>

            {marks.length === 0 ? (
              <p className="marks__empty">{t.marks.empty}</p>
            ) : (
              <ul className="marks__list" role="list">
                {marks.map((m) => {
                  const ref = `${m.name} ${m.chapter}:${m.verse}`;
                  return (
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
                        {m.text && (
                          <span className="marks__ref-text" lang={bible.meta.language}>
                            {m.text}
                          </span>
                        )}
                      </button>
                      {/* Asks first; Undo stands until the next change (3.3.6).
                          Focus moves on to the next mark in the list. */}
                      <ConfirmButton
                        label="✕"
                        className="marks__remove"
                        data-testid={`marks-remove-${m.book_slug}-${m.chapter}-${m.verse}`}
                        aria-label={t.marks.remove(ref)}
                        confirm={{
                          title: t.confirm.mark.title(ref),
                          body: [t.confirm.mark.leaves(colorLabel(color, labels, t.colours)), t.confirm.undoable],
                          action: t.confirm.mark.action,
                          onConfirm: () => onRemove(m.id),
                          focusAfter: { item: '.marks__item', to: [`[data-testid="marks-label-${color}"]`] },
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
