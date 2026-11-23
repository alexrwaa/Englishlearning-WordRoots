/**
 * Durable storage for family-inquiry progress.
 *
 * Same contract as `lib/assessment.ts`, and for the same reason: the desktop
 * build keeps the six-step record in SQLite (`inquiry_progress`) where backups
 * and the portable folder can see it, while `localStorage` is only a one-shot
 * migration source. The browser preview implements the identical four
 * operations over localStorage so the page has one API and one set of failure
 * semantics in both runtimes.
 *
 * Two rules are load-bearing:
 *
 * 1. A save resolves only after the backend acknowledged the write. A rejected
 *    promise means "not saved" — the UI must offer a retry, never claim success.
 * 2. Reads, writes and the migration share one promise chain, so a read cannot
 *    render "no progress" while the migration is still importing, and two
 *    families saved at once cannot overwrite each other's snapshot.
 */
import {
  INQUIRY_DB_KEY,
  INQUIRY_KEY,
  INQUIRY_MIGRATED_KEY,
  INQUIRY_RECORD_VERSION,
  IS_TAURI,
  call,
  type InquiryListResult,
  type InquiryProgressRecord,
} from './api';
import type { InquiryStepId } from './family-inquiry';

/** Record shape version written into every row (matches Rust). */
export const RECORD_VERSION = INQUIRY_RECORD_VERSION;
/** Legacy per-family map written by the pre-SQLite build. Migration input only. */
export const STORAGE_KEY = INQUIRY_KEY;
/** Browser-preview stand-in for the SQLite table. */
export const DURABLE_KEY = INQUIRY_DB_KEY;
export const MIGRATED_KEY = INQUIRY_MIGRATED_KEY;

export type InquiryRecord = InquiryProgressRecord;

const STEP_IDS: InquiryStepId[] = [
  'observe',
  'discover',
  'hypothesize',
  'verify',
  'counterexample',
  'summarize',
];

/** What the page hands to `saveInquiryAsync`: everything but the stamped fields. */
export interface InquiryWrite {
  familyId: string;
  step: number;
  done: InquiryStepId[];
  hypothesis: string;
  picks: Record<string, unknown>;
  sums: Record<string, string>;
  hints: number;
  elapsedMs: number;
  /** Production callers omit it; tests pass a fixed value. */
  updatedAt?: number;
}

export interface InquirySnapshot {
  items: InquiryRecord[];
  /** Rows dropped because their shape/JSON was unreadable. Must be surfaced. */
  skipped: number;
}

export interface InquiryStore {
  list(): Promise<InquirySnapshot>;
  save(record: InquiryRecord): Promise<void>;
  count(): Promise<number>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return (globalThis as unknown as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStepId(value: unknown): value is InquiryStepId {
  return typeof value === 'string' && (STEP_IDS as string[]).includes(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * A row from a newer build. Deliberately fatal: silently dropping it would
 * lose the learner's work, and pretending it is v1 would misread its fields.
 */
export class InquiryVersionError extends Error {
  constructor(readonly familyId: string, readonly schemaVersion: number) {
    super(
      `family ${familyId} 的探究进度由更新版本写入（记录 v${schemaVersion}，本程序支持到 v${RECORD_VERSION}），请升级程序。`,
    );
    this.name = 'InquiryVersionError';
  }
}

/** Validate one stored row, or return null when its shape is unusable. */
function coerceRecord(value: unknown): InquiryRecord | null {
  if (!isRecord(value)) return null;
  const familyId = value.familyId;
  if (typeof familyId !== 'string' || familyId.trim() === '') return null;

  const schemaVersion = numberOr(value.schemaVersion, RECORD_VERSION);
  if (schemaVersion > RECORD_VERSION) throw new InquiryVersionError(familyId, schemaVersion);

  if (typeof value.step !== 'number' || !Number.isFinite(value.step)) return null;
  if (!Array.isArray(value.done)) return null;
  if (!isRecord(value.picks) || !isRecord(value.sums)) return null;

  const done = value.done.filter(isStepId);
  return {
    familyId,
    schemaVersion,
    step: Math.max(0, Math.trunc(value.step)),
    done,
    hypothesis: typeof value.hypothesis === 'string' ? value.hypothesis : '',
    picks: value.picks,
    sums: value.sums as Record<string, string>,
    hints: Math.max(0, Math.trunc(numberOr(value.hints, 0))),
    elapsedMs: Math.max(0, Math.trunc(numberOr(value.elapsedMs, 0))),
    updatedAt: Math.max(0, Math.trunc(numberOr(value.updatedAt, 0))),
  };
}

function normalizeWrite(write: InquiryWrite, now: number): InquiryRecord {
  return {
    familyId: write.familyId,
    schemaVersion: RECORD_VERSION,
    step: Math.max(0, Math.trunc(write.step)),
    done: [...new Set(write.done.filter(isStepId))],
    hypothesis: write.hypothesis ?? '',
    picks: write.picks ?? {},
    sums: write.sums ?? {},
    hints: Math.max(0, Math.trunc(write.hints)),
    elapsedMs: Math.max(0, Math.trunc(write.elapsedMs)),
    updatedAt: write.updatedAt && write.updatedAt > 0 ? write.updatedAt : now,
  };
}

function readItems(storage: StorageLike | null, key: string): unknown[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) return [];
    return parsed.items;
  } catch {
    return [];
  }
}

/**
 * localStorage store: the browser preview and the migration tests.
 *
 * Unlike the assessment mirror, writes here *do* throw on a broken storage:
 * the page must be able to distinguish "saved" from "quota exceeded".
 */
export function browserInquiryStore(
  storage: StorageLike | null = defaultStorage(),
  key: string = DURABLE_KEY,
): InquiryStore {
  const list = async (): Promise<InquirySnapshot> => {
    const entries = readItems(storage, key);
    const items: InquiryRecord[] = [];
    let skipped = 0;
    for (const entry of entries) {
      const record = coerceRecord(entry);
      if (record) items.push(record);
      else skipped += 1;
    }
    // Newest first, matching `ORDER BY updated_at DESC` in Rust.
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return { items, skipped };
  };

  return {
    list,
    async save(record) {
      if (!storage) throw new Error('浏览器预览无法保存：localStorage 不可用，进度未保存。');
      const entries = readItems(storage, key).filter(
        (entry) => !(isRecord(entry) && entry.familyId === record.familyId),
      );
      storage.setItem(key, JSON.stringify({ version: 1, items: [record, ...entries] }));
    },
    async count() {
      return (await list()).items.length;
    },
  };
}

/** SQLite store used by the desktop build. */
export function sqliteInquiryStore(): InquiryStore {
  return {
    async list() {
      const result = await call<InquiryListResult>('inquiry_progress_list');
      const entries = Array.isArray(result.items) ? result.items : [];
      const items: InquiryRecord[] = [];
      let dropped = 0;
      for (const entry of entries) {
        const record = coerceRecord(entry);
        if (record) items.push(record);
        else dropped += 1;
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      return { items, skipped: (result.skipped ?? 0) + dropped };
    },
    async save(record) {
      await call<void>('inquiry_progress_save', { progress: record });
    },
    async count() {
      return call<number>('inquiry_progress_count');
    },
  };
}

/** Durable store for the current runtime. */
export function inquiryStore(storage: StorageLike | null = defaultStorage()): InquiryStore {
  return IS_TAURI ? sqliteInquiryStore() : browserInquiryStore(storage);
}

/* -------------------------------- migration -------------------------------- */

export interface MigrationResult {
  imported: number;
  skipped: number;
  /** The marker already existed: nothing was read or written. */
  alreadyMigrated: boolean;
  /** Every legacy family is present in the store after the copy. */
  verified: boolean;
  /** The store already had rows: it wins, the legacy map is not merged in. */
  libraryWins: boolean;
}

interface LegacyRead {
  records: InquiryRecord[];
  skipped: number;
}

/**
 * Legacy map `{ [familyId]: { step, done, hypothesis, updatedAt } }`.
 *
 * Missing v4 fields (picks/sums/hints/elapsedMs) get honest empty defaults —
 * the old build never recorded them, so inventing values would be a lie.
 */
function readLegacy(storage: StorageLike | null, now: number): LegacyRead {
  if (!storage) return { records: [], skipped: 0 };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { records: [], skipped: 0 };
  }
  if (!raw) return { records: [], skipped: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // The whole legacy blob is unreadable: there is no per-family row to count.
    return { records: [], skipped: 0 };
  }
  if (!isRecord(parsed)) return { records: [], skipped: 0 };

  const records: InquiryRecord[] = [];
  let skipped = 0;
  for (const [familyId, entry] of Object.entries(parsed)) {
    if (!isRecord(entry) || typeof entry.step !== 'number' || !Number.isFinite(entry.step)) {
      skipped += 1;
      continue;
    }
    records.push({
      familyId,
      schemaVersion: RECORD_VERSION,
      step: Math.max(0, Math.trunc(entry.step)),
      done: Array.isArray(entry.done) ? entry.done.filter(isStepId) : [],
      hypothesis: typeof entry.hypothesis === 'string' ? entry.hypothesis : '',
      picks: {},
      sums: {},
      hints: 0,
      elapsedMs: 0,
      updatedAt: Math.max(0, Math.trunc(numberOr(entry.updatedAt, now))),
    });
  }
  return { records, skipped };
}

function markMigrated(storage: StorageLike | null, now: number): void {
  try {
    storage?.setItem(MIGRATED_KEY, new Date(now).toISOString());
  } catch {
    // A locked webview still has the rows in SQLite; the marker is only a guard,
    // so the next load re-checks the store (which then wins).
  }
}

function hasMarker(storage: StorageLike | null): boolean {
  try {
    return Boolean(storage?.getItem(MIGRATED_KEY));
  } catch {
    return false;
  }
}

/**
 * One-shot localStorage → store migration.
 *
 * Idempotent because (a) the marker short-circuits later runs, (b) a non-empty
 * store is never seeded from the legacy map — SQLite wins, nothing is merged,
 * so a later clear cannot be undone — and (c) the marker is written only after
 * the copy has been read back and verified, so a failed attempt retries.
 */
export async function migrateLegacyInquiry(
  store: InquiryStore = inquiryStore(),
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): Promise<MigrationResult> {
  if (hasMarker(storage)) {
    return { imported: 0, skipped: 0, alreadyMigrated: true, verified: true, libraryWins: false };
  }

  const legacy = readLegacy(storage, now);
  if (legacy.records.length === 0) {
    // Nothing to copy. Close the migration only when the file was clean; a
    // partially damaged map is left open so a fixed copy can still be imported.
    if (legacy.skipped === 0) markMigrated(storage, now);
    return { imported: 0, skipped: legacy.skipped, alreadyMigrated: false, verified: true, libraryWins: false };
  }

  const current = await store.list();
  if (current.items.length > 0) {
    markMigrated(storage, now);
    return { imported: 0, skipped: legacy.skipped, alreadyMigrated: false, verified: true, libraryWins: true };
  }

  for (const record of legacy.records) await store.save(record);

  const after = await store.list();
  const present = new Set(after.items.map((item) => item.familyId));
  const verified = legacy.records.every((record) => present.has(record.familyId));
  if (verified) markMigrated(storage, now);
  return {
    imported: legacy.records.length,
    skipped: legacy.skipped,
    alreadyMigrated: false,
    verified,
    libraryWins: false,
  };
}

/* ------------------------------- write queue ------------------------------- */

/**
 * One promise chain for every read/write/migration, mirroring
 * `assessment.ts`. Failures go to the caller; the chain itself never becomes a
 * rejected promise, so one failed save cannot block the next attempt.
 */
let ioQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = ioQueue.then(task, task);
  ioQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export interface PersistenceOptions {
  store?: InquiryStore;
  storage?: StorageLike | null;
}

function resolvePersistence(options: PersistenceOptions): {
  store: InquiryStore;
  storage: StorageLike | null;
} {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  return { store: options.store ?? inquiryStore(storage), storage };
}

/**
 * Authoritative read. Awaits the one-shot migration so the page never renders
 * "no progress" merely because the store has not been asked yet.
 */
export async function loadInquiryAsync(options: PersistenceOptions = {}): Promise<InquirySnapshot> {
  const { store, storage } = resolvePersistence(options);
  return enqueue(async () => {
    await migrateLegacyInquiry(store, storage);
    return store.list();
  });
}

/**
 * Authoritative save. Resolves only after the backend acknowledged the write;
 * the returned snapshot is re-read from the store, so the page cannot show a
 * step that was not persisted. A rejection is a real failure.
 */
export async function saveInquiryAsync(
  write: InquiryWrite,
  options: PersistenceOptions = {},
): Promise<InquirySnapshot> {
  const { store, storage } = resolvePersistence(options);
  const record = normalizeWrite(write, Date.now());
  return enqueue(async () => {
    await migrateLegacyInquiry(store, storage);
    await store.save(record);
    return store.list();
  });
}

/** One family's saved record, or null when it has never been opened. */
export function findProgress(snapshot: InquirySnapshot, familyId: string): InquiryRecord | null {
  return snapshot.items.find((item) => item.familyId === familyId) ?? null;
}

/** Keep only known step ids; stored rows may come from a hand-edited backup. */
export function toStepIds(values: unknown): InquiryStepId[] {
  return Array.isArray(values) ? values.filter(isStepId) : [];
}

/* ----------------------------- view state machine ----------------------------- */

/**
 * `loadedFor` is a family id, never a boolean.
 *
 * The pre-SQLite component kept `loaded: boolean`. Switching families quickly
 * left `loaded === true` from the previous family, so the autosave effect wrote
 * family A's step/hypothesis onto family B before B's read completed — visible
 * as progress "jumping" between families. This tiny state machine makes the
 * guard explicit and testable without a DOM: autosave is allowed only when the
 * *current* family is the one that finished loading.
 */
export interface InquiryViewState {
  familyId: string | null;
  loadedFor: string | null;
}

export function beginFamilyView(familyId: string | null): InquiryViewState {
  return { familyId, loadedFor: null };
}

/** Apply a completed read, but only to the family it was started for. */
export function markFamilyLoaded(view: InquiryViewState, familyId: string): InquiryViewState {
  return view.familyId === familyId ? { ...view, loadedFor: familyId } : view;
}

/** True only when the family on screen has finished loading from the store. */
export function canAutosave(view: InquiryViewState): boolean {
  return view.familyId !== null && view.loadedFor === view.familyId;
}
