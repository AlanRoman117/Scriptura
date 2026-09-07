import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bible } from '@scriptura/core/types';
import { Layout } from './components/Layout';
import { BiblePane } from './components/BiblePane';
import { NotesPane } from './components/NotesPane';
import { DurabilityBanner, type Persistence } from './components/DurabilityBanner';
import { DEFAULT_TRANSLATION, loadTranslation, type LoadStage } from './lib/translation';
import { requestPersistence, storageEstimate } from './lib/db';
import {
  MAX_COMPARE,
  downloadTranslation,
  installedIds,
  loadCatalog,
  loadPrefs,
  removeTranslation,
  savePrefs,
  type CatalogEntry,
} from './lib/library';
import { LibraryPanel, type DownloadState } from './components/LibraryPanel';
import { ComparePane } from './components/ComparePane';
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

  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [compareWith, setCompareWith] = useState<string[]>([]);
  const [compareBibles, setCompareBibles] = useState<Record<string, Bible>>({});

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

    // The stored choice decides what to open, so it is read first. A stored
    // translation that has since been removed falls back to the bundled one
    // rather than showing an error screen — the app must always have something
    // to read.
    void loadPrefs().then(async (prefs) => {
      if (cancelled) return;
      const wanted = prefs.active ?? DEFAULT_TRANSLATION;
      setCompareWith((prefs.compareWith ?? []).slice(0, MAX_COMPARE));

      for (const id of [wanted, DEFAULT_TRANSLATION]) {
        try {
          const loaded = await loadTranslation(id, (st) => !cancelled && setStage(st));
          if (cancelled) return;
          setBible(loaded);
          setTranslationId(id);
          // Re-read after loading, not only before: on a first run the bundled
          // translation is written to IndexedDB *by* this call, so a listing
          // taken beforehand shows the library nothing — including the copy the
          // reader is at that moment reading from.
          void installedIds().then((ids) => !cancelled && setInstalled(ids));
          void storageEstimate().then((e) => !cancelled && setStorage(e));
          return;
        } catch (e: unknown) {
          if (id === DEFAULT_TRANSLATION && !cancelled) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }
      }
    });

    void loadCatalog().then((c) => !cancelled && setCatalog(c));
    void installedIds().then((ids) => !cancelled && setInstalled(ids));
    void storageEstimate().then((e) => !cancelled && setStorage(e));

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

  // Compared translations are read from IndexedDB — they are only offerable
  // once installed — so this never touches the network.
  useEffect(() => {
    let cancelled = false;
    for (const id of compareWith) {
      if (compareBibles[id]) continue;
      void loadTranslation(id)
        .then((loaded) => !cancelled && setCompareBibles((c) => ({ ...c, [id]: loaded })))
        .catch(() => {
          // A translation that will not load is dropped from the comparison
          // rather than leaving a column that never arrives.
          if (!cancelled) setCompareWith((current) => current.filter((x) => x !== id));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [compareWith, compareBibles]);

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

  const refreshLocal = useCallback(() => {
    void installedIds().then(setInstalled);
    void storageEstimate().then(setStorage);
  }, []);

  /** Read a translation that is already on the device. */
  const readTranslation = useCallback(
    (id: string) => {
      setStage('cache');
      void loadTranslation(id)
        .then((loaded) => {
          setBible(loaded);
          setTranslationId(id);
          setLibraryOpen(false);
          // Reading it and comparing against it are the same column, so drop
          // the duplicate rather than showing the text twice.
          setCompareWith((current) => {
            const next = current.filter((x) => x !== id);
            void savePrefs({ active: id, compareWith: next });
            return next;
          });
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    },
    []
  );

  const download = useCallback(
    (id: string) => {
      const approx = catalog.find((t) => t.id === id)?.approxBytes;
      setDownloads((d) => ({ ...d, [id]: { received: 0, total: approx ?? 0 } }));

      void downloadTranslation(
        id,
        (received, total) => setDownloads((d) => ({ ...d, [id]: { received, total } })),
        approx
      )
        .then(() => {
          setDownloads(({ [id]: _done, ...rest }) => rest);
          refreshLocal();
        })
        .catch((e: unknown) => {
          // Kept on the row rather than thrown: one failed download must not
          // take down a library the rest of which is perfectly usable, and
          // "you are offline" is the likeliest cause.
          setDownloads((d) => ({
            ...d,
            [id]: {
              received: 0,
              total: 0,
              error: navigator.onLine
                ? e instanceof Error
                  ? e.message
                  : String(e)
                : 'No connection — try again when you are online.',
            },
          }));
        });
    },
    [catalog, refreshLocal]
  );

  const removeFromDevice = useCallback(
    (id: string) => {
      void removeTranslation(id).then((removed) => {
        if (!removed) return;
        setCompareBibles(({ [id]: _gone, ...rest }) => rest);
        setCompareWith((current) => {
          const next = current.filter((x) => x !== id);
          void savePrefs({ active: translationId, compareWith: next });
          return next;
        });
        refreshLocal();
      });
    },
    [translationId, refreshLocal]
  );

  const toggleCompare = useCallback(
    (id: string) => {
      setCompareWith((current) => {
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id].slice(-MAX_COMPARE);
        void savePrefs({ active: translationId, compareWith: next });
        return next;
      });
      setLibraryOpen(false);
    },
    [translationId]
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

  /** The active translation first, then each comparison that has loaded. */
  const comparing = bible
    ? [bible, ...compareWith.map((id) => compareBibles[id]).filter((b): b is Bible => !!b)]
    : [];

  /** Quote one column of a comparison, in that column's own words. */
  const quoteFrom = (id: string, verse: number) => {
    const from = comparing.find((b) => b.meta.id === id);
    const book = from?.book(position.bookSlug);
    const v = book?.chapters
      .find((c) => c.number === position.chapter)
      ?.verses.find((x) => x.number === verse);
    if (!from || !book || !v) return;
    insertIntoNote(quotePassage(from, book, position.chapter, [v]), { focus: true });
  };

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
            onToggleMarks={() => {
              setLibraryOpen(false);
              setMarksOpen((o) => !o);
            }}
            libraryOpen={libraryOpen}
            onToggleLibrary={() => {
              setMarksOpen(false);
              setLibraryOpen((o) => !o);
            }}
            overlay={
              marksOpen ? (
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
              ) : libraryOpen ? (
                <LibraryPanel
                  catalog={catalog}
                  installed={installed}
                  active={translationId}
                  compareWith={compareWith}
                  downloads={downloads}
                  storage={storage}
                  onRead={readTranslation}
                  onDownload={download}
                  onRemove={removeFromDevice}
                  onCompare={toggleCompare}
                  onClose={() => setLibraryOpen(false)}
                />
              ) : null
            }
            compare={
              comparing.length > 1 ? (
                <ComparePane
                  bibles={comparing}
                  bookSlug={position.bookSlug}
                  chapter={position.chapter}
                  onDrop={toggleCompare}
                  onQuote={quoteFrom}
                />
              ) : null
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
