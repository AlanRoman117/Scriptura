import { useEffect, useRef, useState } from 'react';
import type { Note } from '../lib/notes';

interface NotesPaneProps {
  notes: Note[];
  activeId: string | null;
  saving: 'idle' | 'saving' | 'saved' | 'failed';
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onChange: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void;
  onExport: () => void;
}

/**
 * The writing surface.
 *
 * Deliberately bare: no toolbar, no syntax hints. The spec's "collapsed by
 * default" is the point — someone writing a reflection should not have to look
 * past formatting chrome to do it. Stage 3 adds formatting on selection, which
 * keeps the resting state this quiet.
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
}: NotesPaneProps) {
  const active = notes.find((n) => n.id === activeId) ?? null;
  const surface = useRef<HTMLTextAreaElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => setConfirmingDelete(false), [activeId]);

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
          data-testid="note-export"
          onClick={onExport}
          disabled={notes.length === 0}
          title="Download every note as Markdown in a .zip"
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
          <textarea
            ref={surface}
            className="notes__surface"
            data-testid="notes-surface"
            aria-label="Note body"
            placeholder="Write here…"
            spellCheck
            value={active.body}
            onChange={(e) => onChange(active.id, { body: e.target.value })}
          />
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
