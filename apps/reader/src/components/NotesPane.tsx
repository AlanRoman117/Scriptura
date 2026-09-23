import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bible } from '@scriptura/core/types';
import type { Note } from '../lib/notes';
import type { Board } from '../lib/canvas';
import { headingAt, linkAt } from '../lib/references';
import { insertAt, toggleHeading, toggleLineStyle, toggleWrap, type Edit, type LineStyle } from '../lib/mdedit';
import { EditorToolbar } from './EditorToolbar';
import { MarkdownPreview } from './MarkdownPreview';
import { LiveEditor } from './LiveEditor';
import { BoardThumbnail } from './BoardThumbnail';
import { textareaSurface, type NoteSurface } from '../lib/surface';
import type { EditorPref } from '../lib/prefs';
import { ConfirmButton } from './ConfirmButton';
import { MaximizeButton } from './PaneControl';
import { settleFocus } from '../lib/focus';
import { useI18n } from '../i18n';

interface NotesPaneProps {
  notes: Note[];
  activeId: string | null;
  saving: 'idle' | 'saving' | 'saved' | 'failed';
  /** The last thing put into the note from elsewhere, in words, until the next action. */
  inserted?: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onChange: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void;
  onExport: () => void;
  /** Opens the board view — the spatial half of the same content. */
  onOpenCanvas?: () => void;
  /** Boards export alongside notes, so they count towards having something to export. */
  boardCount?: number;
  /** Registers the note editor so quoted passages land at the cursor. */
  onSurfaceReady?: (surface: NoteSurface) => void;
  /** Which editor to write in: drawn as typed, or plain Markdown. */
  editor?: EditorPref;
  /** How a `[[…]]` link reads, or null when it resolves to nothing. */
  describeLink?: (inner: string) => string | null;
  onFollowLink?: (inner: string) => void;
  /** Everything the preview needs to draw an embedded board. */
  bible?: Bible | null;
  boards?: Board[];
  onOpenBoard?: (id: string) => void;
}

/**
 * The writing surface: write, or read it back rendered.
 *
 * The formatting tools are always there while a note is being written. They
 * used to ride in with focus and leave with it, which meant a reader looking
 * at the pane saw no tools at all, and saw them appear and vanish as focus came
 * and went — controls that are only sometimes there are hard to find and hard
 * to trust. Someone who does not know that `##` makes a heading has no way to
 * discover it from an empty textarea, and Markdown left entirely unrendered is
 * just punctuation on the page.
 *
 * Preview shares the pane rather than taking a second column — this pane is
 * already the narrow one — and a click in it returns to the editor with the
 * caret in the block that was clicked, so reading and fixing are one gesture.
 */
export function NotesPane({
  notes,
  activeId,
  saving,
  inserted = null,
  onSelect,
  onCreate,
  onDelete,
  onChange,
  onExport,
  onOpenCanvas,
  boardCount = 0,
  onSurfaceReady,
  describeLink,
  onFollowLink,
  bible = null,
  boards = [],
  onOpenBoard,
  editor = 'plain',
}: NotesPaneProps) {
  const { t } = useI18n();
  const active = notes.find((n) => n.id === activeId) ?? null;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const live = useRef<NoteSurface>(null);
  const editorNow = useRef(editor);
  editorNow.current = editor;
  /**
   * Whichever editor is showing, behind one object that never changes — so
   * the app can hold on to it across a switch of editor, a switch of note, or
   * the preview, when there is no editor at all and every call does nothing.
   */
  const surface = useMemo<NoteSurface>(() => {
    const current = (): NoteSurface | null =>
      editorNow.current === 'live'
        ? live.current
        : textarea.current
          ? textareaSurface(textarea.current)
          : null;
    return {
      get value() {
        return current()?.value ?? '';
      },
      get selectionStart() {
        return current()?.selectionStart ?? 0;
      },
      get selectionEnd() {
        return current()?.selectionEnd ?? 0;
      },
      setSelectionRange: (start, end) => current()?.setSelectionRange(start, end),
      focus: () => current()?.focus(),
      isFocused: () => current()?.isFocused() ?? false,
      element: () => current()?.element() ?? null,
    };
  }, []);
  const [heading, setHeading] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [mode, setMode] = useState<'write' | 'read'>('write');
  /**
   * Where to leave the caret after a toolbar edit, once React has repainted,
   * and the text that edit produces — see the effect below for why the text
   * has to be part of it.
   */
  const caret = useRef<{ start: number; end: number; text?: string } | null>(null);

  useEffect(() => onSurfaceReady?.(surface), [onSurfaceReady, surface]);

  // The heading the cursor sits under, kept in view the way a code editor keeps
  // the enclosing function visible. A long note's structure is otherwise
  // invisible from inside it.
  const trackHeading = () => {
    const el = surface;
    if (!el.element()) return;
    setHeading(headingAt(el.value, el.selectionStart));
    // A textarea has nothing to click, so the cursor is how a link is picked.
    setLink(linkAt(el.value, el.selectionStart));
  };
  useEffect(trackHeading, [active?.id, active?.body]);

  // ⚠️ The selection is restored only on the render that carries the edited
  // text. This effect runs after every render, and an unrelated update — the
  // save state, a storage estimate, an announcement — can commit between the
  // toolbar's edit and the new body arriving. Placing the selection against
  // the old text then loses it the moment React writes the new value, since
  // assigning a textarea's value collapses the selection to the end. On a
  // macOS runner that showed up as the right text with nothing selected. The
  // caret simply waits for its own render instead.
  useEffect(() => {
    const pending = caret.current;
    const el = surface;
    if (!pending || !el.element()) return;
    if (pending.text !== undefined && el.value !== pending.text) return;
    caret.current = null;
    el.focus();
    el.setSelectionRange(pending.start, pending.end);
    trackHeading();
  });

  const linkLabel = link ? describeLink?.(link) : null;

  /** Run a formatting operation over the current selection. */
  const apply = (operation: (text: string, start: number, end: number) => Edit) => {
    const el = surface;
    if (!el.element() || !active) return;
    const edit = operation(el.value, el.selectionStart, el.selectionEnd);
    caret.current = { start: edit.selectionStart, end: edit.selectionEnd, text: edit.text };
    onChange(active.id, { body: edit.text });
  };

  /** Return to writing with the caret where the reader clicked in the preview. */
  const editAt = (offset: number) => {
    setMode('write');
    caret.current = { start: offset, end: offset };
  };

  return (
    <div className="notes" id="notes" tabIndex={-1} data-testid="notes">
      {/* The pane's own heading, so a note's headings have a parent and the
          outline reads chapter → notes → the note (2.4.10). */}
      <h2 className="visually-hidden">{t.notes.heading}</h2>
      <header className="notes__bar">
        <select
          className="notes__select"
          aria-label={t.notes.picker}
          data-testid="note-select"
          value={activeId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          {notes.length === 0 && <option value="">{t.notes.none}</option>}
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title || t.common.untitledNote}
            </option>
          ))}
        </select>

        <button type="button" className="notes__action" data-testid="note-new" onClick={onCreate}>
          {t.notes.new}
        </button>
        <button
          type="button"
          className="notes__action"
          data-testid="note-preview"
          aria-pressed={mode === 'read'}
          onClick={() => setMode(mode === 'read' ? 'write' : 'read')}
          disabled={!active}
          title={mode === 'read' ? t.notes.writeTitle : t.notes.previewTitle}
        >
          {mode === 'read' ? t.notes.write : t.notes.preview}
        </button>
        <button
          type="button"
          className="notes__action"
          data-testid="canvas-open"
          onClick={onOpenCanvas}
          title={t.notes.canvasTitle}
        >
          {t.notes.canvas}
        </button>
        <button
          type="button"
          className="notes__action"
          data-testid="note-export"
          onClick={onExport}
          disabled={notes.length === 0 && boardCount === 0}
          title={t.notes.exportTitle}
        >
          {t.notes.export}
        </button>
        {/* The last two wrap together: on its own the maximize button would
            be left alone on a second line. */}
        <span className="notes__bar-end">
          {active && (
            // Asks first, naming the note (3.3.4). Afterwards focus goes to
            // the picker, which says which note is open now, or to "Start
            // one" when that was the last.
            <ConfirmButton
              label={t.notes.delete}
              className="notes__action notes__action--danger"
              data-testid="note-delete"
              confirm={{
                title: t.confirm.note.title(active.title || t.common.untitledNote),
                body: [t.confirm.note.gone, t.confirm.permanent, t.confirm.note.keepCopy],
                action: t.confirm.note.action,
                onConfirm: () => onDelete(active.id),
                focusAfter: { to: ['[data-testid="note-start"]', '[data-testid="note-select"]'] },
                done: t.confirm.note.done(active.title || t.common.untitledNote),
              }}
            />
          )}
          <MaximizeButton pane="notes" className="notes__action" />
        </span>
      </header>

      {active ? (
        <>
          <input
            className="notes__title"
            data-testid="note-title"
            aria-label={t.notes.title}
            value={active.title}
            placeholder={t.common.untitledNote}
            onChange={(e) => onChange(active.id, { title: e.target.value })}
          />
          {/* The editing group: the tools, what the caret is under, and the
              note itself. The tools are shown whenever the note is open for
              writing, wherever focus is — not only while it is inside this
              group. Preview has nothing to format, so it has no tools. */}
          <div className="notes__editor">
          {mode === 'write' && (
            <div className="tools__slot">
              <EditorToolbar
                onHeading={(level) => apply((t, a, b) => toggleHeading(t, a, b, level))}
                onWrap={(marker) => apply((t, a, b) => toggleWrap(t, a, b, marker))}
                onLineStyle={(style: LineStyle) => apply((t, a, b) => toggleLineStyle(t, a, b, style))}
                onLink={() => apply((t, a, b) => insertAt(t, a, b, '[[]]'))}
              />
            </div>
          )}

          {/* Both describe where the *cursor* is, so neither belongs in a
              rendered view — and the sticky heading would sit directly above
              the same heading, rendered. */}
          {mode === 'write' && heading && (
            <div className="notes__heading" data-testid="notes-heading" aria-hidden="true">
              {heading}
            </div>
          )}
          {mode === 'write' && link && linkLabel && (
            <button
              type="button"
              className="notes__link"
              data-testid="notes-follow-link"
              onClick={() => onFollowLink?.(link)}
            >
              {t.notes.goTo(linkLabel)}
            </button>
          )}
          {mode === 'read' ? (
            <MarkdownPreview
              source={active.body}
              bible={bible}
              notes={notes}
              boards={boards}
              describeLink={describeLink}
              onEditAt={editAt}
              onFollowLink={(target) => onFollowLink?.(target)}
              onOpenBoard={(id) => onOpenBoard?.(id)}
            />
          ) : (
            editor === 'live' ? (
              <LiveEditor
                ref={live}
                value={active.body}
                noteId={active.id}
                label={t.notes.body}
                placeholder={t.notes.placeholder}
                onChange={(body) => onChange(active.id, { body })}
                onCaret={trackHeading}
                onFollowLink={(offset) => {
                  const target = linkAt(active.body, offset);
                  if (target) onFollowLink?.(target);
                }}
                renderBoard={(id) => (
                  <BoardThumbnail
                    board={boards.find((b) => b.id === id)}
                    bible={bible}
                    notes={notes}
                    onOpen={(boardId) => onOpenBoard?.(boardId)}
                  />
                )}
              />
            ) : (
              <textarea
                ref={textarea}
                id="notes-surface"
                className="notes__surface"
                data-testid="notes-surface"
                aria-label={t.notes.body}
                placeholder={t.notes.placeholder}
                spellCheck
                value={active.body}
                onChange={(e) => onChange(active.id, { body: e.target.value })}
                onKeyUp={trackHeading}
                onClick={trackHeading}
                onSelect={trackHeading}
              />
            )
          )}
          </div>
        </>
      ) : (
        <div className="notes__empty">
          <p>{t.notes.noneOpen}</p>
          <button
            type="button"
            className="notes__action"
            data-testid="note-start"
            onClick={(e) => {
              // This button goes with the empty state; the new note's title
              // is where the reader was heading anyway (2.4.3).
              settleFocus(e.currentTarget, { to: ['[data-testid="note-title"]'] });
              onCreate();
            }}
          >
            {t.notes.startOne}
          </button>
        </div>
      )}

      <footer className="notes__status" data-testid="note-status">
        {/* What just went into the note, and whether it is stored. Only the
            second is a live region: the first has already been announced,
            and inside the region it would be said twice. */}
        {inserted && (
          <span className="done notes__done" data-testid="note-done">
            <span className="done__check" aria-hidden="true">
              ✓
            </span>{' '}
            {inserted}
          </span>
        )}
        <span className="notes__saving" aria-live="polite">
          {saving === 'failed' ? (
            <span className="notes__status--bad">{t.notes.saveFailed}</span>
          ) : saving === 'saving' ? (
            t.notes.saving
          ) : saving === 'saved' ? (
            t.notes.saved
          ) : (
            ''
          )}
        </span>
      </footer>
    </div>
  );
}
