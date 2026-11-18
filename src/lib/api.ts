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
      // the caller, which downloads it as a .json file.
      return JSON.stringify(readBackup()) as T;
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
  toggleBookmark: (targetType: string, targetId: string) =>
    call<boolean>('toggle_bookmark', { target_type: targetType, target_id: targetId }),
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
      ? call<void>('import_data', { json: JSON.stringify(toSnapshot(file)) })
      : call<void>('import_data', { json: JSON.stringify(file) }),
  openFolder: (which: 'data' | 'backups' | 'logs' | 'base') => call<void>('open_folder', { which }),
};

export function cardId(kind: CardKind, refId: string): string {
  return `${kind}:${refId}`;
}
