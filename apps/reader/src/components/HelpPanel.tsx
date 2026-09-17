import { useRef } from 'react';
import type { CatalogEntry } from '../lib/library';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { useI18n } from '../i18n';
import { rich } from '../i18n/rich';
import type { BookExample } from '../i18n/types';

interface HelpPanelProps {
  catalog: CatalogEntry[];
  /** John's name and abbreviation in the open translation, so every example resolves. */
  book: BookExample;
  onClose: () => void;
}

/**
 * Help (3.3.5), in plain words, reachable from the same place in every state
 * (3.2.6). It explains how to find a passage, how searching works, what the
 * colours and boards are, what the keyboard does, what every abbreviation
 * means (3.1.4), and what the words used in this app mean (3.1.3). The last
 * section is the accessibility statement: what the app promises, and what it
 * does not.
 *
 * The words are the interface language's (see `help` in the catalogs); the
 * reference examples use the book names of the translation being read, so an
 * example never suggests something the open Bible cannot find.
 */
export function HelpPanel({ catalog, book, onClose }: HelpPanelProps) {
  const { t, fmt } = useI18n();
  const words = t.help;
  const root = useRef<HTMLElement>(null);
  useDismissable(true, onClose, root, { outside: false });
  useReturnFocus(true, '[data-testid="help-open"]');

  const translations = [...catalog].sort((a, b) => fmt.compare(a.id, b.id));

  return (
    <section ref={root} className="help" id="help-panel" data-testid="help-panel" aria-label={words.title}>
      <header className="help__bar">
        <h1 className="help__title">{words.title}</h1>
        <button type="button" className="help__close" data-testid="help-close" onClick={onClose} aria-label={words.close}>
          ✕
        </button>
      </header>

      {words.sections(book).map((section) => (
        <section className="help__section" key={section.id} data-section={section.id}>
          <h2>{section.heading}</h2>
          {section.blocks.map((block, i) =>
            'p' in block ? (
              <p key={i}>{rich(block.p)}</p>
            ) : (
              <ul key={i}>
                {block.ul.map((item, j) => (
                  <li key={j}>{rich(item)}</li>
                ))}
              </ul>
            )
          )}
        </section>
      ))}

      <section className="help__section">
        <h2>{words.abbreviations}</h2>
        <table className="help__table">
          <caption className="visually-hidden">{words.abbreviationsCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{words.short}</th>
              <th scope="col">{words.meaning}</th>
            </tr>
          </thead>
          <tbody>
            {translations.map((entry) => (
              <tr key={entry.id}>
                <th scope="row"><abbr>{entry.id.toUpperCase()}</abbr></th>
                <td>
                  {entry.name}
                  {entry.year ? ` (${entry.year})` : ''}
                </td>
              </tr>
            ))}
            {words.terms.map(([short, meaning]) => (
              <tr key={short}>
                <th scope="row"><abbr>{short}</abbr></th>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="help__section">
        <h2>{words.glossaryHeading}</h2>
        <dl className="help__glossary">
          {words.glossary.map(([term, meaning]) => (
            <div key={term} className="help__term">
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="help__section" data-testid="help-accessibility">
        <h2>{words.accessibilityHeading}</h2>
        {words.accessibility.map((paragraph, i) => (
          <p key={i}>{rich(paragraph)}</p>
        ))}
      </section>
    </section>
  );
}
