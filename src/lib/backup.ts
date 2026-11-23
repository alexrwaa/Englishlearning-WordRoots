/**
 * Backup format, validation and restore policy.
 *
 * ## What a backup contains
 *
 * A backup is a single JSON object with every piece of *user* state:
 *
 * | field          | meaning                                            |
 * | -------------- | -------------------------------------------------- |
 * | `settings`     | theme, font scale, explanation mode, daily budget  |
 * | `lessonStates` | per-lesson status / cursor / elapsedMs / score      |
 * | `cards`        | FSRS scheduling state for every memory card        |
 * | `reviews`      | every review log (rating, ts, phase, elapsed)      |
 * | `attempts`     | every exercise attempt (correct, ts, duration)     |
 * | `notes`        | user notes                                         |
 * | `bookmarks`    | user bookmarks                                     |
 *
 * `dailyStats` is deliberately **not** stored: it is a pure projection of
 * `attempts` + `reviews` (see `load_daily_stats` in the Rust backend and the
 * browser shim in `api.ts`), so restoring the two source tables rebuilds every
 * chart exactly. Storing the aggregate would only add a second source of truth
 * that can disagree with the rows it is derived from.
 *
 * ## Two on-disk shapes
 *
 * 1. `wordroots-backup` (canonical, written by this module):
 *    camelCase, carries `schemaVersion` / `appVersion` / `exportedAt` /
 *    `counts` and an explicit `settings` block.
 * 2. `wordroots-snapshot` (legacy, written by `export_data` in Rust before
 *    v0.2.0): snake_case envelope (`schema_version`, `lesson_state`, …), no
 *    settings block and no counts. Still accepted on import — `fromSnapshot`
 *    upgrades it, and validation derives the counts it is missing.
 *
 * `toSnapshot` produces shape 2 so the desktop build can hand a canonical
 * backup straight to the existing `import_data` command (which expects that
 * shape). Rust ignores the extra `settings`/`counts` keys when present.
 *
 * ## Restore policy
 *
 * Restore is **replace, not merge**: every table listed above is wiped and
 * rewritten from the file. The UI must say so before it runs. Two safety nets
 * sit in front of the write:
 *
 * - a pre-import backup is taken first (`.db` snapshot on desktop, a
 *   `wordroots.dev.preimport` localStorage snapshot in the browser preview);
 * - the write itself is all-or-nothing (SQLite transaction on desktop, a
 *   staging-key swap in the browser: see `writeAtomic`).
 */
import {
  DEFAULT_SETTINGS,
  type Attempt,
  type LessonState,
  type MemoryCard,
  type Note,
  type ReviewLog,
  type Settings,
} from './types';

/** Canonical on-disk format tag. */
export const BACKUP_FORMAT = 'wordroots-backup';
/** Legacy tag written by `export_data` in Rust. Still importable. */
export const LEGACY_SNAPSHOT_FORMAT = 'wordroots-snapshot';
/**
 * Schema version this build writes and understands. Must match
 * `SCHEMA_VERSION` in `src-tauri/src/db.rs`: v2 added `lesson_state.last_seen_at`
 * plus three indexes, v3 added `assessment_runs`, v4 added `inquiry_progress`.
 * Older files stay importable; a newer file is refused rather than truncated.
 */
export const BACKUP_SCHEMA_VERSION = 4;
/** Version stamped into every export; keep in sync with package.json. */
export const APP_VERSION = '0.2.0';
/** Browser-preview key holding the snapshot taken right before an import. */
export const PREIMPORT_KEY = 'wordroots.dev.preimport';

export interface BackupLessonState extends LessonState {
  /**
   * v2 field: last time the lesson was opened. v1 backups do not have it, so a
   * restore falls back to `startedAt` (or `null`) instead of dropping the row.
   */
  lastSeenAt: number | null;
}

export interface BackupBookmark {
  targetType: string;
  targetId: string;
  createdAt: number;
}

export interface BackupData {
  settings: Settings | null;
  lessonStates: BackupLessonState[];
  cards: MemoryCard[];
  reviews: ReviewLog[];
  attempts: Attempt[];
  notes: Note[];
  bookmarks: BackupBookmark[];
  /**
   * Assessment runs (v3). Opaque here on purpose: the scoring payload belongs to
   * `lib/assessment.ts`, and a backup must survive a scoring-version change
   * without this module having to understand it.
   */
  assessments?: unknown[];
  /**
   * Family-inquiry progress (db schema v4). One row per family, opaque here for
   * the same reason as `assessments`: the six-step record belongs to
   * `lib/inquiry-store.ts`.
   */
  inquiryProgress?: unknown[];
}

export interface BackupCounts {
  /** 1 when a settings block is present, 0 when the file predates it. */
  settings: number;
  lessonStates: number;
  cards: number;
  reviews: number;
  attempts: number;
  notes: number;
  bookmarks: number;
  /** Present only when the file actually carries assessment runs (schema v3). */
  assessments?: number;
  /** Present only when the file carries inquiry progress (db schema v4). */
  inquiryProgress?: number;
}

export interface BackupFile extends BackupData {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: number;
  counts: BackupCounts;
  /** Non-fatal remarks added by validation (e.g. "legacy file, no settings"). */
  migrationNotes?: string[];
}

export type ValidateResult = { ok: true; file: BackupFile } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

function isObj(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '数组';
  return typeof v;
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

function total(counts: BackupCounts): number {
  return (
    counts.lessonStates +
    counts.cards +
    counts.reviews +
    counts.attempts +
    counts.notes +
    counts.bookmarks +
    (counts.assessments ?? 0) +
    (counts.inquiryProgress ?? 0)
  );
}

export function countsOf(data: BackupData): BackupCounts {
  return {
    settings: data.settings ? 1 : 0,
    lessonStates: data.lessonStates.length,
    cards: data.cards.length,
    reviews: data.reviews.length,
    attempts: data.attempts.length,
    notes: data.notes.length,
    bookmarks: data.bookmarks.length,
    ...(data.assessments?.length ? { assessments: data.assessments.length } : {}),
    ...(data.inquiryProgress?.length ? { inquiryProgress: data.inquiryProgress.length } : {}),
  };
}

/** Total user records in a backup, used for the "已恢复 N 条记录" message. */
export function totalRecords(file: BackupFile): number {
  return total(file.counts);
}

/* ------------------------------------------------------------------ */
/* build                                                               */
/* ------------------------------------------------------------------ */

/**
 * Wrap a database snapshot into a self-describing backup file.
 *
 * `counts` is stored next to the arrays so that a hand-edited file (a deleted
 * row, a half-copied array) can be detected on import instead of silently
 * restoring a truncated history.
 */
export function buildExport(
  data: BackupData,
  opts: { now?: number; appVersion?: string } = {},
): BackupFile {
  const counts = countsOf(data);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: opts.appVersion ?? APP_VERSION,
    exportedAt: opts.now ?? Date.now(),
    counts,
    settings: data.settings,
    lessonStates: data.lessonStates,
    cards: data.cards,
    reviews: data.reviews,
    attempts: data.attempts,
    notes: data.notes,
    bookmarks: data.bookmarks,
    ...(data.assessments?.length ? { assessments: data.assessments } : {}),
    ...(data.inquiryProgress?.length ? { inquiryProgress: data.inquiryProgress } : {}),
  };
}

/** Pretty-printed JSON, ready for `writeFile` / `Blob`. */
export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

/** Suggested file name: `wordroots-backup-20261118-1530.json`. */
export function backupFileName(at = Date.now()): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `wordroots-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/* ------------------------------------------------------------------ */
/* legacy snapshot -> canonical                                        */
/* ------------------------------------------------------------------ */

function isSnapshotEnvelope(raw: Rec): boolean {
  if (raw.format === LEGACY_SNAPSHOT_FORMAT) return true;
  // Be tolerant about the tag but strict about the shape: a snapshot has the
  // snake_case table keys and a `schema_version` number.
  return (
    typeof raw.schema_version === 'number' &&
    (Array.isArray(raw.lesson_state) || Array.isArray(raw.card) || Array.isArray(raw.attempt))
  );
}

/**
 * Convert a Rust `wordroots-snapshot` into the canonical shape.
 *
 * Rust rows are *mixed* casing: typed structs use `#[serde(rename_all =
 * "camelCase")]` (so `lesson_state` rows carry `lessonId`) while `review` and
 * `attempt` rows are dumped straight from SQLite column names (so they carry
 * `card_id`, `duration_ms`). Both spellings are accepted here.
 */
function fromSnapshot(raw: Rec, migrationNotes: string[]): Rec {
  const rows = (key: string): unknown[] => (Array.isArray(raw[key]) ? raw[key] : []);
  const pick = (row: Rec, a: string, b: string): unknown => (row[a] !== undefined ? row[a] : row[b]);

  migrationNotes.push('该文件是旧版数据库快照（wordroots-snapshot），已按当前版本转换。');

  return {
    format: BACKUP_FORMAT,
    schemaVersion: asNumber(raw.schema_version, 1),
    appVersion: asString(raw.app_version, '(unknown)'),
    exportedAt: asNumber(raw.exported_at, 0),
    // No settings block in a snapshot: null means "keep the current settings".
    settings: raw.settings,
    counts: raw.counts,
    lessonStates: rows('lesson_state').map((row) => {
      const r = (isObj(row) ? row : {}) as Rec;
      return {
        lessonId: pick(r, 'lessonId', 'lesson_id'),
        status: r.status,
        startedAt: r.startedAt ?? r.started_at ?? null,
        completedAt: r.completedAt ?? r.completed_at ?? null,
        elapsedMs: r.elapsedMs ?? r.elapsed_ms ?? 0,
        score: r.score ?? null,
        cursor: r.cursor ?? 0,
        lastSeenAt: r.lastSeenAt ?? r.last_seen_at ?? null,
      };
    }),
    cards: rows('card').map((row) => {
      const r = (isObj(row) ? row : {}) as Rec;
      return {
        cardId: pick(r, 'cardId', 'card_id'),
        kind: r.kind,
        refId: pick(r, 'refId', 'ref_id'),
        stability: r.stability ?? 0,
        difficulty: r.difficulty ?? 0,
        reps: r.reps ?? 0,
        lapses: r.lapses ?? 0,
        state: r.state ?? 0,
        due: r.due ?? 0,
        lastReview: r.lastReview ?? r.last_review ?? null,
      };
    }),
    reviews: rows('review').map((row) => {
      const r = (isObj(row) ? row : {}) as Rec;
      return {
        cardId: pick(r, 'cardId', 'card_id'),
        rating: r.rating ?? 3,
        ts: r.ts,
        correct: r.correct,
        phase: r.phase ?? 'practice',
        elapsedMs: r.elapsedMs ?? r.elapsed_ms ?? undefined,
      };
    }),
    attempts: rows('attempt').map((row) => {
      const r = (isObj(row) ? row : {}) as Rec;
      return {
        lessonId: pick(r, 'lessonId', 'lesson_id'),
        exerciseId: pick(r, 'exerciseId', 'exercise_id'),
        kind: r.kind ?? 'mcq',
        correct: r.correct,
        ts: r.ts,
        durationMs: r.durationMs ?? r.duration_ms ?? 0,
        answer: r.answer ?? undefined,
      };
    }),
    notes: rows('note').map((row) => {
      const r = (isObj(row) ? row : {}) as Rec;
      return {
        id: r.id,
        targetType: pick(r, 'targetType', 'target_type') ?? 'word',
        targetId: pick(r, 'targetId', 'target_id'),
        body: r.body ?? '',
        createdAt: r.createdAt ?? r.created_at ?? 0,
        updatedAt: r.updatedAt ?? r.updated_at ?? 0,
      };
    }),
    bookmarks: rows('bookmark').map((row) => {
      const r = (isObj(row) ? row : {}) as Rec;
      return {
        targetType: pick(r, 'targetType', 'target_type'),
        targetId: pick(r, 'targetId', 'target_id'),
        createdAt: r.createdAt ?? r.created_at ?? 0,
      };
    }),
    // Rust snapshots keep `done` / `picks` / `sums` as JSON *text* (the table
    // stores TEXT); the renderer's own `toSnapshot` writes real values. Both
    // must survive a round trip.
    inquiryProgress: rows('inquiry_progress').map((row) => {
      const r = (isObj(row) ? row : {}) as Rec;
      const json = (value: unknown, fallback: unknown): unknown => {
        if (typeof value !== 'string') return value ?? fallback;
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return fallback;
        }
      };
      return {
        familyId: pick(r, 'familyId', 'family_id'),
        schemaVersion: r.schemaVersion ?? r.schema_version ?? 1,
        step: r.step ?? 0,
        done: json(r.done, []),
        hypothesis: r.hypothesis ?? '',
        picks: json(r.picks, {}),
        sums: json(r.sums, {}),
        hints: r.hints ?? 0,
        elapsedMs: r.elapsedMs ?? r.elapsed_ms ?? 0,
        updatedAt: r.updatedAt ?? r.updated_at ?? 0,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */

interface FieldRule {
  field: string;
  /** 'string' for ids, 'number' for ids/timestamps stored as numbers. */
  type: 'string' | 'number';
}

const COLLECTIONS: { key: keyof BackupCounts & string; rules: FieldRule[] }[] = [
  // The rules mirror the SQLite primary keys: without these a row cannot be
  // written back into the database at all.
  { key: 'lessonStates', rules: [{ field: 'lessonId', type: 'string' }] },
  { key: 'cards', rules: [{ field: 'cardId', type: 'string' }] },
  {
    key: 'reviews',
    rules: [
      { field: 'cardId', type: 'string' },
      { field: 'ts', type: 'number' },
    ],
  },
  {
    key: 'attempts',
    rules: [
      { field: 'lessonId', type: 'string' },
      { field: 'exerciseId', type: 'string' },
      { field: 'ts', type: 'number' },
    ],
  },
  { key: 'notes', rules: [{ field: 'id', type: 'number' }] },
  {
    key: 'bookmarks',
    rules: [
      { field: 'targetType', type: 'string' },
      { field: 'targetId', type: 'string' },
    ],
  },
];

function checkRequired(
  list: unknown[],
  key: string,
  rules: FieldRule[],
): { ok: true } | { ok: false; error: string } {
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    const where = `第 ${i + 1} 条 ${key} 记录`;
    if (!isObj(row)) return fail(`${where}不是对象（收到 ${describe(row)}）`);
    for (const rule of rules) {
      const value = row[rule.field];
      if (value === undefined || value === null || value === '') {
        return fail(`${where}缺少必填字段 ${rule.field}`);
      }
      if (rule.type === 'string' && typeof value !== 'string') {
        return fail(`${where}的 ${rule.field} 应为字符串（收到 ${describe(value)}）`);
      }
      if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
        return fail(`${where}的 ${rule.field} 应为数字（收到 ${describe(value)}）`);
      }
    }
  }
  return { ok: true };
}

function sanitizeSettings(raw: Rec): Settings {
  const theme = raw.theme;
  const mode = raw.explanationMode;
  return {
    dailyMinutes: asNumber(raw.dailyMinutes, DEFAULT_SETTINGS.dailyMinutes),
    newCardsPerDay: asNumber(raw.newCardsPerDay, DEFAULT_SETTINGS.newCardsPerDay),
    targetRetention: asNumber(raw.targetRetention, DEFAULT_SETTINGS.targetRetention),
    theme: theme === 'light' || theme === 'sepia' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme,
    fontScale: asNumber(raw.fontScale, DEFAULT_SETTINGS.fontScale),
    explanationMode: mode === 'zh' || mode === 'bi' || mode === 'en' ? mode : DEFAULT_SETTINGS.explanationMode,
    showEtymologyByDefault: asBool(raw.showEtymologyByDefault, DEFAULT_SETTINGS.showEtymologyByDefault),
  };
}

/**
 * Parse + validate a backup payload.
 *
 * Every failure branch returns a message the UI can show verbatim: it names the
 * collection, the 1-based record index and the missing field, so a user who
 * edited the JSON by hand can find the problem without a debugger.
 */
export function validateBackup(raw: unknown): ValidateResult {
  if (Array.isArray(raw)) {
    return fail('备份内容是一个数组；正确的备份应当是一个包含 settings / lessonStates / … 的对象。');
  }
  if (!isObj(raw)) {
    return fail(`备份内容不是 JSON 对象（收到 ${describe(raw)}）。`);
  }

  const migrationNotes: string[] = [];
  const wasSnapshot = isSnapshotEnvelope(raw);
  const src = wasSnapshot ? fromSnapshot(raw, migrationNotes) : raw;

  // --- schemaVersion -------------------------------------------------
  const schemaVersion = src.schemaVersion;
  if (schemaVersion === undefined || schemaVersion === null) {
    return fail('缺少 schemaVersion 字段，无法确认备份版本。');
  }
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return fail(`schemaVersion 必须是正整数（当前值：${JSON.stringify(schemaVersion)}）。`);
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    return fail(
      `该备份来自更高版本（schema v${schemaVersion}，本程序支持到 v${BACKUP_SCHEMA_VERSION}），请先升级程序再导入。`,
    );
  }
  if (schemaVersion < BACKUP_SCHEMA_VERSION && schemaVersion < 2) {
    migrationNotes.push(`备份为 schema v${schemaVersion}，导入时已补齐 v2 新增字段（lastSeenAt）。`);
  }

  // --- collections ---------------------------------------------------
  for (const { key, rules } of COLLECTIONS) {
    const value = src[key];
    if (value === undefined) {
      // A legacy snapshot may legitimately be missing a table that did not
      // exist yet; a canonical file must list every collection, even empty.
      if (!wasSnapshot) {
        return fail(`缺少 ${key} 数组（空库也应为 []）。`);
      }
      continue;
    }
    if (!Array.isArray(value)) {
      return fail(`${key} 必须是数组（收到 ${describe(value)}）。`);
    }
    const checked = checkRequired(value, key, rules);
    if (!checked.ok) return checked;
  }

  // --- counts --------------------------------------------------------
  const lists = {
    lessonStates: Array.isArray(src.lessonStates) ? src.lessonStates : [],
    cards: Array.isArray(src.cards) ? src.cards : [],
    reviews: Array.isArray(src.reviews) ? src.reviews : [],
    attempts: Array.isArray(src.attempts) ? src.attempts : [],
    notes: Array.isArray(src.notes) ? src.notes : [],
    bookmarks: Array.isArray(src.bookmarks) ? src.bookmarks : [],
    assessments: Array.isArray(src.assessments) ? src.assessments : [],
    inquiryProgress: Array.isArray(src.inquiryProgress) ? src.inquiryProgress : [],
  };
  const actual: BackupCounts = {
    settings: src.settings ? 1 : 0,
    lessonStates: lists.lessonStates.length,
    cards: lists.cards.length,
    reviews: lists.reviews.length,
    attempts: lists.attempts.length,
    notes: lists.notes.length,
    bookmarks: lists.bookmarks.length,
    ...(lists.assessments.length ? { assessments: lists.assessments.length } : {}),
    ...(lists.inquiryProgress.length ? { inquiryProgress: lists.inquiryProgress.length } : {}),
  };

  if (src.counts !== undefined && src.counts !== null) {
    if (!isObj(src.counts)) return fail(`counts 必须是对象（收到 ${describe(src.counts)}）。`);
    for (const key of Object.keys(actual) as (keyof BackupCounts)[]) {
      const declared = src.counts[key];
      if (declared === undefined) {
        // `assessments` arrived with schema v3 and `inquiryProgress` with db v4.
        // A file that carries none of them is complete, not broken — only
        // complain when rows are actually present.
        if ((key === 'assessments' || key === 'inquiryProgress') && actual[key] === 0) continue;
        return fail(`counts 缺少 ${key}，无法校验文件完整性。`);
      }
      if (typeof declared !== 'number' || !Number.isFinite(declared)) {
        return fail(`counts.${key} 应为数字（当前值：${JSON.stringify(declared)}）。`);
      }
      if (declared !== actual[key]) {
        return fail(
          `counts.${key} 声明为 ${declared}，但文件里实际有 ${actual[key]} 条——文件可能被手工修改或被截断。`,
        );
      }
    }
  } else if (!wasSnapshot) {
    return fail('缺少 counts 字段，无法校验文件完整性。');
  } else {
    migrationNotes.push('该文件没有 counts 字段（旧格式），已按实际记录数重新统计。');
  }

  // --- settings ------------------------------------------------------
  let settings: Settings | null = null;
  if (src.settings === undefined || src.settings === null) {
    migrationNotes.push('该文件不含 settings，导入后保留当前设置。');
  } else if (!isObj(src.settings)) {
    return fail(`settings 必须是对象（收到 ${describe(src.settings)}）。`);
  } else {
    settings = sanitizeSettings(src.settings);
  }

  // --- normalise records (v1 -> v2 defaults live here) ---------------
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: schemaVersion,
    appVersion: asString(src.appVersion, '(unknown)'),
    exportedAt: asNumber(src.exportedAt, 0),
    counts: actual,
    settings,
    lessonStates: lists.lessonStates.map((row) => {
      const r = row as Rec;
      const startedAt = asNumberOrNull(r.startedAt);
      const status = r.status;
      return {
        lessonId: asString(r.lessonId),
        status:
          status === 'not_started' || status === 'in_progress' || status === 'completed'
            ? status
            : 'not_started',
        startedAt,
        completedAt: asNumberOrNull(r.completedAt),
        elapsedMs: Math.max(0, asNumber(r.elapsedMs, 0)),
        score: asNumberOrNull(r.score),
        cursor: Math.max(0, Math.trunc(asNumber(r.cursor, 0))),
        // v1 rows carry no lastSeenAt; fall back to the first time the lesson
        // was opened so "上次学习" never shows a bogus epoch date.
        lastSeenAt: asNumberOrNull(r.lastSeenAt) ?? startedAt,
      };
    }),
    cards: lists.cards.map((row) => {
      const r = row as Rec;
      const kind = r.kind === 'inference' ? 'inference' : 'concept';
      const state = Math.trunc(asNumber(r.state, 0));
      const cardId = asString(r.cardId);
      return {
        cardId,
        kind,
        refId: asString(r.refId) || cardId.split(':').slice(1).join(':'),
        stability: asNumber(r.stability, 0),
        difficulty: asNumber(r.difficulty, 0),
        reps: Math.max(0, Math.trunc(asNumber(r.reps, 0))),
        lapses: Math.max(0, Math.trunc(asNumber(r.lapses, 0))),
        state: (state >= 0 && state <= 3 ? state : 0) as MemoryCard['state'],
        due: asNumber(r.due, 0),
        lastReview: asNumberOrNull(r.lastReview),
      };
    }),
    reviews: lists.reviews.map((row) => {
      const r = row as Rec;
      const rating = Math.trunc(asNumber(r.rating, 3));
      const phase = r.phase;
      return {
        cardId: asString(r.cardId),
        rating: (rating >= 1 && rating <= 4 ? rating : 3) as ReviewLog['rating'],
        ts: asNumber(r.ts, 0),
        correct: asBool(r.correct, false),
        phase:
          phase === 'review' || phase === 'learn' || phase === 'practice' || phase === 'apply'
            ? phase
            : 'practice',
        elapsedMs: typeof r.elapsedMs === 'number' && Number.isFinite(r.elapsedMs) ? r.elapsedMs : undefined,
      };
    }),
    attempts: lists.attempts.map((row) => {
      const r = row as Rec;
      const answer = typeof r.answer === 'string' ? r.answer : undefined;
      return {
        lessonId: asString(r.lessonId),
        exerciseId: asString(r.exerciseId),
        kind: (asString(r.kind, 'mcq') || 'mcq') as Attempt['kind'],
        correct: asBool(r.correct, false),
        ts: asNumber(r.ts, 0),
        durationMs: Math.max(0, asNumber(r.durationMs, 0)),
        answer,
      };
    }),
    notes: lists.notes.map((row) => {
      const r = row as Rec;
      const targetType = r.targetType;
      return {
        id: Math.trunc(asNumber(r.id, 0)),
        targetType:
          targetType === 'word' || targetType === 'morpheme' || targetType === 'concept' || targetType === 'lesson'
            ? targetType
            : 'word',
        targetId: asString(r.targetId),
        body: asString(r.body),
        createdAt: asNumber(r.createdAt, 0),
        updatedAt: asNumber(r.updatedAt, asNumber(r.createdAt, 0)),
      };
    }),
    bookmarks: lists.bookmarks.map((row) => {
      const r = row as Rec;
      return {
        targetType: asString(r.targetType),
        targetId: asString(r.targetId),
        createdAt: asNumber(r.createdAt, 0),
      };
    }),
    // Kept opaque: `lib/inquiry-store.ts` owns the record shape and rejects an
    // unknown `schemaVersion` on read. Restoring must not silently drop it.
    ...(lists.inquiryProgress.length ? { inquiryProgress: lists.inquiryProgress } : {}),
  };

  if (migrationNotes.length) file.migrationNotes = migrationNotes;
  return { ok: true, file };
}

/** `validateBackup` for raw file text; JSON syntax errors are reported the same way. */
export function parseBackup(text: string): ValidateResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return fail(`文件不是合法的 JSON：${detail}`);
  }
  return validateBackup(parsed);
}

/* ------------------------------------------------------------------ */
/* canonical -> Rust snapshot                                          */
/* ------------------------------------------------------------------ */

/**
 * Project a canonical backup into the shape `import_data` expects in Rust.
 *
 * Two details matter and are easy to get wrong:
 * - the envelope is snake_case (`schema_version`) while typed rows are
 *   camelCase (`lessonId`), because Rust structs use `rename_all = "camelCase"`;
 * - `review` / `attempt` rows are read by hand on the Rust side with
 *   `as_i64()`, so booleans must be written as 1 / 0 — a `true` would be read
 *   as 0 and silently turn every correct answer into a wrong one.
 */
export function toSnapshot(file: BackupFile): Record<string, unknown> {
  return {
    format: LEGACY_SNAPSHOT_FORMAT,
    schema_version: Math.min(file.schemaVersion, BACKUP_SCHEMA_VERSION),
    exported_at: file.exportedAt,
    lesson_state: file.lessonStates.map((s) => ({
      lessonId: s.lessonId,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      elapsedMs: s.elapsedMs,
      score: s.score,
      cursor: s.cursor,
      lastSeenAt: s.lastSeenAt,
    })),
    card: file.cards.map((c) => ({
      cardId: c.cardId,
      kind: c.kind,
      refId: c.refId,
      stability: c.stability,
      difficulty: c.difficulty,
      reps: c.reps,
      lapses: c.lapses,
      state: c.state,
      due: c.due,
      lastReview: c.lastReview,
    })),
    review: file.reviews.map((r) => ({
      card_id: r.cardId,
      rating: r.rating,
      ts: r.ts,
      correct: r.correct ? 1 : 0,
      phase: r.phase,
      elapsed_ms: r.elapsedMs ?? null,
    })),
    attempt: file.attempts.map((a) => ({
      lesson_id: a.lessonId,
      exercise_id: a.exerciseId,
      kind: a.kind,
      correct: a.correct ? 1 : 0,
      ts: a.ts,
      duration_ms: a.durationMs,
      answer: a.answer ?? null,
    })),
    note: file.notes.map((n) => ({
      id: n.id,
      targetType: n.targetType,
      targetId: n.targetId,
      body: n.body,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    bookmark: file.bookmarks.map((b) => ({
      targetType: b.targetType,
      targetId: b.targetId,
      createdAt: b.createdAt,
    })),
    // Inquiry progress: Rust replaces the table only when this array is
    // non-empty, so an older file restores everything else and keeps progress.
    inquiry_progress: (file.inquiryProgress ?? []).map((row) => {
      const r = (typeof row === 'object' && row !== null ? row : {}) as Record<string, unknown>;
      const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
      return {
        family_id: asString(r.familyId),
        schema_version: num(r.schemaVersion, 1),
        step: num(r.step, 0),
        done: Array.isArray(r.done) ? r.done : [],
        hypothesis: asString(r.hypothesis),
        picks: typeof r.picks === 'object' && r.picks !== null ? r.picks : {},
        sums: typeof r.sums === 'object' && r.sums !== null ? r.sums : {},
        hints: num(r.hints, 0),
        elapsed_ms: num(r.elapsedMs, 0),
        updated_at: num(r.updatedAt, 0),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* browser-preview storage                                             */
/* ------------------------------------------------------------------ */

/** Minimal surface of `localStorage`, so the atomic swap can be unit tested. */
export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The browser shim's on-disk shape (`wordroots.dev.db.v1`). */
export interface WebDbPayload {
  settings: Settings;
  lessonStates: LessonState[];
  cards: MemoryCard[];
  reviews: ReviewLog[];
  attempts: Attempt[];
  notes: Note[];
  bookmarks: BackupBookmark[];
  /**
   * Assessment runs (v3). Opaque here on purpose: the scoring payload belongs to
   * `lib/assessment.ts`, and a backup must survive a scoring-version change
   * without this module having to understand it.
   */
  assessments?: unknown[];
}

/**
 * Canonical backup -> browser shim payload.
 *
 * `lastSeenAt` is dropped because the shim keeps the v1 TS shape; the column
 * only exists in the SQLite schema.
 */
export function toWebDb(file: BackupFile, currentSettings?: Settings): WebDbPayload {
  return {
    settings: file.settings ?? currentSettings ?? { ...DEFAULT_SETTINGS },
    lessonStates: file.lessonStates.map((s) => ({
      lessonId: s.lessonId,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      elapsedMs: s.elapsedMs,
      score: s.score,
      cursor: s.cursor,
    })),
    cards: file.cards,
    reviews: file.reviews,
    attempts: file.attempts,
    notes: file.notes,
    bookmarks: file.bookmarks,
  };
}

/**
 * All-or-nothing write of `payload` under `liveKey`.
 *
 * 1. serialize once (a payload that cannot be stringified fails before anything
 *    is touched);
 * 2. write it to `stagingKey` and read it back — a truncated or quota-rejected
 *    write fails here, while the live data is still intact;
 * 3. only then swap the staging value into `liveKey` (a single `setItem` per
 *    key is atomic in localStorage);
 * 4. on any error, restore the previous live value and drop the staging key.
 */
export function writeAtomic(store: KVStore, liveKey: string, stagingKey: string, payload: unknown): void {
  const previous = store.getItem(liveKey);
  const text = JSON.stringify(payload);
  try {
    store.setItem(stagingKey, text);
    const echoed = store.getItem(stagingKey);
    if (echoed !== text) throw new Error('暂存写入校验失败（写入内容与读回内容不一致）');
    store.setItem(liveKey, text);
    store.removeItem(stagingKey);
  } catch (err) {
    try {
      if (previous === null) store.removeItem(liveKey);
      else store.setItem(liveKey, previous);
      store.removeItem(stagingKey);
    } catch {
      // Compensation failed too; surface the original error, the caller still
      // has the pre-import snapshot to fall back on.
    }
    throw err;
  }
}
