import type { Bible, LoadedBook } from '@scriptura/core/types';
import { requiresAttribution } from '../lib/translation';

interface BiblePaneProps {
  bible: Bible;
  book: LoadedBook;
  chapter: number;
  onNavigate: (bookSlug: string, chapter: number) => void;
}

export function BiblePane({ bible, book, chapter, onNavigate }: BiblePaneProps) {
  const current = book.chapters.find((c) => c.number === chapter);
  const meta = bible.meta;

  return (
    <div className="reader">
      <header className="reader__bar">
        <select
          className="reader__select"
          aria-label="Book"
          data-testid="book-select"
          value={book.slug}
          onChange={(e) => onNavigate(e.target.value, 1)}
        >
          {bible.books.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className="reader__select reader__select--chapter"
          aria-label="Chapter"
          data-testid="chapter-select"
          value={chapter}
          onChange={(e) => onNavigate(book.slug, Number(e.target.value))}
        >
          {book.chapters.map((c) => (
            <option key={c.number} value={c.number}>
              {c.number}
            </option>
          ))}
        </select>
        <span className="reader__translation" title={meta.name}>
          {meta.id.toUpperCase()}
        </span>
      </header>

      <article className="chapter" data-testid="chapter">
        <h1 className="chapter__title">
          {book.name} {chapter}
        </h1>
        {current ? (
          <div className="chapter__text">
            {current.verses.map((v) => (
              <p className="verse" key={v.number} data-verse={v.number}>
                {/* aria-hidden so a screen reader reads scripture as prose rather
                    than interleaving every verse number into the sentence. */}
                <sup className="verse__num" aria-hidden="true">
                  {v.number}
                </sup>
                <span className="verse__text">{v.text}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="empty">This chapter is not in {meta.name}.</p>
        )}
      </article>

      {/* CC BY-SA obliges the notice where the material appears, so it sits with
          the text rather than in an About page. Public-domain texts show nothing. */}
      {requiresAttribution(meta) && (
        <footer className="attribution" data-testid="attribution">
          {meta.attribution} ·{' '}
          <a href={meta.source_url} target="_blank" rel="noreferrer noopener">
            source
          </a>
        </footer>
      )}
    </div>
  );
}
