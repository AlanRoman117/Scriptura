import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { announce } from '../lib/announce';
import { settleFocus, useDismissable, type FocusAfter } from '../lib/focus';
import { useI18n } from '../i18n';

/** What to ask before a destructive action, and what to do on yes. */
export interface ConfirmRequest {
  /** The question, naming what goes. It is the dialog's name. */
  title: string;
  /** What happens, one short sentence to a paragraph. Together, the dialog's description. */
  body: string[];
  /** The destructive button: a verb and its object ("Delete note"), so it reads on its own. */
  action: string;
  onConfirm: () => void;
  /** Where focus goes once the thing is gone. Without it, back to the control that asked. */
  focusAfter?: FocusAfter;
  /** Said once focus has landed, for a removal nothing else on screen reports. */
  done?: string;
}

/** Open the dialog for `request`; `trigger` is the control focus returns to. */
export type Ask = (request: ConfirmRequest, trigger: HTMLElement) => void;

const ConfirmContext = createContext<Ask | null>(null);

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error('useConfirm needs a <ConfirmProvider> above it');
  return ask;
}

interface Open {
  request: ConfirmRequest;
  trigger: HTMLElement;
}

/**
 * The question asked before anything is deleted (3.3.4, 3.3.6).
 *
 * It replaced a button that turned into "Sure?" where it stood: easy to miss,
 * and on a phone indistinguishable from the button it replaced. A modal says
 * what will go, whether it can come back, and waits.
 *
 * - **One dialog for the app**, mounted beside <App/>, never inside the pane or
 *   the card that asked. A dialog rendered inside a card is still that card's
 *   DOM child: its presses and keys would bubble into the card's drag and
 *   arrow-key handlers.
 * - **A native <dialog> opened with showModal()**, with `role="alertdialog"`:
 *   the page behind it is inert, Tab stays inside it, Escape cancels, and a
 *   screen reader says the question and its description on the way in.
 * - **Focus starts on Cancel**, the answer that loses nothing, so an Enter
 *   pressed out of habit keeps the note. Cancelling returns focus to the
 *   control that asked; confirming moves it to where the removed thing was
 *   (`settleFocus`), because that control is usually gone with it (2.4.3).
 * - **Nothing is timed** (2.2.3), and a press on the backdrop is a Cancel.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Open | null>(null);
  // The request being answered, current the instant it changes: React state
  // is only current after a render, and a key pressed in between must see it.
  const current = useRef<Open | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  const ask = useCallback<Ask>((request, trigger) => {
    // One question at a time — while it is on screen. A request whose dialog
    // has already closed is answered, whatever the bookkeeping says.
    if (current.current && dialog.current?.open) return;
    current.current = { request, trigger };
    setOpen(current.current);
  }, []);

  const finish = useCallback((confirmed: boolean) => {
    const answered = current.current;
    if (!answered) return;
    current.current = null;
    setOpen(null);
    if (dialog.current?.open) dialog.current.close();
    const { request, trigger } = answered;
    if (!confirmed) {
      // The browser gives focus back on close too, but not every engine does.
      requestAnimationFrame(() => {
        if (trigger.isConnected && document.activeElement !== trigger) trigger.focus();
      });
      return;
    }
    const { done } = request;
    // The news waits for focus to land: the new place is read first, and a
    // removal that waits on storage is reported once it has happened.
    settleFocus(trigger, request.focusAfter, done ? () => announce(done, { force: true }) : undefined);
    request.onConfirm();
  }, []);

  // On the dismiss stack while open, so Escape is the dialog's alone: the
  // panel underneath (Marks, Translations) must not close with it.
  useDismissable(open !== null, () => finish(false), dialog, { outside: false });

  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return;
    // Guarded: StrictMode runs effects twice, and showModal() throws on an open dialog.
    if (!el.open) el.showModal();
    cancel.current?.focus();
  }, [open]);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <dialog
        ref={dialog}
        className="confirm-dialog"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="confirm-dialog"
        // Escape is a Cancel, answered on `cancel` because that fires before
        // the dialog closes. `close` arrives a task later: a Delete pressed in
        // between found the old question still pending and was ignored. It
        // stays as the catch-all for any other way the dialog closes.
        onCancel={() => finish(false)}
        onClose={() => {
          if (!dialog.current?.open) finish(false);
        }}
        // The dialog fills the screen and its box sits inside it, so a press
        // whose target is the dialog itself landed on the backdrop. Both ends
        // of the press must: a drag that starts in the text is not a Cancel.
        onPointerDown={(e) => {
          pressedBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (pressedBackdrop.current && e.target === e.currentTarget) finish(false);
          pressedBackdrop.current = false;
        }}
      >
        {open && (
          <div className="confirm-dialog__box">
            <h2 className="confirm-dialog__title" id={titleId} data-testid="confirm-title">
              {/* A warning sign as well as the words and the colour (1.4.1). */}
              <svg className="confirm-dialog__sign" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 2.5 1.5 21h21L12 2.5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 9v5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="12" cy="17.6" r="1.3" fill="currentColor" />
              </svg>
              <span>{open.request.title}</span>
            </h2>
            <div className="confirm-dialog__body" id={bodyId} data-testid="confirm-body">
              {open.request.body.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <footer className="confirm-dialog__actions">
              <button
                ref={cancel}
                type="button"
                className="confirm-dialog__action"
                data-testid="confirm-cancel"
                onClick={() => finish(false)}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="confirm-dialog__action confirm-dialog__action--danger"
                data-testid="confirm-accept"
                onClick={() => finish(true)}
              >
                {open.request.action}
              </button>
            </footer>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
