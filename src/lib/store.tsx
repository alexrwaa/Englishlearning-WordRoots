import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, cardId, type AppInfo, type Bookmark, type DailyStat, type KindStat, type Totals } from './api';
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
  gradeRef: (refId: string, correct: boolean, opts?: { usedHint?: boolean; fast?: boolean; phase?: Phase }) => Promise<void>;
  addNote: (targetType: string, targetId: string, body: string) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  toggleBookmark: (targetType: string, targetId: string) => Promise<boolean>;
  backupNow: () => Promise<string>;
  runExport: () => Promise<string>;
  toast: (message: string, tone?: 'info' | 'success' | 'warn') => void;
  toasts: { id: number; message: string; tone: string }[];
}

const AppContext = createContext<AppContextValue | null>(null);

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
        await refresh();
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
    async (refId: string, correct: boolean, opts?: { usedHint?: boolean; fast?: boolean; phase?: Phase }) => {
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

  const runExport = useCallback(async () => {
    const path = await db.exportData();
    toast('学习数据已导出', 'success');
    return path;
  }, [toast]);

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
