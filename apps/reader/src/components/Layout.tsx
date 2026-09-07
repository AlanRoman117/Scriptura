import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** Below this the panes cannot sit side by side; notes become a sheet. */
const NARROW = 850;
/** Neither pane may be squeezed below this share of the width. */
const MIN_SPLIT = 0.25;
const MAX_SPLIT = 0.75;

export type Maximized = 'none' | 'bible' | 'notes';
/** How far the mobile notes sheet is pulled up. */
export type SheetPosition = 'peek' | 'half' | 'full';

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < NARROW
  );
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${NARROW - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

interface LayoutProps {
  bible: ReactNode;
  notes: ReactNode;
}

/**
 * The reading surface: scripture left, notes right.
 *
 * Both are visible by default because the pairing is the point — you write
 * about the verse you can see. Either can be maximized when it is not.
 *
 * On a phone that split is unusable, so the Bible takes the screen and notes
 * become a bottom sheet at peek / half / full. Tabs were the alternative and
 * were rejected: switching away from the text to write about it loses exactly
 * the context the layout exists to preserve.
 */
export function Layout({ bible, notes }: LayoutProps) {
  const narrow = useIsNarrow();
  const [split, setSplit] = useState(0.58);
  const [maximized, setMaximized] = useState<Maximized>('none');
  const [sheet, setSheet] = useState<SheetPosition>('peek');
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onDrag = useCallback((clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const next = (clientX - box.left) / box.width;
    setSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, next)));
  }, []);

  useEffect(() => {
    if (narrow) return;
    const move = (e: PointerEvent) => dragging.current && onDrag(e.clientX);
    const up = () => {
      dragging.current = false;
      document.body.classList.remove('dragging');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [narrow, onDrag]);

  if (narrow) {
    return (
      <div className="layout layout--narrow" data-testid="layout" data-mode="narrow">
        <main className="pane pane--bible" data-testid="pane-bible">
          {bible}
        </main>
        <section
          className="sheet"
          data-testid="pane-notes"
          data-sheet={sheet}
          aria-label="Notes"
        >
          <button
            type="button"
            className="sheet__grip"
            aria-label={sheet === 'full' ? 'Collapse notes' : 'Expand notes'}
            aria-expanded={sheet !== 'peek'}
            onClick={() => setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek')}
          >
            <span className="sheet__handle" aria-hidden="true" />
            <span className="sheet__label">Notes</span>
          </button>
          <div className="sheet__body">{notes}</div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="layout"
      data-testid="layout"
      data-mode="split"
      data-maximized={maximized}
      ref={frame}
      style={{ ['--split' as string]: `${split * 100}%` }}
    >
      <main className="pane pane--bible" data-testid="pane-bible" hidden={maximized === 'notes'}>
        <PaneControl
          label="Bible"
          active={maximized === 'bible'}
          onToggle={() => setMaximized(maximized === 'bible' ? 'none' : 'bible')}
        />
        {bible}
      </main>

      {maximized === 'none' && (
        <div
          className="divider"
          data-testid="divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panes"
          aria-valuenow={Math.round(split * 100)}
          aria-valuemin={Math.round(MIN_SPLIT * 100)}
          aria-valuemax={Math.round(MAX_SPLIT * 100)}
          tabIndex={0}
          onPointerDown={() => {
            dragging.current = true;
            document.body.classList.add('dragging');
          }}
          // Keyboard-resizable: a pointer-only divider is unusable without a mouse.
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setSplit((s) => Math.max(MIN_SPLIT, s - 0.02));
            if (e.key === 'ArrowRight') setSplit((s) => Math.min(MAX_SPLIT, s + 0.02));
          }}
        />
      )}

      <aside className="pane pane--notes" data-testid="pane-notes" hidden={maximized === 'bible'}>
        <PaneControl
          label="Notes"
          active={maximized === 'notes'}
          onToggle={() => setMaximized(maximized === 'notes' ? 'none' : 'notes')}
        />
        {notes}
      </aside>
    </div>
  );
}

function PaneControl({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="pane__maximize"
      data-testid={`maximize-${label.toLowerCase()}`}
      aria-pressed={active}
      title={active ? `Restore ${label}` : `Maximize ${label}`}
      onClick={onToggle}
    >
      {active ? '⤡' : '⤢'}
      <span className="visually-hidden">{active ? `Restore ${label}` : `Maximize ${label}`}</span>
    </button>
  );
}
