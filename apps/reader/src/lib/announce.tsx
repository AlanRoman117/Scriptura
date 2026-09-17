/**
 * Saying what changed, to someone who cannot see it change (4.1.3).
 *
 * The reader updates a great deal without moving focus: the count under the
 * search box, a download's progress bar, a panel replacing the chapter, the
 * translation switching under a link. A sighted reader sees each of these; a
 * screen reader hears none of them unless the change is put into a live
 * region. This is one pair of regions for the whole app — polite for news,
 * assertive for errors — and one function to speak through them.
 *
 * Mounted in main.tsx beside <App/>, not inside it: App returns early during
 * boot, and a region that appears after the page has loaded is not announced
 * when it appears. Consecutive duplicates are dropped, so typing a query
 * letter by letter produces one announcement, not one per keystroke — the
 * same reason writeSafely reports a failure once.
 */
import { useEffect, useState } from 'react';

type Tone = 'polite' | 'assertive';

interface Message {
  text: string;
  tone: Tone;
  /** Changes on every announcement so React re-renders even for repeated text. */
  serial: number;
}

let serial = 0;
let lastText = '';
const listeners = new Set<(m: Message) => void>();

/**
 * Announce `text`. Polite by default; `assertive` interrupts, and is for
 * errors only. The same text twice in a row is said once — unless `force`,
 * for a message that answers a fresh action (arming a delete button again
 * after cancelling it) rather than a repeated state.
 */
export function announce(text: string, options: { assertive?: boolean; force?: boolean } = {}): void {
  const trimmed = text.trim();
  if (!trimmed || (trimmed === lastText && !options.force)) return;
  lastText = trimmed;
  const message: Message = { text: trimmed, tone: options.assertive ? 'assertive' : 'polite', serial: ++serial };
  for (const listener of listeners) listener(message);
}

/** Test seam: forget the last message so the next identical one is announced. */
export function resetAnnouncer(): void {
  lastText = '';
}

/**
 * The two regions. Clearing before setting on the next frame is what makes a
 * screen reader read the same string again when it is genuinely new news
 * ("Saved" after a second edit, say).
 */
export function Announcer() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  useEffect(() => {
    const listener = (m: Message) => {
      const set = m.tone === 'assertive' ? setAssertive : setPolite;
      set('');
      requestAnimationFrame(() => set(m.text));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer">
        {polite}
      </div>
      <div className="visually-hidden" role="alert" aria-live="assertive" aria-atomic="true" data-testid="announcer-alert">
        {assertive}
      </div>
    </>
  );
}
