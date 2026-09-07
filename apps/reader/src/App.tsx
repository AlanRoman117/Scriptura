import { useEffect, useState } from 'react';
import type { Bible } from '@scriptura/core/types';
import { Layout } from './components/Layout';
import { BiblePane } from './components/BiblePane';
import { NotesPane } from './components/NotesPane';
import { loadTranslation, type LoadStage } from './lib/translation';
import { requestPersistence } from './lib/db';

interface Position {
  bookSlug: string;
  chapter: number;
}

export function App() {
  const [bible, setBible] = useState<Bible | null>(null);
  const [stage, setStage] = useState<LoadStage>('cache');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>({ bookSlug: 'john', chapter: 1 });

  useEffect(() => {
    let cancelled = false;
    loadTranslation(undefined, (s) => !cancelled && setStage(s))
      .then((b) => !cancelled && setBible(b))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    // Asked once, on load rather than on first write, because the translation
    // cache is itself several megabytes worth protecting from eviction.
    void requestPersistence();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="boot boot--error" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!bible) {
    return (
      <div className="boot" role="status" aria-live="polite">
        <p>{stage === 'download' ? 'Downloading the text for offline use…' : 'Opening…'}</p>
      </div>
    );
  }

  const book = bible.book(position.bookSlug) ?? bible.books[0];

  return (
    <Layout
      bible={
        <BiblePane
          bible={bible}
          book={book}
          chapter={position.chapter}
          onNavigate={(bookSlug, chapter) => setPosition({ bookSlug, chapter })}
        />
      }
      notes={<NotesPane />}
    />
  );
}
