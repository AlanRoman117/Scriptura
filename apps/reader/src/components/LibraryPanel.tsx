import { useRef, useMemo } from 'react';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { ConfirmButton } from './ConfirmButton';
import type { CatalogEntry } from '../lib/library';
import { downloadPercent, formatBytes } from '../lib/library';
import { DEFAULT_TRANSLATION } from '../lib/api';

/** A download in flight, as a fraction plus the bytes behind it. */
export interface DownloadState {
  received: number;
  total: number;
  error?: string;
}

interface LibraryPanelProps {
  catalog: CatalogEntry[];
  installed: string[];
  active: string;
  compareWith: string[];
  downloads: Record<string, DownloadState>;
  storage: { usage: number; quota: number } | null;
  onRead: (id: string) => void;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
  onCompare: (id: string) => void;
  onClose: () => void;
}

const LICENSE_LABEL: Record<string, string> = {
  'public-domain': 'Public domain',
  'cc-by-sa-4.0': 'CC BY-SA 4.0',
  cc0: 'CC0',
  'custom-free': 'Free licence',
};

/**
 * Which translations exist, which are on this device, and what they cost.
 *
 * Eleven translations is roughly 65MB of JSON, so nothing is fetched in bulk
 * and every download is reversible. Sizes are shown *before* committing to one,
 * because "download" on a phone is a decision, not a formality.
 */
export function LibraryPanel({
  catalog,
  installed,
  active,
  compareWith,
  downloads,
  storage,
  onRead,
  onDownload,
  onRemove,
  onCompare,
  onClose,
}: LibraryPanelProps) {
  // Grouped by language: the reason to add a translation is usually to read it
  // in another one, and eleven flat rows buries that.
  //
  // `metadata.json` stores an ISO code, so the headings would otherwise read
  // "en", "ja", "fr", "es" — correct data, useless as a heading. `Intl` turns
  // them into names in the reader's *own* language, with no table to maintain.
  const byLanguage = useMemo(() => {
    const groups = new Map<string, CatalogEntry[]>();
    for (const t of catalog) {
      const name = languageName(t.language);
      const list = groups.get(name) ?? [];
      list.push(t);
      groups.set(name, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const localBytes = catalog
    .filter((t) => installed.includes(t.id))
    .reduce((n, t) => n + (t.approxBytes ?? 0), 0);

  const root = useRef<HTMLElement>(null);
  // Only mounted while open: Escape closes it, and focus returns to the
  // control that opened it when it unmounts (2.4.3).
  useDismissable(true, onClose, root, { outside: false });
  useReturnFocus(true, '[data-testid="library-open"]');

  return (
    <section ref={root} className="library" id="library-panel" data-testid="library-panel" aria-label="Translations">
      <header className="library__bar">
        <h1 className="library__title">Translations</h1>
        <button
          type="button"
          className="library__close"
          data-testid="library-close"
          onClick={onClose}
          aria-label="Close translations"
        >
          ✕
        </button>
      </header>

      {/* The browser's own figure when it will give one, and only then the
          build-time estimate. Showing both put "about 17.4 MB" beside "7.7 MB
          used" — two numbers for one question, inviting the reader to work out
          which is lying. */}
      <p className="library__storage" data-testid="library-storage">
        {installed.length} on this device ·{' '}
        {storage && storage.quota > 0
          ? `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)} used`
          : `about ${formatBytes(localBytes)}`}
      </p>

      {byLanguage.map(([language, entries]) => (
        <section className="library__group" key={language}>
          <h2 className="library__language">{language}</h2>
          <ul className="library__list" role="list">
            {entries.map((t) => {
              const here = installed.includes(t.id);
              const busy = downloads[t.id];
              const isActive = t.id === active;
              const comparing = compareWith.includes(t.id);

              return (
                <li className="library__item" key={t.id} data-testid={`library-${t.id}`}>
                  <div className="library__meta">
                    <span className="library__name">
                      {t.name}
                      {isActive && <span className="library__badge">Reading</span>}
                      {comparing && <span className="library__badge">Comparing</span>}
                    </span>
                    <span className="library__detail">
                      {t.id.toUpperCase()} · {LICENSE_LABEL[t.license] ?? t.license}
                      {t.year ? ` · ${t.year}` : ''}
                      {t.approxBytes ? ` · ~${formatBytes(t.approxBytes)}` : ''}
                    </span>
                    {busy?.error && (
                      <span className="library__error" role="alert" data-testid={`library-error-${t.id}`}>
                        {busy.error}
                      </span>
                    )}
                    {busy && !busy.error && (
                      <span
                        className="library__progress"
                        data-testid={`library-progress-${t.id}`}
                        role="progressbar"
                        aria-label={`Downloading ${t.name}`}
                        aria-valuenow={Math.round(percent(busy))}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={`${Math.round(percent(busy))}%`}
                      >
                        <span
                          className="library__progress-fill"
                          style={{ width: `${percent(busy)}%` }}
                        />
                      </span>
                    )}
                  </div>

                  <div className="library__actions">
                    {here ? (
                      <>
                        <button
                          type="button"
                          className="library__action"
                          data-testid={`library-read-${t.id}`}
                          disabled={isActive}
                          onClick={() => onRead(t.id)}
                        >
                          {isActive ? 'Reading' : 'Read'}
                        </button>
                        <button
                          type="button"
                          className="library__action"
                          data-testid={`library-compare-${t.id}`}
                          disabled={isActive}
                          aria-pressed={comparing}
                          title="Show beside the translation you are reading"
                          onClick={() => onCompare(t.id)}
                        >
                          {comparing ? 'Comparing' : 'Compare'}
                        </button>
                        {/* The bundled default has no Remove: deleting it
                            leaves nothing to read the moment the network goes,
                            which is the state this app exists to survive. */}
                        {t.id !== DEFAULT_TRANSLATION && (
                          // A multi-megabyte download goes in two presses (3.3.6).
                          <ConfirmButton
                            label="Remove"
                            className="library__action library__action--danger"
                            data-testid={`library-remove-${t.id}`}
                            aria-label={
                              isActive
                                ? `Remove ${t.name} — switch to another translation first`
                                : `Remove ${t.name} from this device`
                            }
                            disabled={isActive}
                            onConfirm={() => onRemove(t.id)}
                          />
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="library__action library__action--primary"
                        data-testid={`library-get-${t.id}`}
                        disabled={!!busy && !busy.error}
                        onClick={() => onDownload(t.id)}
                      >
                        {busy && !busy.error ? `${Math.round(percent(busy))}%` : 'Download'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="library__note">
        Downloaded text stays on this device and is readable offline. Removing a
        translation never touches your notes or marks — both are anchored to the
        passage, not to a translation.
      </p>
    </section>
  );
}

const percent = (d: DownloadState): number => downloadPercent(d.received, d.total);

/** "es" → "Spanish", in whatever language the reader's browser is set to. */
function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'language' }).of(code) ?? code;
  } catch {
    // Intl.DisplayNames is widely supported but not universally; an ISO code is
    // a poor heading, not a broken one.
    return code;
  }
}
