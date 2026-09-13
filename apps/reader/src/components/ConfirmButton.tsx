import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { announce } from '../lib/announce';
import { useDismissable } from '../lib/focus';

interface ConfirmButtonProps {
  /** What the button says at rest. */
  label: ReactNode;
  /** What it says once armed. "Sure?" is the house style, and two specs assert it. */
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  disabled?: boolean;
  /** Changing this disarms — the note or board id, so a new selection starts clean. */
  resetKey?: unknown;
}

/**
 * A destructive action in two presses (3.3.4, 3.3.6).
 *
 * The first press arms: the label becomes "Sure?", a Cancel button appears
 * beside it, and the change is announced, because a button whose name quietly
 * turns into a question is a riddle for anyone who cannot see it. Escape or a
 * press anywhere else disarms. The second press acts. Nothing here is timed:
 * an armed button stays armed until the reader decides (2.2.3).
 *
 * This replaces the pattern that lived in NotesPane and CanvasView — the same
 * two-step, but the button's own name mutated with nothing announced and no
 * way back other than to click elsewhere.
 */
export function ConfirmButton({
  label,
  confirmLabel = 'Sure?',
  onConfirm,
  className,
  disabled,
  resetKey,
  ...rest
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const hintId = useId();
  const testid = rest['data-testid'];

  useEffect(() => setArmed(false), [resetKey]);
  useDismissable(armed, () => setArmed(false), root);

  return (
    <span className="confirm" ref={root} data-armed={armed || undefined}>
      <button
        type="button"
        className={className}
        data-testid={testid}
        aria-label={armed && rest['aria-label'] ? `${rest['aria-label']} — ${confirmLabel}` : rest['aria-label']}
        aria-describedby={armed ? hintId : undefined}
        disabled={disabled}
        onClick={() => {
          if (armed) {
            setArmed(false);
            onConfirm();
            return;
          }
          setArmed(true);
          announce('Press again to confirm, or Escape to cancel', { force: true });
        }}
      >
        {armed ? confirmLabel : label}
      </button>
      {armed && (
        <>
          <span id={hintId} className="visually-hidden">
            Press again to confirm, or Escape to cancel.
          </span>
          <button
            type="button"
            className={`${className ?? ''} confirm__cancel`}
            data-testid={testid ? `${testid}-cancel` : undefined}
            onClick={() => setArmed(false)}
          >
            Cancel
          </button>
        </>
      )}
    </span>
  );
}
