import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { announce } from '../lib/announce';
import { flushPending } from '../lib/pending';

/**
 * A new version is ready — and the reader decides when to switch to it.
 *
 * The service worker used to skip waiting and claim the page the moment a new
 * build was fetched, so the app could change underneath someone mid-sentence
 * (2.2.4, 3.2.5). Now the new version waits. This notice says so, once, and
 * offers Reload or Later. Reload saves the note edits still inside the
 * autosave delay before it reloads, so the last words typed are never the
 * price of an update. Later hides the notice for this visit.
 *
 * Mounted beside <App/> in main.tsx, like the announcer, so it is there in
 * every state of the app, the board included, and registers exactly once.
 */
let reloading = false;
/** One reload however many listeners ask for it — the plugin may ask too. */
function reloadOnce() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

export function UpdateNotice() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh: () => announce('A new version of Scriptura is ready. Reload when it suits you.'),
    onRegisterError: (error) => console.warn('Could not register the service worker:', error),
  });
  const [later, setLater] = useState(false);
  const [reloading, setReloading] = useState(false);

  if (!needRefresh || later) return null;

  return (
    <aside className="update" data-testid="update-notice" aria-label="A new version is ready">
      <p className="update__text">A new version of Scriptura is ready.</p>
      <div className="update__actions">
        <button
          type="button"
          className="update__action update__action--primary"
          data-testid="update-reload"
          disabled={reloading}
          onClick={async () => {
            setReloading(true);
            await flushPending();
            // Reload when the new worker takes over, ourselves. The plugin
            // reloads only when a worker already controlled the page at the
            // moment the app registered — so for someone on their first
            // visit, who kept the tab open until the next deploy, Reload
            // switched workers and then did nothing at all. A real update in
            // tests/reader/offline.spec.ts found that.
            navigator.serviceWorker?.addEventListener('controllerchange', reloadOnce, { once: true });
            await updateServiceWorker(true);
          }}
        >
          {reloading ? 'Reloading…' : 'Reload'}
        </button>
        <button type="button" className="update__action" data-testid="update-later" onClick={() => setLater(true)}>
          Later
        </button>
      </div>
    </aside>
  );
}
