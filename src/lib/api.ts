/**
 * Transport layer.
 *
 * In the desktop app every call goes to the Rust backend (SQLite). In a plain
 * browser (`npm run dev`) a localStorage-backed shim keeps the same contract so
 * the UI can be developed without Rust. The browser shim is explicitly a
 * development convenience: only the desktop build is the supported product.
 */
import type {
  Attempt,
  CardKind,
  LessonState,
  MemoryCard,
  Note,
  ReviewLog,
  Settings,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  buildExport,
  parseBackup,
  PREIMPORT_KEY,
  toSnapshot,
  toWebDb,
  writeAtomic,
  type BackupFile,
} from './backup';

export const IS_TAURI =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>);

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeImpl: InvokeFn | null = null;

export async function getInvoke(): Promise<InvokeFn> {
  if (!invokeImpl) {
    const mod = await import('@tauri-apps/api/core');
    invokeImpl = mod.invoke as InvokeFn;
  }
  return invokeImpl;
}

/* ------------------------------ web shim ------------------------------ */

interface WebDb {
  settings: Partial<Settings>;
  lessonStates: LessonState[];
  cards: MemoryCard[];
  reviews: ReviewLog[];
  attempts: Attempt[];
  notes: Note[];
  bookmarks: { targetType: string; targetId: string; createdAt: number }[];
}

/** localStorage key of the browser-preview database. */
export const WEB_DB_KEY = 'wordroots.dev.db.v1';
const WEB_BACKUP_KEY = 'wordroots.dev.backup.last';

/**
 * Keys shared with `lib/assessment.ts`. They live here so the browser-preview
 * export/import paths can pass assessment history through without importing
 * `assessment.ts` (which imports this module).
 */
export const ASSESSMENT_KEY = 'wordroots.assessment.v1';
export const ASSESSMENT_MIGRATED_KEY = 'wordroots.assessment.migrated.v1';

/**
 * Family-inquiry progress. `INQUIRY_KEY` is the legacy per-family map written
 * by the pre-SQLite build; `INQUIRY_DB_KEY` is the browser-preview table that
 * stands in for `inquiry_progress`. Shared with `lib/inquiry-store.ts`, which
 * imports this module, so they cannot live there.
 */
export const INQUIRY_KEY = 'wordroots.family.inquiry.v1';
export const INQUIRY_DB_KEY = 'wordroots.family.inquiry.db.v1';
export const INQUIRY_MIGRATED_KEY = 'wordroots.family.inquiry.migrated.v1';
/** Record-shape version of one `inquiry_progress` row (matches Rust). */
export const INQUIRY_RECORD_VERSION = 1;

function emptyDb(): WebDb {
  return { settings: {}, lessonStates: [], cards: [], reviews: [], attempts: [], notes: [], bookmarks: [] };
}

function readDb(): WebDb {
  try {
    const raw = localStorage.getItem(WEB_DB_KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...(JSON.parse(raw) as WebDb) };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: WebDb) {
  localStorage.setItem(WEB_DB_KEY, JSON.stringify(db));
}

/** Whole shim database as a canonical backup (settings included). */
function readBackup(): BackupFile {
  const d = readDb();
  return buildExport({
    settings: { ...DEFAULT_SETTINGS, ...d.settings },
    // The shim keeps the v1 TS shape; lastSeenAt only exists in SQLite.
    lessonStates: d.lessonStates.map((s) => ({ ...s, lastSeenAt: s.startedAt ?? null })),
    cards: d.cards,
    reviews: d.reviews,
    attempts: d.attempts,
    notes: d.notes,
    bookmarks: d.bookmarks,
  });
}

/** Assessment runs stored by `lib/assessment.ts` (opaque pass-through here). */
function readAssessmentRuns(): unknown[] {
  try {
    const raw = localStorage.getItem(ASSESSMENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { runs?: unknown };
    return Array.isArray(parsed.runs) ? parsed.runs : [];
  } catch {
    return [];
  }
}

function writeAssessmentRuns(runs: unknown[]) {
  try {
    localStorage.setItem(ASSESSMENT_KEY, JSON.stringify({ version: 1, runs: runs.slice(0, 200) }));
  } catch {
    // Quota / locked webview: the restore of the main database already happened.
  }
}

/** Browser-preview `inquiry_progress` rows (the shim's stand-in for SQLite). */
function readInquiryItems(): unknown[] {
  try {
    const raw = localStorage.getItem(INQUIRY_DB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items?: unknown };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

/**
 * Unlike the assessment mirror this deliberately lets `setItem` throw: the
 * page must be able to tell "saved" from "not saved".
 */
function writeInquiryItems(items: unknown[]) {
  localStorage.setItem(INQUIRY_DB_KEY, JSON.stringify({ version: 1, items }));
}

function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function webCall<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const db = readDb();
  const now = Date.now();
  switch (cmd) {
    case 'app_info':
      return {
        dataDir: '(browser preview) localStorage',
        dbPath: WEB_DB_KEY,
        coursesDir: 'bundled',
        backupsDir: '-',
        version: '0.2.0',
        schemaVersion: 2,
        portable: false,
      } as T;
    case 'load_settings':
      return JSON.stringify({ ...DEFAULT_SETTINGS, ...db.settings }) as T;
    case 'save_settings':
      db.settings = JSON.parse(String(args.json ?? '{}')) as Settings;
      writeDb(db);
      return undefined as T;
    case 'load_lesson_states':
      return db.lessonStates as T;
    case 'save_lesson_state': {
      const s = args.state as LessonState;
      db.lessonStates = [...db.lessonStates.filter((x) => x.lessonId !== s.lessonId), s];
      writeDb(db);
      return undefined as T;
    }
    case 'load_cards':
      return db.cards as T;
    case 'save_card': {
      const c = args.card as MemoryCard;
      db.cards = [...db.cards.filter((x) => x.cardId !== c.cardId), c];
      writeDb(db);
      return undefined as T;
    }
    case 'add_review':
      db.reviews.push(args.log as ReviewLog);
      writeDb(db);
      return undefined as T;
    case 'add_attempt':
      db.attempts.push(args.attempt as Attempt);
      writeDb(db);
      return undefined as T;
    case 'load_notes':
      return db.notes as T;
    case 'save_note': {
      const exists = db.notes.find((n) => n.id === (args.noteId as number | null));
      const note: Note = exists
        ? { ...exists, body: String(args.body), updatedAt: now }
        : {
            id: now,
            targetType: args.target_type as Note['targetType'],
            targetId: String(args.target_id),
            body: String(args.body),
            createdAt: now,
            updatedAt: now,
          };
      db.notes = [...db.notes.filter((n) => n.id !== note.id), note];
      writeDb(db);
      return note as T;
    }
    case 'delete_note':
      db.notes = db.notes.filter((n) => n.id !== (args.id as number));
      writeDb(db);
      return undefined as T;
    case 'load_bookmarks':
      return db.bookmarks as T;
    case 'load_attempts': {
      const limit = Number(args.limit ?? 2000);
      return [...db.attempts].sort((a, b) => b.ts - a.ts).slice(0, limit) as T;
    }
    case 'toggle_bookmark': {
      const type = String(args.target_type);
      const id = String(args.target_id);
      const had = db.bookmarks.some((b) => b.targetType === type && b.targetId === id);
      db.bookmarks = had
        ? db.bookmarks.filter((b) => !(b.targetType === type && b.targetId === id))
        : [...db.bookmarks, { targetType: type, targetId: id, createdAt: now }];
      writeDb(db);
      return !had as T;
    }
    case 'assessment_list': {
      const all = readAssessmentRuns();
      const runs = all.filter(
        (run): run is Record<string, unknown> =>
          typeof run === 'object' && run !== null && typeof (run as Record<string, unknown>).id === 'string',
      );
      runs.sort((a, b) => Number(b.finishedAt ?? 0) - Number(a.finishedAt ?? 0));
      return { runs: runs.slice(0, 200), skipped: all.length - runs.length } as T;
    }
    case 'assessment_save': {
      const run = args.run as Record<string, unknown>;
      const rest = readAssessmentRuns().filter(
        (entry) => (entry as Record<string, unknown>).id !== run.id,
      );
      writeAssessmentRuns([run, ...rest]);
      return undefined as T;
    }
    case 'assessment_clear':
      writeAssessmentRuns([]);
      return undefined as T;
    case 'assessment_count':
      return readAssessmentRuns().length as T;
    case 'inquiry_progress_list': {
      const all = readInquiryItems();
      const items: InquiryProgressRecord[] = [];
      let skipped = 0;
      for (const entry of all) {
        const row = (typeof entry === 'object' && entry !== null ? entry : null) as
          | Partial<InquiryProgressRecord>
          | null;
        if (!row || typeof row.familyId !== 'string' || row.familyId === '' || typeof row.step !== 'number') {
          skipped += 1;
          continue;
        }
        const schemaVersion = Number(row.schemaVersion ?? INQUIRY_RECORD_VERSION);
        if (schemaVersion > INQUIRY_RECORD_VERSION) {
          throw new Error(
            `family inquiry progress for ${row.familyId} was saved by a newer app version (record v${schemaVersion})`,
          );
        }
        if (
          !Array.isArray(row.done) ||
          typeof row.picks !== 'object' ||
          row.picks === null ||
          typeof row.sums !== 'object' ||
          row.sums === null
        ) {
          skipped += 1;
          continue;
        }
        items.push({
          familyId: row.familyId,
          schemaVersion,
          step: row.step,
          done: row.done as string[],
          hypothesis: typeof row.hypothesis === 'string' ? row.hypothesis : '',
          picks: row.picks as Record<string, unknown>,
          sums: row.sums as Record<string, string>,
          hints: Number(row.hints ?? 0),
          elapsedMs: Number(row.elapsedMs ?? 0),
          updatedAt: Number(row.updatedAt ?? 0),
        });
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      return { items, skipped } as T;
    }
    case 'inquiry_progress_save': {
      const progress = args.progress as InquiryProgressRecord;
      if (!progress || typeof progress.familyId !== 'string' || progress.familyId.trim() === '') {
        throw new Error('family id is required');
      }
      const schemaVersion = Number(progress.schemaVersion ?? INQUIRY_RECORD_VERSION);
      if (schemaVersion > INQUIRY_RECORD_VERSION) {
        throw new Error(`refusing to write inquiry record v${schemaVersion}`);
      }
      const record: InquiryProgressRecord = {
        ...progress,
        schemaVersion,
        hypothesis: progress.hypothesis ?? '',
        picks: progress.picks ?? {},
        sums: progress.sums ?? {},
        hints: Number(progress.hints ?? 0),
        elapsedMs: Number(progress.elapsedMs ?? 0),
        updatedAt: Number(progress.updatedAt || now),
      };
      const rest = readInquiryItems().filter(
        (entry) => (entry as { familyId?: unknown }).familyId !== record.familyId,
      );
      writeInquiryItems([record, ...rest]);
      return undefined as T;
    }
    case 'inquiry_progress_count':
      return readInquiryItems().length as T;
    case 'load_daily_stats': {
      const byDay = new Map<string, { minutes: number; reviews: number; correct: number; total: number }>();
      for (const a of db.attempts) {
        const key = localDay(a.ts);
        const cur = byDay.get(key) ?? { minutes: 0, reviews: 0, correct: 0, total: 0 };
        cur.minutes += a.durationMs / 60000;
        cur.correct += a.correct ? 1 : 0;
        cur.total += 1;
        byDay.set(key, cur);
      }
      for (const r of db.reviews) {
        const key = localDay(r.ts);
        const cur = byDay.get(key) ?? { minutes: 0, reviews: 0, correct: 0, total: 0 };
        cur.reviews += 1;
        byDay.set(key, cur);
      }
      return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })) as T;
    }
    case 'load_totals': {
      const days = new Set(db.attempts.map((a) => localDay(a.ts)));
      return {
        lessonsCompleted: db.lessonStates.filter((s) => s.status === 'completed').length,
        reviews: db.reviews.length,
        attempts: db.attempts.length,
        correct: db.attempts.filter((a) => a.correct).length,
        totalMinutes: db.attempts.reduce((sum, a) => sum + a.durationMs / 60000, 0),
        firstDay: [...days].sort()[0] ?? null,
        activeDays: days.size,
      } as T;
    }
    case 'load_kind_stats': {
      const map = new Map<string, { correct: number; total: number }>();
      for (const a of db.attempts) {
        const cur = map.get(a.kind) ?? { correct: 0, total: 0 };
        cur.total += 1;
        cur.correct += a.correct ? 1 : 0;
        map.set(a.kind, cur);
      }
      return [...map.entries()].map(([kind, v]) => ({ kind, ...v })) as T;
    }
    case 'backup_now': {
      // Browser preview: keep one rolling snapshot of the whole shim database.
      localStorage.setItem(WEB_BACKUP_KEY, JSON.stringify(db));
      return `localStorage:${WEB_BACKUP_KEY}` as T;
    }
    case 'export_data': {
      // The browser has no file system: hand the canonical backup JSON back to
      // the caller, which downloads it as a .json file. `counts` must include
      // every extra collection, otherwise the import-time integrity check
      // would reject a file this very function produced.
      const base = readBackup();
      const assessments = readAssessmentRuns();
      const inquiryProgress = readInquiryItems();
      return JSON.stringify({
        ...base,
        ...(assessments.length ? { assessments } : {}),
        ...(inquiryProgress.length ? { inquiryProgress } : {}),
        counts: {
          ...base.counts,
          ...(assessments.length ? { assessments: assessments.length } : {}),
          ...(inquiryProgress.length ? { inquiryProgress: inquiryProgress.length } : {}),
        },
      }) as T;
    }
    case 'import_data': {
      // Validate first, snapshot the current database second, write third: the
      // pre-import snapshot is the only way back if the swap misbehaves.
      const result = parseBackup(String(args.json ?? ''));
      if (!result.ok) throw new Error(result.error);
      const current = localStorage.getItem(WEB_DB_KEY);
      if (current) localStorage.setItem(PREIMPORT_KEY, current);
      const payload = toWebDb(result.file, { ...DEFAULT_SETTINGS, ...db.settings });
      writeAtomic(localStorage, WEB_DB_KEY, `${WEB_DB_KEY}.staging`, payload);
      // Assessment history rides along at the top level of the file. Read it
      // from the raw JSON: validation/`toWebDb` only knows the v1 tables and
      // would otherwise drop it.
      let assessments: unknown;
      try {
        assessments = (JSON.parse(String(args.json ?? '{}')) as { assessments?: unknown }).assessments;
      } catch {
        assessments = undefined;
      }
      if (Array.isArray(assessments)) writeAssessmentRuns(assessments);
      // Family-inquiry progress rides at the top level for the same reason.
      let inquiryProgress: unknown;
      try {
        inquiryProgress = (JSON.parse(String(args.json ?? '{}')) as { inquiryProgress?: unknown })
          .inquiryProgress;
      } catch {
        inquiryProgress = undefined;
      }
      if (Array.isArray(inquiryProgress)) writeInquiryItems(inquiryProgress);
      return undefined as T;
    }
    case 'db_health':
      return 'ok' as T;
    case 'open_folder':
    case 'log_event':
      return undefined as T;
    default:
      throw new Error(`unsupported command in browser preview: ${cmd}`);
  }
}

/**
 * Course pack shipped next to the executable (desktop only). Returns null in the
 * browser preview and whenever the desktop shell cannot read the folder — the
 * app then keeps its built-in curriculum.
 */
export async function loadCoursePack(): Promise<import('./content').CoursePack | null> {
  if (!IS_TAURI) return null;
  try {
    return await call<import('./content').CoursePack>('load_course_pack');
  } catch {
    return null;
  }
}

export async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!IS_TAURI) return webCall<T>(cmd, args);
  const invoke = await getInvoke();
  return invoke<T>(cmd, args);
}

/* --------------------------- typed operations --------------------------- */

export interface AppInfo {
  dataDir: string;
  dbPath: string;
  coursesDir: string;
  backupsDir: string;
  version: string;
  schemaVersion: number;
  portable: boolean;
}

export interface Totals {
  lessonsCompleted: number;
  reviews: number;
  attempts: number;
  correct: number;
  totalMinutes: number;
  firstDay: string | null;
  activeDays: number;
}

export interface DailyStat {
  date: string;
  minutes: number;
  reviews: number;
  correct: number;
  total: number;
}

export interface KindStat {
  kind: string;
  correct: number;
  total: number;
}

export interface Bookmark {
  targetType: string;
  targetId: string;
  createdAt: number;
}

/**
 * One assessment run as stored by SQLite. `payload` is the whole `RunResult`
 * (dimensions/overall/answers) and is treated as opaque here.
 */
export interface AssessmentRunRecord {
  id: string;
  mode: string;
  itemBankVersion: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  payload: unknown;
}

export interface AssessmentListResult {
  runs: unknown[];
  /** Rows whose payload no longer parses; dropped but reported. */
  skipped: number;
}

/**
 * One family's inquiry progress. JSON columns are real objects here: Rust and
 * the shim both decode them, so the UI never parses a string twice.
 */
export interface InquiryProgressRecord {
  familyId: string;
  /** Record shape, not the database schema. A newer value is an error. */
  schemaVersion: number;
  step: number;
  done: string[];
  hypothesis: string;
  picks: Record<string, unknown>;
  sums: Record<string, string>;
  hints: number;
  elapsedMs: number;
  updatedAt: number;
}

export interface InquiryListResult {
  items: InquiryProgressRecord[];
  /** Rows whose JSON columns were unreadable; dropped but reported. */
  skipped: number;
}

/** Map a stored run (RunResult-shaped) onto the row shape `import_data` reads. */
function toAssessmentRow(run: unknown): Record<string, unknown> {
  const r = (typeof run === 'object' && run !== null ? run : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const finishedAt = num(r.finishedAt);
  return {
    id: String(r.id ?? ''),
    mode: String(r.mode ?? 'baseline'),
    item_bank_version: num(r.itemBankVersion, 1),
    started_at: num(r.startedAt),
    finished_at: finishedAt,
    duration_ms: num(r.durationMs),
    payload: JSON.stringify(r),
    created_at: finishedAt,
  };
}

export const db = {
  info: () => call<AppInfo>('app_info'),
  health: () => call<string>('db_health'),
  loadSettings: async (): Promise<Settings> => {
    const raw = await call<string>('load_settings');
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw || '{}') as Partial<Settings>) };
  },
  saveSettings: (settings: Settings) => call<void>('save_settings', { json: JSON.stringify(settings) }),
  lessonStates: () => call<LessonState[]>('load_lesson_states'),
  saveLessonState: (state: LessonState) => call<void>('save_lesson_state', { state }),
  cards: () => call<MemoryCard[]>('load_cards'),
  saveCard: (card: MemoryCard) => call<void>('save_card', { card }),
  addReview: (log: ReviewLog) => call<void>('add_review', { log }),
  addAttempt: (attempt: Attempt) => call<void>('add_attempt', { attempt }),
  dailyStats: () => call<DailyStat[]>('load_daily_stats'),
  totals: () => call<Totals>('load_totals'),
  kindStats: () => call<KindStat[]>('load_kind_stats'),
  notes: () => call<Note[]>('load_notes'),
  saveNote: (targetType: string, targetId: string, body: string, noteId?: number | null) =>
    call<Note>('save_note', { target_type: targetType, target_id: targetId, body, noteId: noteId ?? null }),
  deleteNote: (id: number) => call<void>('delete_note', { id }),
  bookmarks: () => call<Bookmark[]>('load_bookmarks'),
  /** Read-only window of answers, for the personal learning report (0.11.0). */
  attempts: (limit = 2000) => call<Attempt[]>('load_attempts', { limit }),
  toggleBookmark: (targetType: string, targetId: string) =>
    call<boolean>('toggle_bookmark', { target_type: targetType, target_id: targetId }),
  /** Desktop: SQLite, newest first, damaged rows counted as `skipped`. */
  assessmentList: () => call<AssessmentListResult>('assessment_list'),
  assessmentSave: (run: AssessmentRunRecord) => call<void>('assessment_save', { run }),
  assessmentClear: () => call<void>('assessment_clear'),
  assessmentCount: () => call<number>('assessment_count'),
  /** Desktop: SQLite `inquiry_progress`, damaged rows counted as `skipped`. */
  inquiryProgressList: () => call<InquiryListResult>('inquiry_progress_list'),
  inquiryProgressSave: (progress: InquiryProgressRecord) =>
    call<void>('inquiry_progress_save', { progress }),
  inquiryProgressCount: () => call<number>('inquiry_progress_count'),
  backup: () => call<string>('backup_now'),
  /**
   * Desktop: `export_data` writes a snapshot into `backups/` and returns its
   * path. Browser preview: returns the canonical backup JSON itself (there is
   * no file system, the caller downloads it).
   */
  exportData: () => call<string>('export_data'),
  /**
   * Replace every user record with the contents of `file`.
   *
   * Desktop sends the Rust snapshot shape to `import_data`, which wraps the
   * delete+insert pair in a SQLite transaction and takes its own `pre-import`
   * `.db` backup first. The browser shim validates, snapshots the current
   * database under `wordroots.dev.preimport` and swaps a staging key in.
   */
  importBackup: (file: BackupFile) =>
    IS_TAURI
      ? call<void>('import_data', {
          json: JSON.stringify({
            ...toSnapshot(file),
            // Assessment history is not part of `BackupFile` yet; when a file
            // carries it, Rust replaces the table only if rows are present.
            assessment_run: ((file as unknown as { assessments?: unknown[] }).assessments ?? []).map(
              toAssessmentRow,
            ),
          }),
        })
      : call<void>('import_data', { json: JSON.stringify(file) }),
  openFolder: (which: 'data' | 'backups' | 'logs' | 'base') => call<void>('open_folder', { which }),
};

export function cardId(kind: CardKind, refId: string): string {
  return `${kind}:${refId}`;
}
