import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, cardId, IS_TAURI, WEB_DB_KEY, type AppInfo, type Bookmark, type DailyStat, type KindStat, type Totals } from './api';
import { loadLessons } from './content';
import {
  backupFileName,
  parseBackup,
  PREIMPORT_KEY,
  totalRecords,
  type BackupCounts,
  type BackupFile,
} from './backup';
import { ratingForOutcome, review as fsrsReview, type Rating } from './fsrs';
import { buildDailyPlan, computeStreak, todayKey, type DailyPlan } from './plan';
import {
  DEFAULT_SETTINGS,
  type Attempt,
  type Exercise,
  type LessonState,
  type MemoryCard,
  type Note,
  type ReviewLog,
  type Settings,
} from './types';

export type Phase = 'review' | 'learn' | 'practice' | 'apply';

export interface StatsBundle {
  totals: Totals;
  daily: DailyStat[];
  kinds: KindStat[];
  streak: number;
  morphemesMastered: number;
  rulesMastered: number;
  inferenceAccuracy: number;
  reviewCompletion: number;
}

interface RecordArgs {
  lessonId: string;
  exercise: Exercise;
  correct: boolean;
  durationMs: number;
  usedHint?: boolean;
  phase: Phase;
  answer?: string;
}

export interface ExportResult {
  /** `file` = the desktop backend wrote a file; `download` = browser download. */
  kind: 'file' | 'download';
  path: string;
  counts: BackupCounts | null;
  notes: string[];
}

export interface ImportSummary {
  counts: BackupCounts;
  /** Total records written (settings excluded). */
  total: number;
  settingsRestored: boolean;
  preImportBackup: string | null;
  notes: string[];
}

interface AppContextValue {
  ready: boolean;
  error: string | null;
  info: AppInfo | null;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  states: Record<string, LessonState>;
  cards: Record<string, MemoryCard>;
  notes: Note[];
  bookmarks: Bookmark[];
  stats: StatsBundle;
  plan: DailyPlan;
  completedLessons: Set<string>;
  refresh: () => Promise<void>;
  saveLessonState: (state: LessonState) => Promise<void>;
  recordAttempt: (args: RecordArgs) => Promise<void>;
  gradeRef: (
    refId: string,
    correct: boolean,
    opts?: { usedHint?: boolean; fast?: boolean; phase?: Phase; elapsedMs?: number },
  ) => Promise<void>;
  addNote: (targetType: string, targetId: string, body: string) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  toggleBookmark: (targetType: string, targetId: string) => Promise<boolean>;
  backupNow: () => Promise<string>;
  runExport: () => Promise<ExportResult>;
  importBackup: (text: string) => Promise<ImportSummary>;
  toast: (message: string, tone?: 'info' | 'success' | 'warn') => void;
  toasts: { id: number; message: string; tone: string }[];
}

const AppContext = createContext<AppContextValue | null>(null);

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Browser preview only: save a string as a file without any backend support. */
function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the webview a tick to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const emptyTotals: Totals = {
  lessonsCompleted: 0,
  reviews: 0,
  attempts: 0,
  correct: 0,
  totalMinutes: 0,
  firstDay: null,
  activeDays: 0,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [states, setStates] = useState<Record<string, LessonState>>({});
  const [cards, setCards] = useState<Record<string, MemoryCard>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [totals, setTotals] = useState<Totals>(emptyTotals);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [kinds, setKinds] = useState<KindStat[]>([]);
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: string }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const toastId = useRef(0);

  const toast = useCallback((message: string, tone: 'info' | 'success' | 'warn' = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    const [s, st, cs, ns, bm, tot, dl, kd] = await Promise.all([
      db.loadSettings(),
      db.lessonStates(),
      db.cards(),
      db.notes(),
      db.bookmarks(),
      db.totals(),
      db.dailyStats(),
      db.kindStats(),
    ]);
    setSettings(s);
    setStates(Object.fromEntries(st.map((x) => [x.lessonId, x])));
    setCards(Object.fromEntries(cs.map((c) => [c.cardId, c])));
    setNotes(ns);
    setBookmarks(bm);
    setTotals(tot);
    setDaily(dl);
    setKinds(kd);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const appInfo = await db.info();
        setInfo(appInfo);
        // Lesson JSON is its own chunk now. Load it alongside the user data so
        // every screen can keep reading `lessons` synchronously once ready.
        await Promise.all([refresh(), loadLessons()]);
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setReady(true);
      }
    })();
  }, [refresh]);

  // Keep the "today" boundaries fresh across midnight without polling hard.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void db.saveSettings(next);
      return next;
    });
  }, []);

  const saveLessonState = useCallback(async (state: LessonState) => {
    setStates((prev) => ({ ...prev, [state.lessonId]: state }));
    await db.saveLessonState(state);
  }, []);

  const gradeRef = useCallback(
    async (
      refId: string,
      correct: boolean,
      opts?: { usedHint?: boolean; fast?: boolean; phase?: Phase; elapsedMs?: number },
    ) => {
      const kind = opts?.phase === 'apply' ? 'inference' : 'concept';
      const id = cardId(kind, refId);
      const existing: MemoryCard =
        cards[id] ?? {
          cardId: id,
          kind,
          refId,
          stability: 0,
          difficulty: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          due: Date.now(),
          lastReview: null,
        };
      const rating: Rating = ratingForOutcome(correct, Boolean(opts?.usedHint), Boolean(opts?.fast));
      const nextState = fsrsReview({
        state: existing,
        rating,
        now: Date.now(),
        targetRetention: settings.targetRetention,
      });
      const updated: MemoryCard = { ...existing, ...nextState, cardId: id, kind, refId };
      setCards((prev) => ({ ...prev, [id]: updated }));
      await db.saveCard(updated);
      const log: ReviewLog = {
        cardId: id,
        rating,
        ts: Date.now(),
        correct,
        phase: opts?.phase ?? 'practice',
        elapsedMs: opts?.elapsedMs,
      };
      await db.addReview(log);
    },
    [cards, settings.targetRetention],
  );

  const recordAttempt = useCallback(
    async ({ lessonId, exercise, correct, durationMs, usedHint, phase, answer }: RecordArgs) => {
      const attempt: Attempt = {
        lessonId,
        exerciseId: exercise.id,
        kind: exercise.kind,
        correct,
        ts: Date.now(),
        durationMs,
        answer,
      };
      await db.addAttempt(attempt);
      // Exercise-level grading: inference exercises train the transfer card,
      // everything else trains the concept card(s) it targets.
      if (phase === 'apply' || exercise.kind === 'infer') {
        const refs = exercise.concepts?.length ? exercise.concepts : [`infer:${exercise.id}`];
        for (const ref of refs) {
          await gradeRef(ref, correct, { usedHint, phase: 'apply', fast: durationMs < 12_000 });
        }
      } else if (exercise.concepts?.length) {
        for (const ref of exercise.concepts) {
          await gradeRef(ref, correct, { usedHint, phase, fast: durationMs < 8000 });
        }
      }
      const [tot, dl, kd] = await Promise.all([db.totals(), db.dailyStats(), db.kindStats()]);
      setTotals(tot);
      setDaily(dl);
      setKinds(kd);
    },
    [gradeRef],
  );

  const addNote = useCallback(async (targetType: string, targetId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const existing = notes.find((n) => n.targetType === targetType && n.targetId === targetId);
    const note = await db.saveNote(targetType, targetId, trimmed, existing?.id ?? null);
    setNotes((prev) => [...prev.filter((n) => n.id !== note.id), note]);
  }, [notes]);

  const deleteNote = useCallback(async (id: number) => {
    await db.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const toggleBookmark = useCallback(async (targetType: string, targetId: string) => {
    const added = await db.toggleBookmark(targetType, targetId);
    const list = await db.bookmarks();
    setBookmarks(list);
    return added;
  }, []);

  const backupNow = useCallback(async () => {
    const path = await db.backup();
    toast('已创建备份', 'success');
    return path;
  }, [toast]);

  const runExport = useCallback(async (): Promise<ExportResult> => {
    if (IS_TAURI) {
      // The desktop backend owns the file system: `export_data` writes a
      // snapshot into backups/ and returns its path. Settings live in the same
      // database but are not part of that snapshot (see `db.rs::Snapshot`), so
      // the counts below report what the file actually contains.
      const path = await db.exportData();
      const [states, cards, notes, bookmarks, totals, runs] = await Promise.all([
        db.lessonStates(),
        db.cards(),
        db.notes(),
        db.bookmarks(),
        db.totals(),
        db.assessmentList().catch(() => ({ runs: [], skipped: 0 })),
      ]);
      toast('学习数据已导出', 'success');
      return {
        kind: 'file',
        path,
        counts: {
          settings: 0,
          lessonStates: states.length,
          cards: cards.length,
          reviews: totals.reviews,
          assessments: runs?.runs?.length ?? 0,
          attempts: totals.attempts,
          notes: notes.length,
          bookmarks: bookmarks.length,
        },
        notes: ['桌面版快照包含全部学习记录；设置项请用「立即备份」生成的 .db 备份保留。'],
      };
    }

    const text = await db.exportData();
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(`导出内容自检失败：${parsed.error}`);
    const name = backupFileName(parsed.file.exportedAt);
    downloadText(text, name);
    toast('学习数据已导出', 'success');
    return { kind: 'download', path: name, counts: parsed.file.counts, notes: [] };
  }, [toast]);

  /**
   * Replace all user data with a backup file.
   *
   * Order matters: validate → pre-import backup → atomic write → settings →
   * reload. The write path is all-or-nothing on both backends (SQLite
   * transaction on desktop, staging-key swap in the browser shim).
   */
  const importBackup = useCallback(
    async (text: string): Promise<ImportSummary> => {
      const parsed = parseBackup(text);
      if (!parsed.ok) throw new Error(parsed.error);
      const file: BackupFile = parsed.file;
      const notes = [...(file.migrationNotes ?? [])];

      let preImportBackup: string | null = null;
      if (IS_TAURI) {
        try {
          // Second safety net on top of the `pre-import` backup that
          // `import_data` takes itself (and which aborts the import on failure).
          preImportBackup = await db.backup();
        } catch (err) {
          notes.push(`导入前的额外备份未创建：${errText(err)}`);
        }
      } else {
        try {
          const current = localStorage.getItem(WEB_DB_KEY);
          if (current) localStorage.setItem(PREIMPORT_KEY, current);
          preImportBackup = `localStorage:${PREIMPORT_KEY}`;
        } catch {
          notes.push('浏览器预览无法写入导入前快照（localStorage 不可用）。');
        }
      }

      await db.importBackup(file);

      if (file.settings) {
        await db.saveSettings({ ...DEFAULT_SETTINGS, ...file.settings });
      }

      await refresh();
      return {
        counts: file.counts,
        total: totalRecords(file),
        settingsRestored: Boolean(file.settings),
        preImportBackup,
        notes,
      };
    },
    [refresh],
  );

  const completedLessons = useMemo(
    () => new Set(Object.values(states).filter((s) => s.status === 'completed').map((s) => s.lessonId)),
    [states],
  );

  const plan = useMemo(
    () =>
      buildDailyPlan({
        cards: Object.values(cards),
        completed: completedLessons,
        settings,
        now,
        introducedToday: Object.values(cards).filter(
          (c) => c.state > 0 && c.lastReview !== null && todayKey(c.lastReview) === todayKey(now),
        ).length,
      }),
    [cards, completedLessons, settings, now],
  );

  const stats = useMemo<StatsBundle>(() => {
    const conceptCards = Object.values(cards).filter((c) => c.kind === 'concept');
    const mastered = conceptCards.filter((c) => c.state === 2 && c.stability >= 21);
    const inferOutcomes = kinds.find((k) => k.kind === 'infer');
    const todayStats = daily.find((d) => d.date === todayKey(now));
    return {
      totals,
      daily,
      kinds,
      streak: computeStreak(daily.map((d) => d.date), now),
      morphemesMastered: mastered.length,
      rulesMastered: mastered.filter((c) => c.refId.startsWith('c-')).length,
      inferenceAccuracy: inferOutcomes && inferOutcomes.total > 0 ? inferOutcomes.correct / inferOutcomes.total : 0,
      reviewCompletion: todayStats && todayStats.reviews > 0 ? 1 : 0,
    };
  }, [cards, kinds, totals, daily, now]);

  const value: AppContextValue = {
    ready,
    error,
    info,
    settings,
    updateSettings,
    states,
    cards,
    notes,
    bookmarks,
    stats,
    plan,
    completedLessons,
    refresh,
    saveLessonState,
    recordAttempt,
    gradeRef,
    addNote,
    deleteNote,
    toggleBookmark,
    backupNow,
    runExport,
    importBackup,
    toast,
    toasts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
