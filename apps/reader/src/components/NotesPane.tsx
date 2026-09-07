import { useEffect, useRef, useState } from 'react';
import type { Bible } from '@scriptura/core/types';
import type { Note } from '../lib/notes';
import type { Board } from '../lib/canvas';
import { headingAt, linkAt } from '../lib/references';
import { insertAt, toggleHeading, toggleLineStyle, toggleWrap, type Edit, type LineStyle } from '../lib/mdedit';
import { EditorToolbar } from './EditorToolbar';
import { MarkdownPreview } from './MarkdownPreview';

interface NotesPaneProps {
  notes: Note[];
  activeId: string | null;
  saving: 'idle' | 'saving' | 'saved' | 'failed';
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onChange: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void;
  onExport: () => void;
  /** Opens the board view — the spatial half of the same content. */
  onOpenCanvas?: () => void;
  /** Boards export alongside notes, so they count towards having something to export. */
  boardCount?: number;
  /** Registers the textarea so quoted passages land at the cursor. */
  onSurfaceReady?: (el: HTMLTextAreaElement | null) => void;
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
 * "Collapsed by default" is still the point — the toolbar rides in with focus
 * and leaves with it, so a reader writing a reflection is not looking past
 * chrome to do it. But collapsed cannot mean absent: someone who does not know
 * that `##` makes a heading has no way to discover it, and Markdown left
 * entirely unrendered is just punctuation on the page.
 *
 * Preview shares the pane rather than taking a second column — this pane is
 * already the narrow one — and a click in it returns to the editor with the
 * caret in the block that was clicked, so reading and fixing are one gesture.
 */
export function NotesPane({
  notes,
  activeId,
  saving,
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
}: NotesPaneProps) {
  const active = notes.find((n) => n.id === activeId) ?? null;
  const surface = useRef<HTMLTextAreaElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [heading, setHeading] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [mode, setMode] = useState<'write' | 'read'>('write');
  const [focused, setFocused] = useState(false);
  /** Where to leave the caret after a toolbar edit, once React has repainted. */
  const caret = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => setConfirmingDelete(false), [activeId]);
  useEffect(() => onSurfaceReady?.(surface.current), [onSurfaceReady, activeId]);

  // The heading the cursor sits under, kept in view the way a code editor keeps
  // the enclosing function visible. A long note's structure is otherwise
  // invisible from inside it.
  const trackHeading = () => {
    const el = surface.current;
    if (!el) return;
    setHeading(headingAt(el.value, el.selectionStart));
    // A textarea has nothing to click, so the cursor is how a link is picked.
    setLink(linkAt(el.value, el.selectionStart));
  };
  useEffect(trackHeading, [active?.id, active?.body]);

  useEffect(() => {
    const pending = caret.current;
    const el = surface.current;
    if (!pending || !el) return;
    caret.current = null;
    el.focus();
    el.setSelectionRange(pending.start, pending.end);
    trackHeading();
  });

  const linkLabel = link ? describeLink?.(link) : null;

  /** Run a formatting operation over the current selection. */
  const apply = (operation: (text: string, start: number, end: number) => Edit) => {
    const el = surface.current;
    if (!el || !active) return;
    const edit = operation(el.value, el.selectionStart, el.selectionEnd);
    caret.current = { start: edit.selectionStart, end: edit.selectionEnd };
    onChange(active.id, { body: edit.text });
  };

  /** Return to writing with the caret where the reader clicked in the preview. */
  const editAt = (offset: number) => {
    setMode('write');
    caret.current = { start: offset, end: offset };
  };

  return (
    <div className="notes" data-testid="notes">
      <header className="notes__bar">
        <select
          className="notes__select"
          aria-label="Note"
          data-testid="note-select"
          value={activeId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          {notes.length === 0 && <option value="">No notes yet</option>}
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title || 'Untitled'}
            </option>
          ))}
        </select>

        <button type="button" className="notes__action" data-testid="note-new" onClick={onCreate}>
          New
        </button>
        <button
          type="button"
          className="notes__action"
          data-testid="note-preview"
          aria-pressed={mode === 'read'}
          onClick={() => setMode(mode === 'read' ? 'write' : 'read')}
          disabled={!active}
          title={mode === 'read' ? 'Back to writing' : 'See it rendered'}
        >
          {mode === 'read' ? 'Write' : 'Preview'}
        </button>
        <button
          type="button"
          className="notes__action"
          data-testid="canvas-open"
          onClick={onOpenCanvas}
          title="Lay verses and notes out on a board"
        >
          Canvas
        </button>
        <button
          type="button"
          className="notes__action"
          data-testid="note-export"
          onClick={onExport}
          disabled={notes.length === 0 && boardCount === 0}
          title="Download every note and board as Markdown in a .zip"
        >
          Export
        </button>
        {active && (
          <button
            type="button"
            className="notes__action notes__action--danger"
            data-testid="note-delete"
            onClick={() => (confirmingDelete ? onDelete(active.id) : setConfirmingDelete(true))}
          >
            {confirmingDelete ? 'Sure?' : 'Delete'}
          </button>
        )}
      </header>

      {active ? (
        <>
          <input
            className="notes__title"
            data-testid="note-title"
            aria-label="Note title"
            value={active.title}
            placeholder="Untitled"
            onChange={(e) => onChange(active.id, { title: e.target.value })}
          />
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
              title="Open this passage in the Bible pane"
              onClick={() => onFollowLink?.(link)}
            >
              Go to {linkLabel}
            </button>
          )}
          {mode === 'read' ? (
            <MarkdownPreview
              source={active.body}
              bible={bible}
              notes={notes}
              boards={boards}
              onEditAt={editAt}
              onFollowLink={(target) => onFollowLink?.(target)}
              onOpenBoard={(id) => onOpenBoard?.(id)}
            />
          ) : (
            <>
              <textarea
                ref={surface}
                className="notes__surface"
                data-testid="notes-surface"
                aria-label="Note body"
                placeholder="Write here…"
                spellCheck
                value={active.body}
                onChange={(e) => onChange(active.id, { body: e.target.value })}
                onKeyUp={trackHeading}
                onClick={trackHeading}
                onSelect={trackHeading}
                onFocus={() => setFocused(true)}
                // Delayed so a toolbar click lands before the tools withdraw.
                onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              />
              {focused && (
                <EditorToolbar
                  onHeading={(level) => apply((t, a, b) => toggleHeading(t, a, b, level))}
                  onWrap={(marker) => apply((t, a, b) => toggleWrap(t, a, b, marker))}
                  onLineStyle={(style: LineStyle) => apply((t, a, b) => toggleLineStyle(t, a, b, style))}
                  onLink={() => apply((t, a, b) => insertAt(t, a, b, '[[]]'))}
                />
              )}
            </>
          )}
        </>
      ) : (
        <div className="notes__empty">
          <p>No note open.</p>
          <button type="button" className="notes__action" onClick={onCreate}>
            Start one
          </button>
        </div>
      )}

      <footer className="notes__status" data-testid="note-status" aria-live="polite">
        {saving === 'failed' ? (
          <span className="notes__status--bad">Could not save — export your notes</span>
        ) : saving === 'saving' ? (
          'Saving…'
        ) : saving === 'saved' ? (
          'Saved'
        ) : (
          ''
        )}
      </footer>
    </div>
  );
}
