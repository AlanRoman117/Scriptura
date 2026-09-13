import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePointerDrag } from '../lib/viewport';

/** Below this the panes cannot sit side by side; notes become a sheet. */
const NARROW = 850;
/**
 * Neither pane may be squeezed below this, in pixels.
 *
 * A *fraction* was the wrong unit: a quarter of a 1400px window is a workable
 * 350px column, but a quarter of a 900px one is 225px — narrow enough that the
 * reading bar cannot hold its own controls and the text runs about four words
 * to the line. The floor is a width, so it means the same thing at every window
 * size. The share limits remain as an upper bound on a very wide screen.
 */
const MIN_PANE = 320;
const MIN_SPLIT = 0.25;
const MAX_SPLIT = 0.75;

/** The usable split range for a given frame width. */
function splitLimits(width: number): [number, number] {
  if (width <= 0) return [MIN_SPLIT, MAX_SPLIT];
  const floor = Math.max(MIN_SPLIT, MIN_PANE / width);
  const ceiling = Math.min(MAX_SPLIT, 1 - MIN_PANE / width);
  // On a frame too small to give both panes the floor, fall back to halves
  // rather than inverting the bounds.
  return floor > ceiling ? [0.5, 0.5] : [floor, ceiling];
}

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

  const onDrag = useCallback((clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const [min, max] = splitLimits(box.width);
    setSplit(Math.min(max, Math.max(min, (clientX - box.left) / box.width)));
  }, []);

  /** Nudge by keyboard, against the same floor a drag respects. */
  const nudge = useCallback((delta: number) => {
    const width = frame.current?.getBoundingClientRect().width ?? 0;
    const [min, max] = splitLimits(width);
    setSplit((s) => Math.min(max, Math.max(min, s + delta)));
  }, []);

  // The app's one drag implementation (lib/viewport.ts): the pointer is
  // captured, and a cancelled touch ends the drag like an up, so the divider
  // is never left half-dragged with `user-select: none` on the document.
  const divider = usePointerDrag<HTMLDivElement>({ onMove: (e) => onDrag(e.clientX) });

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

  // The frame fills the window in this layout, so `innerWidth` is the right
  // stand-in on the first render, before the ref is attached — the alternative
  // is announcing 25/75 once and correcting it a beat later.
  const limits = splitLimits(
    frame.current?.getBoundingClientRect().width ?? window.innerWidth
  );

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
          aria-valuemin={Math.round(limits[0] * 100)}
          aria-valuemax={Math.round(limits[1] * 100)}
          tabIndex={0}
          {...divider}
          // Keyboard-resizable: a pointer-only divider is unusable without a mouse.
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') nudge(-0.02);
            if (e.key === 'ArrowRight') nudge(0.02);
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
