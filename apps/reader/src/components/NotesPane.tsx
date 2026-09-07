/**
 * Placeholder for the markdown surface.
 *
 * Stage 2 gives this IndexedDB persistence and Stage 3 the collapsed-by-default
 * editor and the selection→link workflow. It exists now so the layout is the
 * real thing rather than a mock: the split, the divider and the mobile sheet are
 * all exercised against a genuine second pane.
 */
export function NotesPane() {
  return (
    <div className="notes" data-testid="notes">
      <textarea
        className="notes__surface"
        data-testid="notes-surface"
        aria-label="Notes"
        placeholder="Write here…"
        spellCheck
      />
      <p className="notes__hint">
        Notes are not saved yet — persistence lands next.
      </p>
    </div>
  );
}
