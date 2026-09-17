import type { CatalogEntry } from '../lib/library';
import type { DownloadState } from './LibraryPanel';
import { downloadPercent } from '../lib/units';
import { useI18n } from '../i18n';
import { primaryLanguage } from '../i18n/locales';

interface BibleOfferProps {
  entries: CatalogEntry[];
  downloads: Record<string, DownloadState>;
  onDownloadAndRead: (id: string) => void;
  onShowLibrary: () => void;
  onDismiss: () => void;
}

/**
 * Bibles in the reader's own language, offered once the interface is in it.
 *
 * A notice above the chapter, not a dialog: it takes no focus, blocks
 * nothing and waits as long as the reader likes (2.2.3). Each Bible says
 * what it weighs before anything is fetched, and its button says that it
 * will download *and* open it, since opening is a change of context the
 * reader should ask for (3.2.5). It goes away once a Bible in the language
 * is installed, or when the reader says not now.
 */
export function BibleOffer({ entries, downloads, onDownloadAndRead, onShowLibrary, onDismiss }: BibleOfferProps) {
  const { t, fmt, locale } = useI18n();
  if (entries.length === 0) return null;
  const language = fmt.languageWord(primaryLanguage(locale));

  return (
    <aside className="offer" data-testid="bible-offer" aria-labelledby="bible-offer-title">
      <p className="offer__title" id="bible-offer-title">
        {t.offer.title(language)}
      </p>
      <p className="offer__text">{t.offer.intro}</p>
      <ul className="offer__list" role="list">
        {entries.map((entry) => {
          const busy = downloads[entry.id];
          const working = !!busy && !busy.error;
          return (
            <li className="offer__item" key={entry.id} data-testid={`offer-${entry.id}`}>
              <span className="offer__meta">
                <span className="offer__name">{entry.name}</span>
                <span className="offer__detail">
                  {[entry.year, entry.approxBytes ? `~${fmt.bytes(entry.approxBytes)}` : null].filter(Boolean).join(' · ')}
                </span>
                {busy?.error && (
                  <span className="offer__error" role="alert" data-testid={`offer-error-${entry.id}`}>
                    {busy.error}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="offer__action offer__action--primary"
                data-testid={`offer-get-${entry.id}`}
                aria-label={working ? undefined : t.offer.downloadAndReadName(entry.name)}
                disabled={working}
                onClick={() => onDownloadAndRead(entry.id)}
              >
                {working
                  ? fmt.percent(Math.round(downloadPercent(busy.received, busy.total)))
                  : t.offer.downloadAndRead}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="offer__actions">
        <button type="button" className="offer__action" data-testid="offer-library" onClick={onShowLibrary}>
          {t.offer.allTranslations}
        </button>
        <button type="button" className="offer__action" data-testid="offer-dismiss" onClick={onDismiss}>
          {t.offer.notNow}
        </button>
      </div>
    </aside>
  );
}
