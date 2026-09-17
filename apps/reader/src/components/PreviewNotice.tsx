import { useState } from 'react';
import { useI18n } from '../i18n';
import { rich } from '../i18n/rich';
import { feedbackUrl } from '../lib/feedback';
import { settleFocus } from '../lib/focus';
import { PREVIEW, VERSION, hidePreview, previewHidden } from '../lib/preview';

/**
 * Says this is a preview, and where a correction goes.
 *
 * Shown only in a build for the translation reviewers. The link opens the
 * issue form in the interface language, with this build's version filled in,
 * in a new tab. It says so before it is followed (3.2.5): the arrow shows it,
 * and its name, which starts with its visible words (2.5.3), says where it
 * goes and how (2.4.9). The words on screen are short so that the link and
 * Hide share a line on a phone; Help carries the whole sentence. "Hide" is
 * remembered per version, and Help keeps the link either way.
 *
 * A named complementary landmark beside the storage notice, for the same
 * reason that one is: it is on the page when the page loads.
 */
export function PreviewNotice() {
  const { t, locale } = useI18n();
  const [hidden, setHidden] = useState(() => previewHidden(VERSION));
  if (!PREVIEW || hidden) return null;

  return (
    <aside className="preview-notice" data-testid="preview-notice" aria-label={t.previewBuild.label}>
      <p className="preview-notice__text">{rich(t.previewBuild.intro)}</p>
      <div className="preview-notice__actions">
        <a
          className="preview-notice__link"
          data-testid="preview-feedback"
          href={feedbackUrl(locale, VERSION)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="preview-notice__words">{t.previewBuild.reportShort}</span>
          <span aria-hidden="true">↗</span>
          <span className="visually-hidden"> {t.previewBuild.newTab}</span>
        </a>
        <button
          type="button"
          className="preview-notice__hide"
          data-testid="preview-hide"
          onClick={(e) => {
            // The notice goes, and focus with it: on to what comes next.
            settleFocus(e.currentTarget, { to: ['[data-testid="durability"] button', '[data-testid="book-select"]'] });
            hidePreview(VERSION);
            setHidden(true);
          }}
        >
          {t.previewBuild.hide}
        </button>
      </div>
    </aside>
  );
}
