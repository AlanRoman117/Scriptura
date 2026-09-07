import { fileSystemAccessSupported } from '../lib/export';

export type Persistence = 'persisted' | 'denied' | 'unsupported' | 'unknown';

interface DurabilityBannerProps {
  persistence: Persistence;
  mirroring: boolean;
  exportStale: boolean;
  onChooseFolder: () => void;
  onExport: () => void;
  onDismiss: () => void;
}

/**
 * Says out loud how safe the user's notes actually are.
 *
 * IndexedDB is evictable. `navigator.storage.persist()` is a *request* the
 * browser may refuse, and "clear site data" wipes everything regardless — so an
 * app that quietly assumes durability is how people lose work. This is shown
 * only when there is something to act on, and every state offers the action
 * that improves it.
 */
export function DurabilityBanner({
  persistence,
  mirroring,
  exportStale,
  onChooseFolder,
  onExport,
  onDismiss,
}: DurabilityBannerProps) {
  // A folder mirror on disk outranks anything the browser can promise.
  if (mirroring && !exportStale) return null;
  if (persistence === 'persisted' && !exportStale && !fileSystemAccessSupported()) return null;

  const message =
    persistence === 'denied'
      ? 'This browser has not granted persistent storage, so your notes could be cleared automatically.'
      : exportStale
        ? 'Your notes have not been exported recently.'
        : 'Your notes live in this browser only.';

  return (
    <aside className="durability" data-testid="durability" role="status">
      <p className="durability__text">{message}</p>
      <div className="durability__actions">
        {fileSystemAccessSupported() && !mirroring && (
          <button
            type="button"
            className="durability__action"
            data-testid="choose-folder"
            onClick={onChooseFolder}
            title="Keep a copy as .md files in a folder you choose"
          >
            Save to a folder
          </button>
        )}
        <button
          type="button"
          className="durability__action"
          data-testid="durability-export"
          onClick={onExport}
        >
          Export now
        </button>
        <button
          type="button"
          className="durability__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
