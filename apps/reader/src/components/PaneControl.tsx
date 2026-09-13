import { createContext, useContext } from 'react';

export type Pane = 'bible' | 'notes';
export type Maximized = 'none' | Pane;

interface PaneControls {
  maximized: Maximized;
  toggle: (pane: Pane) => void;
}

/**
 * Provided by Layout while the panes sit side by side. A phone shows the Bible
 * with the notes as a sheet and has nothing to maximize, so without a provider
 * the button renders nothing.
 */
export const PaneControlsContext = createContext<PaneControls | null>(null);

const NAMES: Record<Pane, string> = { bible: 'Bible', notes: 'Notes' };

/**
 * Maximize or restore a pane, from the end of that pane's own row of controls.
 *
 * It used to be positioned absolutely in the pane's top corner. In the Bible
 * pane that drew it after Help, jammed against the divider's top button, while
 * it was the first thing Tab reached (2.4.3); in the notes pane it sat on a
 * line of its own above the bar, which kept a row of empty space for it. Each
 * bar now renders it last, so it is where it is drawn and the same size and
 * shape as the buttons beside it — `className` is theirs.
 */
export function MaximizeButton({ pane, className }: { pane: Pane; className: string }) {
  const controls = useContext(PaneControlsContext);
  if (!controls) return null;
  const active = controls.maximized === pane;
  const label = `${active ? 'Restore' : 'Maximize'} ${NAMES[pane]}`;
  return (
    <button
      type="button"
      className={`${className} pane__maximize`}
      data-testid={`maximize-${pane}`}
      aria-pressed={active}
      title={label}
      onClick={() => controls.toggle(pane)}
    >
      <span aria-hidden="true">{active ? '⤡' : '⤢'}</span>
      <span className="visually-hidden">{label}</span>
    </button>
  );
}
