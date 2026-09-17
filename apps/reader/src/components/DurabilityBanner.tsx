import { fileSystemAccessSupported } from '../lib/export';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
  // A folder mirror on disk outranks anything the browser can promise.
  if (mirroring && !exportStale) return null;
  if (persistence === 'persisted' && !exportStale && !fileSystemAccessSupported()) return null;

  const message =
    persistence === 'denied'
      ? t.durability.denied
      : exportStale
        ? t.durability.stale
        : t.durability.local;

  return (
    // A named complementary landmark, not a live region: it is on the page
    // when the page loads, and a region that is already there is not
    // announced anyway — while `role="status"` on an <aside> is a role the
    // element may not take (axe: aria-allowed-role).
    <aside className="durability" data-testid="durability" aria-label={t.durability.label}>
      <p className="durability__text">{message}</p>
      <div className="durability__actions">
        {fileSystemAccessSupported() && !mirroring && (
          <button
            type="button"
            className="durability__action"
            data-testid="choose-folder"
            onClick={onChooseFolder}
            title={t.durability.saveFolderTitle}
          >
            {t.durability.saveFolder}
          </button>
        )}
        <button
          type="button"
          className="durability__action"
          data-testid="durability-export"
          onClick={onExport}
        >
          {t.durability.exportNow}
        </button>
        <button
          type="button"
          className="durability__dismiss"
          onClick={onDismiss}
          aria-label={t.durability.dismiss}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
