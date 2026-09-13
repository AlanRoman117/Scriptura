import { useEffect, useRef, useState } from 'react';
import type { Bible } from '@scriptura/core/types';
import type { Proposal } from '../lib/webmcp';
import { colorLabel, type ColorLabels } from '../lib/notes';
import { useReturnFocus } from '../lib/focus';

interface ProposalPreviewProps {
  bible: Bible;
  proposal: Proposal;
  labels: ColorLabels;
  onAccept: (proposal: Proposal) => void;
  onDiscard: () => void;
}

/**
 * What an agent has asked for, before any of it is true.
 *
 * The rule the tools are built around is that writes are staged, never applied
 * — and staging is only meaningful if the reader can see what they are
 * approving. So this shows **contents, not counts**: the whole note body, every
 * verse with its text. "Add 12 highlights" is not something anyone can
 * meaningfully consent to.
 *
 * Everything is editable before it is accepted, because the likeliest failure
 * is not a malicious proposal but a nearly-right one.
 *
 * A native <dialog> opened with showModal(): the browser puts it in the top
 * layer, makes everything behind it inert, keeps Tab inside, and turns Escape
 * into `cancel` → `close`. The earlier div with role="dialog" and aria-modal
 * had none of that — assistive technology hid the page behind it while Tab
 * still wandered off into it (2.4.3, 2.1.2).
 */
export function ProposalPreview({
  bible,
  proposal,
  labels,
  onAccept,
  onDiscard,
}: ProposalPreviewProps) {
  const [title, setTitle] = useState(proposal.kind === 'note' ? proposal.title : '');
  const [body, setBody] = useState(proposal.kind === 'note' ? proposal.body : '');
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const dialog = useRef<HTMLDialogElement>(null);

  // Mounted means open, so focus returns on unmount to whatever had it — the
  // chip, the note, wherever the reader was when the assistant spoke up.
  useReturnFocus(true);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    // Guarded: StrictMode runs effects twice in development, and showModal()
    // throws on a dialog that is already open.
    if (!el.open) el.showModal();
    // Focus the dialog itself rather than the first field, so the title and
    // the "nothing has been saved" lede are read before anything is edited.
    el.focus();
  }, []);

  const key = (r: { book_slug: string; chapter: number; verse: number }) =>
    `${r.book_slug}:${r.chapter}:${r.verse}`;

  const kept =
    proposal.kind === 'marks' ? proposal.refs.filter((r) => !dropped.has(key(r))) : [];

  return (
    <dialog
      ref={dialog}
      className="proposal"
      aria-labelledby="proposal-title"
      aria-describedby="proposal-lede"
      data-testid="proposal"
      tabIndex={-1}
      // Every way the dialog closes natively — Escape, a form submit — lands
      // here, so discarding has one path.
      onClose={onDiscard}
    >
      <div className="proposal__box">
        <header className="proposal__bar">
          <h2 className="proposal__title" id="proposal-title">
            {proposal.kind === 'note' ? 'A note has been drafted for you' : 'Verses suggested for marking'}
          </h2>
        </header>

        {/* Said plainly and first: nothing here has happened yet. */}
        <p className="proposal__lede" id="proposal-lede" data-testid="proposal-lede">
          An assistant proposed this. Nothing has been saved — review it, change anything you like,
          and it only takes effect when you accept.
        </p>

        {proposal.kind === 'note' ? (
          <div className="proposal__body">
            <input
              className="proposal__field"
              data-testid="proposal-title-input"
              aria-label="Proposed note title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="proposal__text"
              data-testid="proposal-body-input"
              aria-label="Proposed note body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        ) : (
          <div className="proposal__body">
            <p className="proposal__meta">
              Into <strong>{colorLabel(proposal.color, labels)}</strong> ({proposal.color})
            </p>
            <ul className="proposal__list" data-testid="proposal-list">
              {proposal.refs.map((r) => {
                const book = bible.book(r.book_slug);
                const text = book?.chapters
                  .find((c) => c.number === r.chapter)
                  ?.verses.find((v) => v.number === r.verse)?.text;
                const id = key(r);
                const on = !dropped.has(id);
                return (
                  <li className="proposal__item" key={id} data-dropped={!on || undefined}>
                    <label>
                      <input
                        type="checkbox"
                        data-testid={`proposal-keep-${r.book_slug}-${r.chapter}-${r.verse}`}
                        checked={on}
                        onChange={() =>
                          setDropped((current) => {
                            const next = new Set(current);
                            if (on) next.add(id);
                            else next.delete(id);
                            return next;
                          })
                        }
                      />
                      <span className="proposal__ref">
                        {book?.name ?? r.book_slug} {r.chapter}:{r.verse}
                      </span>
                    </label>
                    {/* The verse itself, because the reference alone is not
                        something a reader can check a claim against. */}
                    <p className="proposal__verse">{text ?? 'Not in this translation.'}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <footer className="proposal__actions">
          <button
            type="button"
            className="proposal__action"
            data-testid="proposal-discard"
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className="proposal__action proposal__action--primary"
            data-testid="proposal-accept"
            disabled={proposal.kind === 'marks' && kept.length === 0}
            onClick={() =>
              onAccept(
                proposal.kind === 'note'
                  ? { kind: 'note', title, body }
                  : { kind: 'marks', color: proposal.color, refs: kept }
              )
            }
          >
            {proposal.kind === 'note'
              ? 'Save this note'
              : `Mark ${kept.length} verse${kept.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
