import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bible } from '@scriptura/core/types';
import { Layout } from './components/Layout';
import { BiblePane } from './components/BiblePane';
import { NotesPane } from './components/NotesPane';
import { DurabilityBanner, type Persistence } from './components/DurabilityBanner';
import { loadTranslation, type LoadStage } from './lib/translation';
import { requestPersistence } from './lib/db';
import {
  exportIsStale,
  deleteHighlight,
  listHighlights,
  listNotes,
  loadColorLabels,
  newNote,
  saveColorLabels,
  saveNote,
  deleteNote as removeNote,
  toggleHighlight,
  type ColorLabels,
  type Highlight,
  type HighlightColor,
  type Note,
} from './lib/notes';
import { MarksPanel } from './components/MarksPanel';
import { chooseNotesFolder, downloadNotes, mirrorNotes, mirroring } from './lib/export';
import { SearchBar } from './components/SearchBar';
import { runQuery, resolveReference, type ResolvedReference } from './lib/search';
import { quotePassage, toWikiLink } from './lib/references';
import type { SearchResult } from '@scriptura/core/types';

interface Position {
  bookSlug: string;
  chapter: number;
}

/** Long enough not to write on every keystroke, short enough to lose nothing. */
const AUTOSAVE_MS = 600;

export function App() {
  const [bible, setBible] = useState<Bible | null>(null);
  const [stage, setStage] = useState<LoadStage>('cache');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>({ bookSlug: 'john', chapter: 1 });

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [colorLabels, setColorLabels] = useState<ColorLabels>({});
  const [marksOpen, setMarksOpen] = useState(false);

  const [persistence, setPersistence] = useState<Persistence>('unknown');
  const [isMirroring, setIsMirroring] = useState(false);
  const [staleExport, setStaleExport] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [reference, setReference] = useState<ResolvedReference | null>(null);
  const [focusVerse, setFocusVerse] = useState<number | null>(null);

  const saveTimer = useRef<number | null>(null);
  const surfaceRef = useRef<HTMLTextAreaElement | null>(null);
  /** Where to leave the cursor after an insertion, applied once React repaints. */
  const caret = useRef<{ at: number; focus: boolean } | null>(null);

  useEffect(() => {
    const pending = caret.current;
    const el = surfaceRef.current;
    if (!pending || !el) return;
    caret.current = null;
    // Focus follows a quote from the Bible — you insert, then write. It does
    // not follow an insert from the search panel: that panel stays open on
    // purpose so several results can be added in a row.
    if (pending.focus) el.focus();
    el.setSelectionRange(pending.at, pending.at);
  }, [notes, activeId]);

  useEffect(() => {
    let cancelled = false;

    loadTranslation(undefined, (s) => !cancelled && setStage(s))
      .then((b) => !cancelled && setBible(b))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));

    // Each store is read independently: a translation that fails to parse must
    // not take the user's notes with it.
    void listNotes(reportStoreFailure).then((loaded) => {
      if (cancelled) return;
      setNotes(loaded);
      setActiveId(loaded[0]?.id ?? null);
      void exportIsStale(loaded.length > 0).then((s) => !cancelled && setStaleExport(s));
    });
    void listHighlights(reportStoreFailure).then((h) => !cancelled && setHighlights(h));
    void loadColorLabels().then((l) => !cancelled && setColorLabels(l));

    void requestPersistence().then((p) => !cancelled && setPersistence(p));
    void mirroring().then((m) => !cancelled && setIsMirroring(m));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bible || !query.trim()) {
      setResults([]);
      setTotal(0);
      setReference(null);
      return;
    }
    // A reference jumps; anything else searches. Both run offline against the
    // translation already in memory.
    setReference(resolveReference(bible, query));
    const hits = runQuery(bible, query);
    setResults(hits.slice(0, 40));
    setTotal(hits.length);
  }, [bible, query]);

  /**
   * Insert at the cursor, or append when the surface is not focused.
   *
   * Always leaves a blank line after the passage and parks the cursor on it:
   * quoting is nearly always followed by writing about what was quoted, and
   * spacing it out by hand afterwards is a chore the app can just not create.
   */
  const insertIntoNote = useCallback(
    (text: string, { focus = false }: { focus?: boolean } = {}) => {
      // One blank line after, however the caller punctuated its own text.
      const block = `${text.replace(/\n+$/, '')}\n\n`;

      if (!activeId) {
        const note = newNote();
        setNotes((c) => [{ ...note, body: block }, ...c]);
        setActiveId(note.id);
        caret.current = { at: block.length, focus };
        void saveNote({ ...note, body: block });
        return;
      }
      const current = notes.find((n) => n.id === activeId);
      if (!current) return;
      const el = surfaceRef.current;
      const at = el && document.activeElement === el ? el.selectionStart : current.body.length;
      const before = current.body.slice(0, at);
      const after = current.body.slice(at);
      const spacer = before && !before.endsWith('\n') ? '\n\n' : '';
      caret.current = { at: at + spacer.length + block.length, focus };
      changeNote(activeId, { body: `${before}${spacer}${block}${after}` });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, notes]
  );

  const quoteVerse = useCallback(
    (verse: number) => {
      if (!bible) return;
      const b = bible.book(position.bookSlug);
      const ch = b?.chapters.find((c) => c.number === position.chapter);
      const v = ch?.verses.find((x) => x.number === verse);
      if (!b || !ch || !v) return;
      insertIntoNote(quotePassage(bible, b, position.chapter, [v]), { focus: true });
    },
    [bible, position, insertIntoNote]
  );

  const linkVerse = useCallback(
    (verse: number) => {
      insertIntoNote(
        toWikiLink({ book_slug: position.bookSlug, chapter: position.chapter, verse }),
        { focus: true }
      );
    },
    [position, insertIntoNote]
  );

  const goTo = useCallback((bookSlug: string, chapter: number, verse?: number) => {
    setPosition({ bookSlug, chapter });
    setFocusVerse(verse ?? null);
  }, []);

  const reportStoreFailure = (store: string, err: unknown) => {
    // Reported, not thrown: rendering what survived beats rendering nothing.
    console.warn(`Could not read "${store}" — continuing without it:`, err);
  };

  const changeNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => {
      setSaving('saving');
      setNotes((current) => {
        const next = current.map((n) =>
          n.id === id ? { ...n, ...patch, updated: Date.now() } : n
        );
        const edited = next.find((n) => n.id === id);

        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          if (!edited) return;
          void saveNote(edited, (_store, err) => {
            // Warned once per store by writeSafely — a quota failure repeats on
            // every keystroke, and a toast per keystroke trains people to
            // dismiss the one message that matters.
            console.error('Saving notes failed:', err);
          }).then((ok) => {
            setSaving(ok ? 'saved' : 'failed');
            if (ok && isMirroring) void mirrorNotes(next);
          });
        }, AUTOSAVE_MS);

        return next;
      });
    },
    [isMirroring]
  );

  const createNote = useCallback(() => {
    const note = newNote();
    setNotes((c) => [note, ...c]);
    setActiveId(note.id);
    // Creating a note is a write like any other, so it reports like one. It
    // used to save silently, which meant the very first thing a user does gave
    // no signal that anything had been stored.
    setSaving('saving');
    void saveNote(note).then((ok) => setSaving(ok ? 'saved' : 'failed'));
  }, []);

  const deleteNote = useCallback(
    (id: string) => {
      void removeNote(id);
      setNotes((current) => {
        const next = current.filter((n) => n.id !== id);
        setActiveId(next[0]?.id ?? null);
        return next;
      });
    },
    []
  );

  const doExport = useCallback(() => {
    void downloadNotes(notes).then(() => setStaleExport(false));
  }, [notes]);

  const doChooseFolder = useCallback(() => {
    void chooseNotesFolder().then((ok) => {
      if (!ok) return;
      setIsMirroring(true);
      void mirrorNotes(notes);
    });
  }, [notes]);

  const highlight = useCallback(
    (verse: number, color: HighlightColor) => {
      if (!bible) return;
      void toggleHighlight(
        {
          // Kept as provenance. The mark itself is keyed on the passage, so a
          // colour's collection survives a change of translation.
          translation: bible.meta.id,
          book_slug: position.bookSlug,
          chapter: position.chapter,
          verse,
        },
        color,
        highlights
      ).then(setHighlights);
    },
    [bible, position, highlights]
  );

  const labelColor = useCallback((color: HighlightColor, label: string) => {
    setColorLabels((current) => {
      const next = { ...current, [color]: label };
      void saveColorLabels(next);
      return next;
    });
  }, []);

  const unmark = useCallback((id: string) => {
    void deleteHighlight(id);
    setHighlights((current) => current.filter((h) => h.id !== id));
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
    <>
      {!bannerDismissed && (
        <DurabilityBanner
          persistence={persistence}
          mirroring={isMirroring}
          exportStale={staleExport}
          onChooseFolder={doChooseFolder}
          onExport={doExport}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      <Layout
        bible={
          <BiblePane
            bible={bible}
            book={book}
            chapter={position.chapter}
            highlights={highlights}
            focusVerse={focusVerse}
            onNavigate={(bookSlug, chapter) => {
              setPosition({ bookSlug, chapter });
              setFocusVerse(null);
            }}
            onHighlight={highlight}
            onQuote={quoteVerse}
            onLink={linkVerse}
            marksOpen={marksOpen}
            markCount={highlights.length}
            onToggleMarks={() => setMarksOpen((o) => !o)}
            marks={
              <MarksPanel
                bible={bible}
                highlights={highlights}
                labels={colorLabels}
                onLabel={labelColor}
                onGo={(bookSlug, chapter, verse) => {
                  goTo(bookSlug, chapter, verse);
                  setMarksOpen(false);
                }}
                onRemove={unmark}
                onClose={() => setMarksOpen(false)}
              />
            }
            search={
              <SearchBar
                query={query}
                results={results}
                reference={reference}
                total={total}
                onQuery={setQuery}
                onGo={goTo}
                onInsert={(r) => {
                  const b = bible.book(r.book_slug);
                  const ch = b?.chapters.find((c) => c.number === r.chapter);
                  const v = ch?.verses.find((x) => x.number === r.verse);
                  if (b && v) insertIntoNote(quotePassage(bible, b, r.chapter, [v]));
                }}
                onClose={() => setQuery('')}
              />
            }
          />
        }
        notes={
          <NotesPane
            notes={notes}
            activeId={activeId}
            saving={saving}
            onSelect={setActiveId}
            onCreate={createNote}
            onDelete={deleteNote}
            onChange={changeNote}
            onExport={doExport}
            onSurfaceReady={(el) => {
              surfaceRef.current = el;
            }}
          />
        }
      />
    </>
  );
}
