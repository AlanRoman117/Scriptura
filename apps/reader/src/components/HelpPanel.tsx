import { useRef } from 'react';
import type { CatalogEntry } from '../lib/library';
import { useDismissable, useReturnFocus } from '../lib/focus';

interface HelpPanelProps {
  catalog: CatalogEntry[];
  onClose: () => void;
}

/** Abbreviations that are not translation IDs. */
const TERMS: [string, string][] = [
  ['CC BY-SA 4.0', 'Creative Commons Attribution–ShareAlike 4.0: a free licence that asks you to credit the source and share changes under the same terms.'],
  ['CC0', 'Creative Commons Zero: the author has waived all rights; the text is free to use.'],
  ['OT', 'Old Testament.'],
  ['NT', 'New Testament.'],
  ['PWA', 'Progressive web app: a website you can install and use offline.'],
  ['WCAG', 'Web Content Accessibility Guidelines, the standard this app is measured against.'],
];

const GLOSSARY: [string, string][] = [
  ['Collection', 'Every verse you mark in one colour. Name a colour for the subject you are following, and the Marks panel lists those verses in Bible order.'],
  ['Board', 'A space where verses and notes are laid out as cards and joined with arrows. Boards are saved and exported with your notes.'],
  ['Card', 'One item on a board: a verse, a note, or text you typed. A verse card shows the verse from whichever translation you are reading.'],
  ['Translation', 'One version of the Bible, in one language. Every translation here is free to copy.'],
  ['Whole words only', 'A search option. With it on, "love" finds love but not loveth. With it off, it finds both.'],
  ['Match case', 'A search option. With it on, "God" and "god" are different.'],
  ['Mirror to a folder', 'Keep a copy of your notes as text files in a folder on this computer, updated as you write. Works in Chrome and Edge.'],
  ['Assistant tools', 'A way for an AI assistant running in your browser to read your library and suggest notes or marks. Off unless you turn it on; nothing is saved without your approval.'],
];

/**
 * Help (3.3.5), in plain words, reachable from the same place in every state
 * (3.2.6). It explains how to find a passage, how searching works, what the
 * colours and boards are, what the keyboard does, what every abbreviation
 * means (3.1.4), and what the words used in this app mean (3.1.3). The last
 * section is the accessibility statement: what the app promises, and what it
 * does not.
 */
export function HelpPanel({ catalog, onClose }: HelpPanelProps) {
  const root = useRef<HTMLElement>(null);
  useDismissable(true, onClose, root, { outside: false });
  useReturnFocus(true, '[data-testid="help-open"]');

  const translations = [...catalog].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <section ref={root} className="help" id="help-panel" data-testid="help-panel" aria-label="Help">
      <header className="help__bar">
        <h1 className="help__title">Help</h1>
        <button type="button" className="help__close" data-testid="help-close" onClick={onClose} aria-label="Close help">
          ✕
        </button>
      </header>

      <section className="help__section">
        <h2>Finding a passage</h2>
        <p>Type a reference in the search box and press Enter. All of these work:</p>
        <ul>
          <li><code>John 3:16</code> — one verse.</li>
          <li><code>John 3:16-18</code> — a range of verses.</li>
          <li><code>John 3</code> — a whole chapter.</li>
          <li><code>Juan 3:16</code> or <code>Jean 3:16</code> — the book name in the translation you are reading.</li>
          <li><code>Jhn 3:16</code> — an abbreviation. <code>43 3:16</code> — the book number.</li>
        </ul>
        <p>You can also pick the book and chapter from the two menus in the bar.</p>
      </section>

      <section className="help__section">
        <h2>Searching</h2>
        <p>Anything that is not a reference is a search. Search looks inside words, so <code>love</code> also finds <em>loveth</em> and <em>beloved</em>. Accents do not matter: <code>amo</code> finds <em>amó</em>.</p>
        <ul>
          <li>Put a phrase in quotes to find it exactly: <code>"in the beginning"</code>.</li>
          <li>Put a minus sign before a word to leave verses with it out: <code>God -love</code>.</li>
          <li><strong>Whole words only</strong> stops the search looking inside longer words.</li>
          <li><strong>Match case</strong> makes capital letters matter.</li>
        </ul>
        <p>The first results are verses where your word stands alone; verses where it sits inside a longer word come after a line that says so. Press Enter on a search to see every match, counted by book.</p>
      </section>

      <section className="help__section">
        <h2>Notes</h2>
        <p>Notes are plain text with Markdown. The toolbar above the note adds headings, bold, italic, lists and quotes; press a tool again to take the formatting off. <strong>Preview</strong> shows the note as it will read.</p>
        <p>A link to a passage looks like <code>[[john 3:16]]</code>. Add <code>@kjv</code> to say which translation: <code>[[john 3:16@kjv]]</code>. Put the cursor inside a link and a <strong>Go to</strong> button opens it. <strong>Quote</strong> beside a verse copies the verse into your note with its reference and a link.</p>
        <p>Notes are saved on this device as you type. <strong>Export</strong> downloads every note and board as text files in a zip.</p>
      </section>

      <section className="help__section">
        <h2>Marks</h2>
        <p>Press a verse, or its number, to mark it in one of five colours. Each colour is a collection: name it for the subject you are following, and the <strong>Marks</strong> panel lists its verses in Bible order. Marks follow the passage, not the translation, so a mark made in one translation shows in all of them.</p>
        <p>In Settings you can add a symbol to every mark, so colour is not the only sign.</p>
      </section>

      <section className="help__section">
        <h2>Boards</h2>
        <p>A board lays verses and notes out as cards you can move and join with arrows. <strong>Canvas</strong> beside a verse puts it on the current board. Cards hold a reference, not a copy of the text, so they show the translation you are reading.</p>
        <p>To move or resize a card without dragging, use its <strong>✥</strong> button; to colour it, its colour button. The arrow buttons beside the zoom move the view. <strong>Connections</strong>, in the board's bar, lists every arrow in words and removes one. Removing a card asks first, and removing a card or a connection can be undone until you change something else.</p>
      </section>

      <section className="help__section">
        <h2>Translations</h2>
        <p>The library lists every translation, grouped by language, with its size. Download one to read it offline; <strong>Compare</strong> shows it beside the one you are reading, verse by verse. Removing a translation never touches your notes or marks.</p>
      </section>

      <section className="help__section">
        <h2>Keyboard</h2>
        <ul>
          <li><kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> move between controls. The first press offers to skip to the text or the notes.</li>
          <li><kbd>Escape</kbd> closes whatever opened last: a panel, the verse actions, the search suggestions.</li>
          <li><kbd>Enter</kbd> on a verse number opens its actions; the arrow keys move along them.</li>
          <li>On the divider between the panes, the arrow keys, <kbd>Home</kbd> and <kbd>End</kbd> resize; the two small buttons do the same.</li>
          <li>In a note, <kbd>Shift</kbd>+<kbd>Tab</kbd> reaches the formatting tools; the arrow keys move between them.</li>
          <li>On a board, cards take focus: the arrow keys move a card, <kbd>Alt</kbd> with an arrow resizes it, and <kbd>Delete</kbd> asks to remove it. With the board itself focused, the arrow keys move the view and <kbd>+</kbd> and <kbd>−</kbd> zoom.</li>
        </ul>
      </section>

      <section className="help__section">
        <h2>Abbreviations</h2>
        <table className="help__table">
          <caption className="visually-hidden">What each abbreviation means</caption>
          <thead>
            <tr>
              <th scope="col">Short</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {translations.map((t) => (
              <tr key={t.id}>
                <th scope="row"><abbr>{t.id.toUpperCase()}</abbr></th>
                <td>
                  {t.name}
                  {t.year ? ` (${t.year})` : ''}
                </td>
              </tr>
            ))}
            {TERMS.map(([short, meaning]) => (
              <tr key={short}>
                <th scope="row"><abbr>{short}</abbr></th>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="help__section">
        <h2>Words used here</h2>
        <dl className="help__glossary">
          {GLOSSARY.map(([term, meaning]) => (
            <div key={term} className="help__term">
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="help__section" data-testid="help-accessibility">
        <h2>Accessibility</h2>
        <p>This app aims to meet the Web Content Accessibility Guidelines 2.2 at Level AAA for everything the app itself shows: its controls, its text, its colours and its behaviour. Every control can be reached by keyboard, is at least 44 by 44 pixels, shows where focus is, and has a name. Text is at least 7:1 against its background in every colour theme, and you can change the size, spacing and colours in Settings.</p>
        <p>Two things are outside that promise. The Bible text is shown as it was published: how hard it is to read, and how its words are said, belong to each translation, not to this app. The same is true of what you write in your notes.</p>
        <p>What is checked by machine is checked on every change. What needs a person — a screen reader on a phone, the app under a Windows contrast theme — is checked by hand, less often. If something does not work for you, please report it at the project's issue tracker on GitHub (<code>AlanRoman117/scriptura</code>).</p>
      </section>
    </section>
  );
}
