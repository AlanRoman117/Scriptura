import type { ReactNode } from 'react';
import { useConfirm, type ConfirmRequest } from './ConfirmDialog';

interface ConfirmButtonProps {
  /** What the button says. */
  label: ReactNode;
  /** What the dialog asks, and what happens on yes. */
  confirm: ConfirmRequest;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  disabled?: boolean;
}

/**
 * A destructive action that asks first (3.3.4, 3.3.6).
 *
 * The press opens the confirmation dialog (`ConfirmDialog`), which names what
 * will go and whether it can come back. The button itself never changes:
 * it used to arm in place, turning into "Sure?" with a Cancel beside it, which
 * was easy to miss and read as the same button on a phone.
 *
 * `aria-haspopup` says, before the press, that a dialog follows.
 */
export function ConfirmButton({ label, confirm, className, disabled, ...rest }: ConfirmButtonProps) {
  const ask = useConfirm();
  return (
    <button
      type="button"
      className={className}
      data-testid={rest['data-testid']}
      aria-label={rest['aria-label']}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={(e) => ask(confirm, e.currentTarget)}
    >
      {label}
    </button>
  );
}
