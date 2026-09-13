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
import { SearchResults } from './components/SearchResults';
import { CanvasView } from './components/CanvasView';
import { SettingsPanel } from './components/SettingsPanel';
import { HelpPanel } from './components/HelpPanel';
import { ProposalPreview } from './components/ProposalPreview';
import {
  configureAgent,
  isEnabled as agentIsEnabled,
  isSupported as agentIsSupported,
  setEnabled as setAgentEnabled,
  type Proposal,
} from './lib/webmcp';
import {
  boardToMarkdown,
  deleteBoard as removeBoard,
  freeSlot,
  listBoards,
  newBoard,
  nodeLabel,
  saveBoard,
  type Board,
  type BoardNode,
} from './lib/canvas';
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
import {
  runQuery,
  resolveReference,
  type MatchOptions,
  type ResolvedReference,
} from './lib/search';
import { quotePassage, resolveLink, toWikiLink } from './lib/references';
import { boardEmbed } from './lib/markdown';
import { usePrefs } from './lib/prefs';
import { useVisualViewport } from './lib/viewport';
import { announce } from './lib/announce';
import { setPendingFlush } from './lib/pending';
import type { SearchResult } from '@scriptura/core/types';

interface Position {
  bookSlug: string;
  chapter: number;
}

/** Long enough not to write on every keystroke, short enough to lose nothing. */
const AUTOSAVE_MS = 600;
/** A search is announced once the typing has paused, not per keystroke. */
const ANNOUNCE_SEARCH_MS = 400;

/**
 * Say when a panel opens or closes (4.1.3). The chapter is replaced without
 * focus moving, so a screen reader would otherwise hear nothing happen.
 * Skips the first render: nothing has opened yet.
 */
function useAnnounceOpen(open: boolean, name: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    announce(open ? `${name} opened` : `${name} closed`);
  }, [open, name]);
}

export function App() {
  const [bible, setBible] = useState<Bible | null>(null);
  const [stage, setStage] = useState<LoadStage>('cache');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>({ bookSlug: 'john', chapter: 1 });

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  /**
   * The last thing put into a note — or onto a board — from somewhere else,
   * in words ("Quoted John 1:2"), until the reader's next action. See
   * `confirmInsert`.
   */
  const [inserted, setInserted] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  /** The last mark removed from the Marks list, until the next change to any mark. */
  const [undoMark, setUndoMark] = useState<Highlight | null>(null);
  const [colorLabels, setColorLabels] = useState<ColorLabels>({});
  const [marksOpen, setMarksOpen] = useState(false);

  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Device-scoped display preferences; applied to <html> on every change.
  const [prefs, updatePrefs] = usePrefs();
  // `--vvh` / `--vv-top`: the viewport the reader sees, keyboard excluded.
  useVisualViewport();
  const [agentEnabled, setAgentOn] = useState(() => agentIsEnabled());
  /** One at a time: a second would swap the contents under an open preview. */
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [compareWith, setCompareWith] = useState<string[]>([]);
  const [compareBibles, setCompareBibles] = useState<Record<string, Bible>>({});

  const [persistence, setPersistence] = useState<Persistence>('unknown');
  const [isMirroring, setIsMirroring] = useState(false);
  const [staleExport, setStaleExport] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [query, setQuery] = useState('');
  /** Every match. The dropdown shows a slice; the results view walks them all. */
  const [hits, setHits] = useState<SearchResult[]>([]);
  /**
   * The query `hits` were computed for.
   *
   * `hits` lags `query` by one render — the effect that recomputes it runs
   * after. Carrying the query the results actually belong to lets the panel
   * label itself honestly, and lets a test wait for the count that answers the
   * question it just asked instead of the one before it.
   */
  const [hitsQuery, setHitsQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  /**
   * Not persisted, deliberately. The toggles are visible whenever the search
   * panel is open; one that quietly survived a reload is how someone ends up
   * asking why search has stopped finding anything.
   */
  const [matching, setMatching] = useState<MatchOptions>({ mode: 'substring' });
  const [reference, setReference] = useState<ResolvedReference | null>(null);
  const [focusVerse, setFocusVerse] = useState<number | null>(null);

  const saveTimer = useRef<number | null>(null);
  /**
   * Edits waiting out the autosave delay, by note. Keyed per note: a single
   * pending edit meant that typing in a second note within the delay
   * cancelled the first note's save, and its last words were never written.
   */
  const pendingSaves = useRef(new Map<string, Note>());
  const notesNow = useRef<Note[]>([]);
  const mirroringNow = useRef(false);
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
    void listBoards(reportStoreFailure).then((b) => {
      if (cancelled) return;
      setBoards(b);
      setBoardId(b[0]?.id ?? null);
    });

    void requestPersistence().then((p) => !cancelled && setPersistence(p));
    void mirroring().then((m) => !cancelled && setIsMirroring(m));

    return () => {
      cancelled = true;
    };
  }, []);

  useAnnounceOpen(marksOpen, 'Marks');
  useAnnounceOpen(libraryOpen, 'Translations');
  useAnnounceOpen(settingsOpen, 'Settings');
  useAnnounceOpen(helpOpen, 'Help');
  useAnnounceOpen(resultsOpen, 'Search results');

  // The count under the search box changes silently; say it once the typing
  // pauses. The true total, not the dropdown's slice.
  useEffect(() => {
    if (!hitsQuery) return;
    const t = window.setTimeout(() => {
      announce(
        hits.length === 0
          ? `No matches for “${hitsQuery}”`
          : `${hits.length} ${hits.length === 1 ? 'match' : 'matches'} for “${hitsQuery}”`
      );
    }, ANNOUNCE_SEARCH_MS);
    return () => window.clearTimeout(t);
  }, [hits, hitsQuery]);

  useEffect(() => {
    if (!bible || !query.trim()) {
      setHits([]);
      setHitsQuery('');
      setReference(null);
      setResultsOpen(false);
      return;
    }
    // A reference jumps; anything else searches. Both run offline against the
    // translation already in memory.
    setReference(resolveReference(bible, query));
    setHits(runQuery(bible, query, matching));
    setHitsQuery(query);
    // `matching` belongs here: without it, ticking a box leaves stale results.
  }, [bible, query, matching]);

  /**
   * Confirm an insertion in words, where it went, until the next action.
   *
   * By the time anyone looks, the control that did it has usually gone — the
   * verse actions close behind a Quote, the board closes behind "Add to note"
   * — and on a phone the note it went into is folded away under the grip. So
   * the confirmation is shown at the destination, or where the destination is
   * reached from while it is out of sight (the grip; a bar when the Bible is
   * maximized), and it is announced (4.1.3): a checkmark's alt text is only
   * read if someone happens to move onto it, which nobody does to something
   * that appeared on its own.
   *
   * Nothing clears it on a timer (2.2.3). The next insertion replaces it; an
   * edit, another note, a new chapter or bringing the notes into view clears
   * it. Those are cleared where they happen — never from an effect on the
   * active note, which would also fire for the quote that creates one and
   * wipe its confirmation in the same breath.
   */
  const confirmInsert = useCallback((shown: string, said: string = shown) => {
    setInserted(shown);
    // `force`: quoting the same verse twice is two actions, and both are news.
    announce(said, { force: true });
  }, []);
  const clearInserted = useCallback(() => setInserted(null), []);

  // A new chapter is a new action; the last confirmation has done its job.
  useEffect(() => {
    setInserted(null);
  }, [position.bookSlug, position.chapter]);

  /**
   * Insert at the cursor, or append when the surface is not focused.
   *
   * Always leaves a blank line after the passage and parks the cursor on it:
   * quoting is nearly always followed by writing about what was quoted, and
   * spacing it out by hand afterwards is a chore the app can just not create.
   */
  const insertIntoNote = useCallback(
    (text: string, done: string, { focus = false }: { focus?: boolean } = {}) => {
      // One blank line after, however the caller punctuated its own text.
      const block = `${text.replace(/\n+$/, '')}\n\n`;

      if (!activeId) {
        const note = { ...newNote(), body: block };
        setNotes((c) => [note, ...c]);
        setActiveId(note.id);
        caret.current = { at: block.length, focus };
        // Reported like every other write. It used to save silently, so the
        // one quote that started a note left its status line blank.
        setSaving('saving');
        void saveNote(note).then((ok) => setSaving(ok ? 'saved' : 'failed'));
        confirmInsert(done, `${done} in a new note`);
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
      const title = current.title.trim();
      confirmInsert(done, `${done} in ${title ? `“${title}”` : 'an untitled note'}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, notes, confirmInsert]
  );

  const quoteVerse = useCallback(
    (verse: number) => {
      if (!bible) return;
      const b = bible.book(position.bookSlug);
      const ch = b?.chapters.find((c) => c.number === position.chapter);
      const v = ch?.verses.find((x) => x.number === verse);
      if (!b || !ch || !v) return;
      insertIntoNote(quotePassage(bible, b, position.chapter, [v]), `Quoted ${b.name} ${position.chapter}:${verse}`, {
        focus: true,
      });
    },
    [bible, position, insertIntoNote]
  );

  const linkVerse = useCallback(
    (verse: number) => {
      const name = bible?.book(position.bookSlug)?.name ?? position.bookSlug;
      insertIntoNote(
        toWikiLink({
          book_slug: position.bookSlug,
          chapter: position.chapter,
          verse,
          // Which version, not only which passage: the same verse linked from
          // two translations is otherwise the same string twice.
          translation: translationId,
        }),
        `Linked ${name} ${position.chapter}:${verse}`,
        { focus: true }
      );
    },
    [bible, position, translationId, insertIntoNote]
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

  // The title says where you are (2.4.2, 2.4.8): passage and translation while
  // reading, the panel's name while one covers the text, the board in canvas.
  useEffect(() => {
    const where = canvasOpen
      ? `${boards.find((b) => b.id === boardId)?.name || 'Untitled board'} · Boards`
      : marksOpen
        ? 'Marks'
        : libraryOpen
          ? 'Translations'
          : settingsOpen
            ? 'Settings'
            : helpOpen
              ? 'Help'
            : resultsOpen
              ? 'Search results'
              : bible
                ? `${(bible.book(position.bookSlug) ?? bible.books[0]).name} ${position.chapter} · ${bible.meta.id.toUpperCase()}`
                : null;
    document.title = where ? `${where} · Scriptura` : 'Scriptura Reader';
  }, [canvasOpen, boards, boardId, marksOpen, libraryOpen, settingsOpen, helpOpen, resultsOpen, bible, position]);

  notesNow.current = notes;
  mirroringNow.current = isMirroring;

  /** Write every pending edit now. The autosave timer calls it; so does anything about to end the page. */
  const flushSaves = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const batch = [...pendingSaves.current.values()];
    pendingSaves.current.clear();
    if (batch.length === 0) return;
    const results = await Promise.all(
      batch.map((note) =>
        saveNote(note, (_store, err) => {
          // Warned once per store by writeSafely — a quota failure repeats on
          // every keystroke, and a toast per keystroke trains people to
          // dismiss the one message that matters.
          console.error('Saving notes failed:', err);
        })
      )
    );
    const ok = results.every(Boolean);
    setSaving(ok ? 'saved' : 'failed');
    if (ok && mirroringNow.current) void mirrorNotes(notesNow.current);
  }, []);

  // The update notice flushes before it reloads; a phone putting the tab in
  // the background, where the system may discard it, flushes too.
  useEffect(() => {
    setPendingFlush(flushSaves);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flushSaves();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      setPendingFlush(null);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [flushSaves]);

  const changeNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => {
      setSaving('saving');
      setNotes((current) => {
        const next = current.map((n) =>
          n.id === id ? { ...n, ...patch, updated: Date.now() } : n
        );
        const edited = next.find((n) => n.id === id);
        if (edited) pendingSaves.current.set(id, edited);

        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void flushSaves(), AUTOSAVE_MS);

        return next;
      });
    },
    [flushSaves]
  );

  const createNote = useCallback(() => {
    setInserted(null);
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
      setInserted(null);
      void removeNote(id);
      setNotes((current) => {
        const next = current.filter((n) => n.id !== id);
        setActiveId(next[0]?.id ?? null);
        return next;
      });
    },
    []
  );

  /**
   * What the agent tools may see.
   *
   * Held in a ref and re-pointed on every render, so tools registered once
   * still answer from current state rather than the closure they were built
   * with. `propose` refuses a second proposal while one is open — the preview
   * would otherwise swap contents under someone mid-review.
   */
  const agentState = useRef({ bible, notes, highlights, colorLabels, boards, translationId, installed });
  agentState.current = { bible, notes, highlights, colorLabels, boards, translationId, installed };

  /**
   * Whether a proposal is already open — held in a ref, not read from state.
   *
   * State is only current after a render, so two tool calls in the same tick
   * both saw "nothing pending" and the second replaced the first: the reader
   * would have been looking at one draft and confirming another. The guard has
   * to be true the instant it is set, which is what a ref is for.
   */
  const pendingProposal = useRef<Proposal | null>(null);

  const clearProposal = useCallback(() => {
    pendingProposal.current = null;
    setProposal(null);
  }, []);

  useEffect(() => {
    configureAgent({
      bible: () => agentState.current.bible,
      translationId: () => agentState.current.translationId,
      installed: () => agentState.current.installed,
      notes: () => agentState.current.notes,
      highlights: () => agentState.current.highlights,
      labels: () => agentState.current.colorLabels,
      boards: () => agentState.current.boards,
      propose: (next) => {
        if (pendingProposal.current) return false;
        pendingProposal.current = next;
        setProposal(next);
        return true;
      },
    });
  }, []);

  /**
   * Apply what the reader accepted — never what was proposed.
   *
   * The argument comes back from the preview, so an edited title or a verse
   * they unticked is what lands. Re-reading the staged proposal here would
   * quietly discard their review.
   */
  const acceptProposal = useCallback(
    (accepted: Proposal) => {
      clearProposal();
      if (accepted.kind === 'note') {
        setInserted(null);
        const note = { ...newNote(accepted.title), body: accepted.body };
        setNotes((c) => [note, ...c]);
        setActiveId(note.id);
        setSaving('saving');
        void saveNote(note).then((ok) => setSaving(ok ? 'saved' : 'failed'));
        return;
      }
      // Sequential rather than concurrent: each toggle derives from the list
      // before it, and firing them in parallel would have them overwrite.
      void accepted.refs
        .reduce(
          (chain, ref) =>
            chain.then((current) =>
              toggleHighlight(
                { translation: agentState.current.translationId, ...ref },
                accepted.color,
                current
              )
            ),
          Promise.resolve(agentState.current.highlights)
        )
        .then(setHighlights);
    },
    [clearProposal]
  );

  const changeBoard = useCallback((board: Board) => {
    setBoards((current) => current.map((b) => (b.id === board.id ? board : b)));
    void saveBoard(board, (_store, err) => {
      console.error('Saving the board failed:', err);
      // The notes footer says this for notes; boards had no voice at all.
      announce('Could not save the board — export your notes', { assertive: true });
    });
  }, []);

  const createBoard = useCallback(() => {
    const board = newBoard();
    setBoards((c) => [board, ...c]);
    setBoardId(board.id);
    void saveBoard(board);
  }, []);

  const deleteBoard = useCallback((id: string) => {
    void removeBoard(id);
    setBoards((current) => {
      const next = current.filter((b) => b.id !== id);
      setBoardId(next[0]?.id ?? null);
      return next;
    });
  }, []);

  /**
   * Put a verse on a board without leaving the text.
   *
   * Creates the first board rather than refusing: "add to canvas" should not
   * answer "make a canvas first" the one time someone tries it.
   */
  const sendToCanvas = useCallback(
    (verse: number) => {
      const target = boards.find((b) => b.id === boardId) ?? newBoard('Study board');
      const node: BoardNode = {
        id: crypto.randomUUID(),
        kind: 'verse',
        book_slug: position.bookSlug,
        chapter: position.chapter,
        verse,
        translation: translationId,
        ...freeSlot(target.nodes),
      };
      const already = target.nodes.some(
        (n) =>
          n.kind === 'verse' &&
          n.book_slug === node.book_slug &&
          n.chapter === node.chapter &&
          n.verse === node.verse
      );
      const next = already ? target : { ...target, nodes: [...target.nodes, node], updated: Date.now() };

      setBoards((current) =>
        current.some((b) => b.id === next.id)
          ? current.map((b) => (b.id === next.id ? next : b))
          : [next, ...current]
      );
      setBoardId(next.id);
      void saveBoard(next);

      // The board is out of sight, so this is the only sign anything happened.
      const what = `${bible?.book(position.bookSlug)?.name ?? position.bookSlug} ${position.chapter}:${verse}`;
      const where = `“${next.name || 'Untitled board'}”`;
      confirmInsert(already ? `${what} is already on ${where}` : `Added ${what} to ${where}`);
    },
    [bible, boards, boardId, position, translationId, confirmInsert]
  );

  /** A card in one line, for the export. */
  const describeCard = useCallback(
    (node: BoardNode): string => nodeLabel(node, { bible, notes }),
    [bible, notes]
  );

  /**
   * An embedded board, written out as Markdown for the export.
   *
   * In the app the fence draws the board; a `.md` opened anywhere else would
   * otherwise show a code block containing a UUID, which is worse than useless.
   */
  const renderEmbeddedBoard = useCallback(
    (id: string): string | null => {
      const board = boards.find((b) => b.id === id);
      return board ? boardToMarkdown(board, describeCard) : null;
    },
    [boards, describeCard]
  );

  const doExport = useCallback(() => {
    void downloadNotes(notes, boards, describeCard, renderEmbeddedBoard).then(() =>
      setStaleExport(false)
    );
  }, [notes, boards, describeCard, renderEmbeddedBoard]);

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
      setUndoMark(null);
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
          announce(`Reading ${loaded.meta.name}`);
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

  /** The last quarter announced per download, so progress is said four times, not four hundred. */
  const announcedQuarter = useRef<Record<string, number>>({});

  const download = useCallback(
    (id: string) => {
      const entry = catalog.find((t) => t.id === id);
      const approx = entry?.approxBytes;
      const name = entry?.name ?? id.toUpperCase();
      announcedQuarter.current[id] = 0;
      setDownloads((d) => ({ ...d, [id]: { received: 0, total: approx ?? 0 } }));

      void downloadTranslation(
        id,
        (received, total) => {
          setDownloads((d) => ({ ...d, [id]: { received, total } }));
          const quarter = total > 0 ? Math.floor(Math.min(received / total, 0.99) * 4) : 0;
          if (quarter > (announcedQuarter.current[id] ?? 0)) {
            announcedQuarter.current[id] = quarter;
            announce(`${name}: ${quarter * 25}% downloaded`);
          }
        },
        approx
      )
        .then(() => {
          setDownloads(({ [id]: _done, ...rest }) => rest);
          announce(`${name} downloaded`);
          refreshLocal();
        })
        .catch((e: unknown) => {
          // Kept on the row rather than thrown: one failed download must not
          // take down a library the rest of which is perfectly usable, and
          // "you are offline" is the likeliest cause.
          const error = navigator.onLine
            ? e instanceof Error
              ? e.message
              : String(e)
            : 'No connection — try again when you are online.';
          setDownloads((d) => ({ ...d, [id]: { received: 0, total: 0, error } }));
          announce(`${name}: ${error}`, { assertive: true });
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

  const unmark = useCallback(
    (id: string) => {
      const removed = highlights.find((h) => h.id === id) ?? null;
      void deleteHighlight(id);
      setHighlights((current) => current.filter((h) => h.id !== id));
      // Reversible, not timed: the offer stands until the next change (2.2.3, 3.3.6).
      setUndoMark(removed);
      if (removed) announce('Mark removed. Undo is available in the Marks bar.');
    },
    [highlights]
  );

  const undoUnmark = useCallback(() => {
    if (!undoMark) return;
    const { id: _id, color, created: _created, ...anchor } = undoMark;
    void toggleHighlight(anchor, color, highlights).then((next) => {
      setHighlights(next);
      setUndoMark(null);
      announce('Mark restored');
    });
  }, [undoMark, highlights]);

  /** The active translation first, then each comparison that has loaded. */
  const comparing = bible
    ? [bible, ...compareWith.map((id) => compareBibles[id]).filter((b): b is Bible => !!b)]
    : [];

  /**
   * How a `[[…]]` link reads, for the follow button in the notes pane.
   *
   * Resolved against whatever is open, since the slug is language-independent —
   * and it says plainly when a link's own translation is not on this device
   * rather than offering navigation that would quietly land somewhere else.
   */
  const describeLink = (inner: string): string | null => {
    if (!bible) return null;
    const link = resolveLink(bible, inner);
    if (!link) return null;

    const span =
      link.verse === undefined
        ? ''
        : link.endVerse !== undefined && link.endVerse !== link.verse
          ? `:${link.verse}-${link.endVerse}`
          : `:${link.verse}`;
    const where = `${link.book.name} ${link.chapter}${span}`;
    if (!link.translation) return where;

    const id = link.translation.toUpperCase();
    return installed.includes(link.translation)
      ? `${where} (${id})`
      : `${where} (${id} — not downloaded)`;
  };

  const followLink = (inner: string) => {
    if (!bible) return;
    const link = resolveLink(bible, inner);
    if (!link) return;
    // Switching is what makes a qualified link worth writing: a note quoting
    // KJV and VBL of one verse should take you back to the version it quoted.
    if (
      link.translation &&
      link.translation !== translationId &&
      installed.includes(link.translation)
    ) {
      readTranslation(link.translation);
    }
    goTo(link.book_slug, link.chapter, link.verse);
  };

  /** Quote a search hit, from the translation the search ran against. */
  const insertSearchResult = (r: SearchResult) => {
    if (!bible) return;
    const b = bible.book(r.book_slug);
    const v = b?.chapters.find((c) => c.number === r.chapter)?.verses.find((x) => x.number === r.verse);
    if (b && v) insertIntoNote(quotePassage(bible, b, r.chapter, [v]), `Quoted ${r.ref}`);
  };

  /** Quote one column of a comparison, in that column's own words. */
  const quoteFrom = (id: string, verse: number) => {
    const from = comparing.find((b) => b.meta.id === id);
    const book = from?.book(position.bookSlug);
    const v = book?.chapters
      .find((c) => c.number === position.chapter)
      ?.verses.find((x) => x.number === verse);
    if (!from || !book || !v) return;
    // Which column, in the words: the point of quoting from a comparison.
    insertIntoNote(
      quotePassage(from, book, position.chapter, [v]),
      `Quoted ${book.name} ${position.chapter}:${verse} (${id.toUpperCase()})`,
      { focus: true }
    );
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

  const staged = proposal && bible && (
    <ProposalPreview
      bible={bible}
      proposal={proposal}
      labels={colorLabels}
      onAccept={acceptProposal}
      onDiscard={clearProposal}
    />
  );

  if (canvasOpen) {
    return (
      <>
        {staged}
        <CanvasView
          bible={bible}
          notes={notes}
          labels={colorLabels}
          boards={boards}
          activeId={boardId}
          onSelect={setBoardId}
          onCreate={createBoard}
          onDelete={deleteBoard}
          onChange={changeBoard}
          onClose={() => setCanvasOpen(false)}
          onHelp={() => {
            setCanvasOpen(false);
            setHelpOpen(true);
          }}
          onGo={(bookSlug, chapter, verse) => {
            goTo(bookSlug, chapter, verse);
            setCanvasOpen(false);
          }}
          onAddToNote={(id) => {
            const name = boards.find((b) => b.id === id)?.name || 'Untitled board';
            insertIntoNote(boardEmbed(id), `Added the board “${name}”`);
            setCanvasOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      {staged}
      {/* First in the document (2.4.1): a keyboard user reaches the text or the
          notes in one press instead of tabbing through the bar and the search
          box — and, in Psalm 119, 176 verse numbers. */}
      <a className="skip" href="#scripture" data-testid="skip-scripture">
        Skip to scripture
      </a>
      <a className="skip" href="#notes" data-testid="skip-notes">
        Skip to notes
      </a>
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
        inserted={inserted}
        onNotesShown={clearInserted}
        bible={
          <BiblePane
            bible={bible}
            book={book}
            chapter={position.chapter}
            labels={colorLabels}
            highlights={highlights}
            focusVerse={focusVerse}
            onNavigate={(bookSlug, chapter) => {
              setPosition({ bookSlug, chapter });
              setFocusVerse(null);
            }}
            onHighlight={highlight}
            onQuote={quoteVerse}
            onLink={linkVerse}
            onSendToCanvas={sendToCanvas}
            marksOpen={marksOpen}
            markCount={highlights.length}
            onToggleMarks={() => {
              setLibraryOpen(false);
              setResultsOpen(false);
              setSettingsOpen(false);
              setHelpOpen(false);
              setMarksOpen((o) => !o);
            }}
            libraryOpen={libraryOpen}
            onToggleLibrary={() => {
              setMarksOpen(false);
              setResultsOpen(false);
              setSettingsOpen(false);
              setHelpOpen(false);
              setLibraryOpen((o) => !o);
            }}
            settingsOpen={settingsOpen}
            onToggleSettings={() => {
              setMarksOpen(false);
              setResultsOpen(false);
              setLibraryOpen(false);
              setHelpOpen(false);
              setSettingsOpen((o) => !o);
            }}
            helpOpen={helpOpen}
            onToggleHelp={() => {
              setMarksOpen(false);
              setResultsOpen(false);
              setLibraryOpen(false);
              setSettingsOpen(false);
              setHelpOpen((o) => !o);
            }}
            overlay={
              helpOpen ? (
                <HelpPanel catalog={catalog} onClose={() => setHelpOpen(false)} />
              ) : marksOpen ? (
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
                  onUndo={undoMark ? undoUnmark : null}
                  onClose={() => setMarksOpen(false)}
                />
              ) : resultsOpen ? (
                <SearchResults
                  bible={bible}
                  query={query}
                  results={hits}
                  options={matching}
                  onOptions={setMatching}
                  onGo={(bookSlug, chapter, verse) => {
                    goTo(bookSlug, chapter, verse);
                    setResultsOpen(false);
                  }}
                  onInsert={(r) => insertSearchResult(r)}
                  onClose={() => setResultsOpen(false)}
                />
              ) : settingsOpen ? (
                <SettingsPanel
                  persistence={persistence}
                  mirroring={isMirroring}
                  storage={storage}
                  agentSupported={agentIsSupported()}
                  agentEnabled={agentEnabled}
                  onAgentToggle={(on) => {
                    setAgentEnabled(on);
                    setAgentOn(on);
                  }}
                  onChooseFolder={doChooseFolder}
                  onExport={doExport}
                  onClose={() => setSettingsOpen(false)}
                  onHelp={() => {
                    setSettingsOpen(false);
                    setHelpOpen(true);
                  }}
                  prefs={prefs}
                  onPrefs={updatePrefs}
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
                lang={bible.meta.language}
                results={hits.slice(0, 40)}
                reference={reference}
                total={hits.length}
                resultsFor={hitsQuery}
                options={matching}
                onOptions={setMatching}
                onQuery={setQuery}
                onGo={goTo}
                onInsert={insertSearchResult}
                onSeeAll={() => {
                  setMarksOpen(false);
                  setLibraryOpen(false);
                  setSettingsOpen(false);
                  setHelpOpen(false);
                  setResultsOpen(true);
                }}
              />
            }
          />
        }
        notes={
          <NotesPane
            notes={notes}
            activeId={activeId}
            saving={saving}
            inserted={inserted}
            onSelect={(id) => {
              setInserted(null);
              setActiveId(id);
            }}
            onCreate={createNote}
            onDelete={deleteNote}
            // The reader's own edits clear the confirmation; an insertion goes
            // through changeNote directly and sets a new one.
            onChange={(id, patch) => {
              setInserted(null);
              changeNote(id, patch);
            }}
            onExport={doExport}
            onOpenCanvas={() => setCanvasOpen(true)}
            boardCount={boards.length}
            onSurfaceReady={(el) => {
              surfaceRef.current = el;
            }}
            describeLink={describeLink}
            onFollowLink={followLink}
            bible={bible}
            boards={boards}
            onOpenBoard={(id) => {
              setBoardId(id);
              setCanvasOpen(true);
            }}
          />
        }
      />
    </>
  );
}
