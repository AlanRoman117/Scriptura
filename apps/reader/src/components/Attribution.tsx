import type { TranslationMeta } from '@scriptura/core/types';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

/**
 * A link out of the app from the attribution line. It opens a new tab, and says
 * so before it is followed (3.2.5): the arrow shows it, and the name, which
 * starts with the visible words (2.5.3), says what it is and how it opens (2.4.9).
 */
function OutLink({ href, words }: { href: string; words: string }) {
  const { t } = useI18n();
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {words}
      <Icon name="arrow-up-right" />
      <span className="visually-hidden"> {t.common.opensInNewTab}</span>
    </a>
  );
}

/**
 * The credit a licence asks for, its source, and the licence itself.
 *
 * ⚠️ `lang` goes on the words, not on anything holding the links, whose names
 * are the interface's (3.1.2). These words are metadata and stay as published.
 */
export function AttributionLine({ meta }: { meta: TranslationMeta }) {
  const { t } = useI18n();
  return (
    <>
      <span lang={meta.attribution_lang ?? meta.language}>{meta.attribution}</span> ·{' '}
      <OutLink href={meta.source_url} words={t.common.source(meta.name)} />
      {meta.license_url && (
        <>
          {' '}
          · <OutLink href={meta.license_url} words={t.common.licence(meta.name)} />
        </>
      )}
    </>
  );
}

/**
 * Where a translation's licence does not hold, in the metadata's own English.
 *
 * Plain text and nothing more: there is no link to follow because there is no
 * permission to point at, and a link would suggest there was one.
 */
export function RightsNotice({ text }: { text: string }) {
  const { locale } = useI18n();
  return (
    <span data-testid="rights-notice" lang={locale === 'en-US' ? undefined : 'en'}>
      {text}
    </span>
  );
}
