/**
 * Optional learning-outcome assessment (测评), deliberately separate from the
 * automated software tests in `*.test.ts`.
 *
 * What this module measures: whether a learner can *use* morphology on material
 * the course never taught — recall of taught morphemes, boundary judgement,
 * etymology vs. modern composition, transfer to unseen words, and repairing a
 * wrong guess from context. It is a five-dimension quiz, not an experiment.
 *
 * What it cannot measure: whether the course caused a change. There is no
 * control group, no randomisation, and each dimension is covered by only a
 * handful of items. The UI must say so; `confidenceNote()` is the copy.
 *
 * The item bank lives in `content/assessment/items.json`. Every item that names
 * a word uses a word absent from `content/weeks/**` (enforced by the test), so a
 * high score cannot come from memorising lesson examples.
 */
import rawBank from '../content/assessment/items.json';
import {
  ASSESSMENT_KEY,
  ASSESSMENT_MIGRATED_KEY,
  IS_TAURI,
  call,
  type AssessmentListResult,
} from './api';

/** Version of the shipped item bank; stamped into every run for comparability. */
export const ITEM_BANK_VERSION: number =
  typeof (rawBank as { version?: unknown }).version === 'number'
    ? ((rawBank as { version: number }).version)
    : 1;

export const DIMENSIONS = ['recall', 'boundary', 'etymology', 'transfer', 'repair'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type Difficulty = 1 | 2 | 3;
export type Mode = 'baseline' | 'checkpoint' | 'retest';
export type Confidence = 'low' | 'medium' | 'high';

export interface AssessmentItem {
  id: string;
  dimension: Dimension;
  difficulty: Difficulty;
  /** Headword, when the item is about a specific word. Absent for recall items. */
  word?: string;
  prompt: string;
  choices: string[];
  /** Index into `choices`. Always validated against `choices.length`. */
  answer: number;
  explain: string;
}

export interface ItemBank {
  version: number;
  items: AssessmentItem[];
}

/** Difficulty weighting: harder items carry more information per minute. */
export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { 1: 1, 2: 1.5, 3: 2 };

export const DIMENSION_META: Record<Dimension, { label: string; short: string; desc: string }> = {
  recall: {
    label: '已学词素记忆',
    short: '记忆',
    desc: '课程里出现过的词素，能否说清核心义。',
  },
  boundary: {
    label: '词素边界判断',
    short: '切分',
    desc: '一个没学过的词，切分是否落在真正的词素边界上。',
  },
  etymology: {
    label: '词源与现代构词',
    short: '词源',
    desc: '区分历史词源、民间词源和今天的可分析结构。',
  },
  transfer: {
    label: '陌生词推理',
    short: '迁移',
    desc: '用已知词素推断一个从未见过的词的意思。',
  },
  repair: {
    label: '语境修正词义',
    short: '修正',
    desc: '按词素猜错时，能否根据上下文改回正确词义。',
  },
};

export const MODE_META: Record<Mode, { label: string; desc: string; minutes: number }> = {
  baseline: {
    label: '基线测评',
    desc: '首次使用：每维 3 题（难度 1/2/3 各一），共 15 题。',
    minutes: 8,
  },
  checkpoint: {
    label: '阶段检查',
    desc: '完成一组课程后：每维 2 题，共 10 题。',
    minutes: 5,
  },
  retest: {
    label: '延迟复测',
    desc: '与基线同蓝图、不同题目的平行卷：每维 3 题，共 15 题。',
    minutes: 8,
  },
};

/** Blueprint per mode: which difficulty to take, and which parallel variant. */
const FORM_PLAN: Record<Mode, { difficulty: Difficulty; variant: number }[]> = {
  baseline: [
    { difficulty: 1, variant: 0 },
    { difficulty: 2, variant: 0 },
    { difficulty: 3, variant: 0 },
  ],
  checkpoint: [
    { difficulty: 1, variant: 1 },
    { difficulty: 2, variant: 1 },
  ],
  retest: [
    { difficulty: 1, variant: 2 },
    { difficulty: 2, variant: 2 },
    { difficulty: 3, variant: 1 },
  ],
};

/* ------------------------------- item bank ------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDimension(value: unknown): value is Dimension {
  return typeof value === 'string' && (DIMENSIONS as readonly string[]).includes(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 1 || value === 2 || value === 3;
}

/**
 * Validate an untrusted bank (shipped JSON, or a test fixture) and return only
 * usable items. Problems never throw: a broken item is dropped with a reason so
 * one bad line cannot take the whole page down, and the test asserts the
 * shipped bank reports none.
 */
export function inspectItemBank(raw: unknown): { items: AssessmentItem[]; problems: string[] } {
  const problems: string[] = [];
  const items: AssessmentItem[] = [];

  if (!isRecord(raw)) return { items, problems: ['题库不是对象'] };
  if (raw.version !== 1) problems.push(`题库版本应为 1，实际为 ${String(raw.version)}`);
  if (!Array.isArray(raw.items)) return { items, problems: [...problems, 'items 不是数组'] };

  const seen = new Set<string>();
  raw.items.forEach((entry, index) => {
    const where = `items[${index}]`;
    if (!isRecord(entry)) {
      problems.push(`${where} 不是对象`);
      return;
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id) {
      problems.push(`${where} 缺少 id`);
      return;
    }
    if (seen.has(id)) {
      problems.push(`id 重复：${id}`);
      return;
    }
    seen.add(id);

    if (!isDimension(entry.dimension)) {
      problems.push(`${id} 的 dimension 非法`);
      return;
    }
    if (!isDifficulty(entry.difficulty)) {
      problems.push(`${id} 的 difficulty 非法`);
      return;
    }
    if (!id.startsWith(`as-${entry.dimension}-`)) {
      problems.push(`${id} 的 id 前缀与 dimension 不一致`);
      return;
    }
    if (typeof entry.prompt !== 'string' || entry.prompt.trim() === '') {
      problems.push(`${id} 缺少 prompt`);
      return;
    }
    const choices = Array.isArray(entry.choices) ? entry.choices.filter((c): c is string => typeof c === 'string') : [];
    if (choices.length !== (Array.isArray(entry.choices) ? entry.choices.length : 0) || choices.length < 2) {
      problems.push(`${id} 的 choices 必须至少有两项且全为字符串`);
      return;
    }
    if (new Set(choices.map((c) => c.trim())).size !== choices.length) {
      problems.push(`${id} 的 choices 有重复项`);
      return;
    }
    if (!Number.isInteger(entry.answer) || (entry.answer as number) < 0 || (entry.answer as number) >= choices.length) {
      problems.push(`${id} 的 answer 越界`);
      return;
    }
    if (typeof entry.explain !== 'string' || entry.explain.trim() === '') {
      problems.push(`${id} 缺少 explain`);
      return;
    }
    if (entry.word !== undefined && (typeof entry.word !== 'string' || entry.word.trim() === '')) {
      problems.push(`${id} 的 word 必须是非空字符串`);
      return;
    }

    items.push({
      id,
      dimension: entry.dimension,
      difficulty: entry.difficulty,
      ...(typeof entry.word === 'string' ? { word: entry.word.trim() } : {}),
      prompt: entry.prompt.trim(),
      choices,
      answer: entry.answer as number,
      explain: entry.explain.trim(),
    });
  });

  return { items, problems };
}

let cached: { items: AssessmentItem[]; problems: string[] } | null = null;

/** Validated bank, parsed once. Invalid items are dropped (see inspectItemBank). */
export function loadItemBank(): AssessmentItem[] {
  if (!cached) cached = inspectItemBank(rawBank as unknown);
  return cached.items;
}

export function itemBankProblems(): string[] {
  if (!cached) cached = inspectItemBank(rawBank as unknown);
  return cached.problems;
}

/* -------------------------------- selecting ------------------------------- */

function byDifficulty(items: AssessmentItem[], difficulty: Difficulty): AssessmentItem[] {
  return items
    .filter((item) => item.difficulty === difficulty)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export interface RunPlan {
  items: AssessmentItem[];
  /** Blueprint slots the bank cannot fill. Empty for the shipped bank. */
  missing: { dimension: Dimension; difficulty: Difficulty; variant: number }[];
}

/**
 * Deterministic form selection. Each mode has a fixed blueprint, and each
 * blueprint slot takes the n-th item of that dimension+difficulty. This makes
 * `baseline` and `retest` parallel forms: same dimensions and difficulties,
 * disjoint items.
 */
export function planRun(mode: Mode, bank: AssessmentItem[] = loadItemBank()): RunPlan {
  const picked: AssessmentItem[] = [];
  const missing: RunPlan['missing'] = [];

  for (const { difficulty, variant } of FORM_PLAN[mode]) {
    for (const dimension of DIMENSIONS) {
      const pool = byDifficulty(
        bank.filter((item) => item.dimension === dimension),
        difficulty,
      );
      const item = pool[variant];
      if (item) picked.push(item);
      else missing.push({ dimension, difficulty, variant });
    }
  }

  // Easy → hard, and inside a difficulty follow the canonical dimension order.
  const order = (d: Dimension) => DIMENSIONS.indexOf(d);
  picked.sort((a, b) => a.difficulty - b.difficulty || order(a.dimension) - order(b.dimension));
  return { items: picked, missing };
}

export function itemsForMode(mode: Mode, bank: AssessmentItem[] = loadItemBank()): AssessmentItem[] {
  return planRun(mode, bank).items;
}

export interface AssessmentRun {
  id: string;
  mode: Mode;
  startedAt: number;
  items: AssessmentItem[];
}

export function buildRun(mode: Mode, now: number = Date.now()): AssessmentRun {
  return { id: `${mode}-${now}`, mode, startedAt: now, items: itemsForMode(mode) };
}

/* -------------------------------- scoring --------------------------------- */

export interface AnswerRecord {
  itemId: string;
  choice: number;
  /** Time spent on this question, in milliseconds. */
  ms: number;
}

export interface DimensionScore {
  dimension: Dimension;
  label: string;
  /** 0–100, difficulty-weighted, one decimal. */
  score: number;
  correct: number;
  answered: number;
  /** Number of items administered in this dimension. */
  total: number;
  weightedCorrect: number;
  weightedTotal: number;
  confidence: Confidence;
  note: string;
}

export interface RunResult {
  id: string;
  mode: Mode;
  /** Item-bank version the run was administered from (history comparability). */
  itemBankVersion: number;
  startedAt: number;
  finishedAt: number;
  /** Sum of per-question times, not wall time. */
  durationMs: number;
  answers: AnswerRecord[];
  dimensions: DimensionScore[];
  /** 0–100 across all administered items, difficulty-weighted. */
  overall: number;
  overallConfidence: Confidence;
  itemCount: number;
}

/** A choice is usable only when it is an integer inside `choices`. */
export function isAnswerInRange(item: AssessmentItem, choice: number): boolean {
  return Number.isInteger(choice) && choice >= 0 && choice < item.choices.length;
}

/** Out-of-range or malformed choices are wrong, never accidentally right. */
export function isCorrect(item: AssessmentItem, choice: number): boolean {
  return isAnswerInRange(item, choice) && choice === item.answer;
}

export function confidenceFor(answered: number): Confidence {
  if (answered < 5) return 'low';
  if (answered < 10) return 'medium';
  return 'high';
}

export function confidenceNote(confidence: Confidence): string {
  switch (confidence) {
    case 'low':
      return '样本过小（每个维度不足 5 题），仅作参考';
    case 'medium':
      return '样本仍偏小，分数的波动可能大于真实差异';
    case 'high':
      return '样本量可支持同一次测评内的比较，但仍不能推断教学效果';
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10;

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/** The overall run is only as trustworthy as its thinnest dimension. */
export function weakestConfidence(values: Confidence[]): Confidence {
  return values.reduce<Confidence>(
    (worst, value) => (CONFIDENCE_RANK[value] < CONFIDENCE_RANK[worst] ? value : worst),
    'high',
  );
}

/**
 * Score one run. The denominator is every administered item, so skipping a
 * question lowers the score instead of being ignored.
 */
export function scoreRun(
  run: AssessmentRun,
  answers: AnswerRecord[],
  finishedAt: number = Date.now(),
): RunResult {
  const byItem = new Map<string, AnswerRecord>();
  for (const answer of answers) byItem.set(answer.itemId, answer);

  const dimensions = DIMENSIONS.map((dimension): DimensionScore => {
    const items = run.items.filter((item) => item.dimension === dimension);
    let weightedCorrect = 0;
    let weightedTotal = 0;
    let correct = 0;
    let answered = 0;

    for (const item of items) {
      const weight = DIFFICULTY_WEIGHT[item.difficulty];
      weightedTotal += weight;
      const record = byItem.get(item.id);
      if (!record) continue;
      answered += 1;
      if (isCorrect(item, record.choice)) {
        correct += 1;
        weightedCorrect += weight;
      }
    }

    const confidence = confidenceFor(answered);
    return {
      dimension,
      label: DIMENSION_META[dimension].label,
      score: weightedTotal === 0 ? 0 : round1((weightedCorrect / weightedTotal) * 100),
      correct,
      answered,
      total: items.length,
      weightedCorrect,
      weightedTotal,
      confidence,
      note: confidenceNote(confidence),
    };
  });

  const weightedCorrect = dimensions.reduce((sum, d) => sum + d.weightedCorrect, 0);
  const weightedTotal = dimensions.reduce((sum, d) => sum + d.weightedTotal, 0);

  return {
    id: run.id,
    mode: run.mode,
    itemBankVersion: ITEM_BANK_VERSION,
    startedAt: run.startedAt,
    finishedAt,
    durationMs: answers.reduce((sum, a) => sum + Math.max(0, a.ms), 0),
    answers: [...answers],
    dimensions,
    overall: weightedTotal === 0 ? 0 : round1((weightedCorrect / weightedTotal) * 100),
    overallConfidence: weakestConfidence(dimensions.map((d) => d.confidence)),
    itemCount: run.items.length,
  };
}

/** Per-dimension difference (current − reference), rounded to one decimal. */
export function compareResults(
  current: RunResult,
  reference: RunResult | undefined,
): { dimensions: { dimension: Dimension; label: string; delta: number }[]; overall: number } | null {
  if (!reference) return null;
  const dimensions = DIMENSIONS.map((dimension) => {
    const now = current.dimensions.find((d) => d.dimension === dimension)?.score ?? 0;
    const before = reference.dimensions.find((d) => d.dimension === dimension)?.score ?? 0;
    return { dimension, label: DIMENSION_META[dimension].label, delta: round1(now - before) };
  });
  return { dimensions, overall: round1(current.overall - reference.overall) };
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`;
}

/* -------------------------------- storage --------------------------------- */

/**
 * Storage model.
 *
 * - Desktop (`IS_TAURI`): SQLite table `assessment_runs` is the **only**
 *   authoritative store. Reads go through `assessment_list`, writes are only
 *   reported as saved after Rust confirms them.
 * - Browser preview: `browserAssessmentStore` implements the same four
 *   operations on `localStorage`, so both runtimes share one contract and one
 *   asynchronous API.
 * - `localStorage[STORAGE_KEY]` is the *legacy* copy written by the old
 *   synchronous build. It is read once by the migration and then left alone as
 *   a rollback copy; it is never written again by the authoritative path.
 */
export const STORAGE_KEY = ASSESSMENT_KEY;
export const MIGRATED_KEY = ASSESSMENT_MIGRATED_KEY;
export const HISTORY_LIMIT = 50;
export const SQLITE_HISTORY_LIMIT = 200;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    const candidate = (globalThis as unknown as { localStorage?: StorageLike }).localStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

function isMode(value: unknown): value is Mode {
  return value === 'baseline' || value === 'checkpoint' || value === 'retest';
}

function isStoredResult(value: unknown): value is RunResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    isMode(value.mode) &&
    typeof value.overall === 'number' &&
    Array.isArray(value.dimensions) &&
    Array.isArray(value.answers)
  );
}

/** Raw `runs` array of the mirror, already JSON-parsed but not validated. */
function readEntries(storage: StorageLike | null, key: string = STORAGE_KEY): unknown[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.runs)) return [];
    return parsed.runs;
  } catch {
    return [];
  }
}

function newestFirst(runs: RunResult[]): RunResult[] {
  return [...runs].sort((a, b) => b.finishedAt - a.finishedAt);
}

/**
 * Runs written before this field existed carry no version. The bank has only
 * ever shipped v1, so that — not the *current* version — is the factual value.
 */
function normalizeBankVersion(run: RunResult): RunResult {
  return typeof run.itemBankVersion === 'number' && Number.isFinite(run.itemBankVersion)
    ? run
    : { ...run, itemBankVersion: 1 };
}

/* ------------------------------ store contract ------------------------------ */

/**
 * The four operations both backends implement. `skipped` counts entries whose
 * payload could not be read: one damaged record is dropped, never fatal.
 */
export interface HistorySnapshot {
  runs: RunResult[];
  /** Damaged rows dropped from `runs`. The page must surface a non-zero value. */
  skipped: number;
}

export interface AssessmentStore {
  list(): Promise<HistorySnapshot>;
  save(run: RunResult): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

/**
 * localStorage-backed store: browser preview, tests, and rollback fallback.
 *
 * `key` defaults to the mirror key. Tests (and any caller that wants to model a
 * *separate* durable backend on the same primitive) can pass another key — which
 * is what makes migration testable without a Tauri runtime.
 */
export function browserAssessmentStore(
  storage: StorageLike | null = defaultStorage(),
  key: string = STORAGE_KEY,
): AssessmentStore {
  return {
    async list() {
      const entries = readEntries(storage, key);
      const valid = newestFirst(entries.filter(isStoredResult)).map(normalizeBankVersion);
      // Count the damage *before* capping, otherwise a full history would look
      // like it had skipped rows.
      return { runs: valid.slice(0, HISTORY_LIMIT), skipped: entries.length - valid.length };
    },
    async save(run) {
      if (!storage) return;
      const runs = readEntries(storage, key).filter(isStoredResult);
      const next = newestFirst([run, ...runs.filter((entry) => entry.id !== run.id)]).slice(0, HISTORY_LIMIT);
      storage.setItem(key, JSON.stringify({ version: 1, runs: next }));
    },
    async clear() {
      storage?.removeItem(key);
    },
    async count() {
      return readEntries(storage, key).filter(isStoredResult).length;
    },
  };
}

/** SQLite-backed store used by the desktop build. */
export function sqliteAssessmentStore(): AssessmentStore {
  return {
    async list() {
      const result = await call<AssessmentListResult>('assessment_list');
      const entries = Array.isArray(result.runs) ? result.runs : [];
      const valid = newestFirst(entries.filter(isStoredResult)).map(normalizeBankVersion);
      // Same trap as above: `skipped` must come from the raw row count, not from
      // the difference to the 50-row display cap. `result.skipped` already
      // counts rows Rust could not parse at all.
      return {
        runs: valid.slice(0, HISTORY_LIMIT),
        skipped: (result.skipped ?? 0) + (entries.length - valid.length),
      };
    },
    async save(run) {
      await call<void>('assessment_save', {
        run: {
          id: run.id,
          mode: run.mode,
          itemBankVersion: run.itemBankVersion ?? ITEM_BANK_VERSION,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          durationMs: run.durationMs,
          // The row's payload is the whole result: scoring detail stays intact.
          payload: run,
        },
      });
    },
    async clear() {
      await call<void>('assessment_clear');
    },
    async count() {
      return call<number>('assessment_count');
    },
  };
}

/** Durable store for the current runtime. */
export function assessmentStore(storage: StorageLike | null = defaultStorage()): AssessmentStore {
  return IS_TAURI ? sqliteAssessmentStore() : browserAssessmentStore(storage);
}

/* -------------------------------- migration -------------------------------- */

export interface MigrationResult {
  imported: number;
  skipped: number;
  /** True when the marker already existed: nothing was read or written. */
  alreadyMigrated: boolean;
  /** True when the durable store is complete for every legacy id. */
  verified: boolean;
  /**
   * True when the store already held rows and therefore refused the legacy
   * copy: SQLite wins, the stale mirror is never merged in.
   */
  libraryWins: boolean;
}

function markMigrated(storage: StorageLike | null, now: number): void {
  try {
    storage?.setItem(MIGRATED_KEY, new Date(now).toISOString());
  } catch {
    // A locked webview still has the data in SQLite; the marker is only a guard,
    // so the next load simply re-checks the store (which then wins).
  }
}

/**
 * One-shot localStorage → store migration. "Library empty and legacy has data"
 * is the only case that copies anything; a populated store is authoritative and
 * the legacy rows are discarded, not merged.
 *
 * Idempotent on three levels:
 * 1. the `wordroots.assessment.migrated.v1` marker short-circuits later runs;
 * 2. a non-empty store is never seeded from the mirror (no resurrection after
 *    a clear, no overwriting of newer rows);
 * 3. the marker is written only after the copy is verified, so a failed attempt
 *    retries on the next load instead of locking the data out.
 *
 * The legacy key is deliberately left in place as a rollback copy.
 */
export async function migrateLegacyAssessmentHistory(
  store: AssessmentStore = assessmentStore(),
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): Promise<MigrationResult> {
  if (storage?.getItem(MIGRATED_KEY)) {
    return { imported: 0, skipped: 0, alreadyMigrated: true, verified: true, libraryWins: false };
  }
  const entries = readEntries(storage);
  const legacy = entries.filter(isStoredResult);
  const skipped = entries.length - legacy.length;
  if (legacy.length === 0) {
    return { imported: 0, skipped, alreadyMigrated: false, verified: true, libraryWins: false };
  }

  if ((await store.count()) > 0) {
    // The store already has history: it is the source of truth. Closing the
    // migration here is what stops a later clear from being undone by the old
    // mirror on the following load.
    markMigrated(storage, now);
    return { imported: 0, skipped, alreadyMigrated: false, verified: true, libraryWins: true };
  }

  let imported = 0;
  for (const run of legacy) {
    await store.save(run);
    imported += 1;
  }

  const after = await store.list();
  const present = new Set(after.runs.map((run) => run.id));
  const verified = legacy.every((run) => present.has(run.id));
  if (verified) markMigrated(storage, now);
  return { imported, skipped, alreadyMigrated: false, verified, libraryWins: false };
}

/* ------------------------------- write queue ------------------------------- */

/**
 * Every read/write/migration of the history goes through one promise chain.
 *
 * That single mechanism gives the three guarantees the page needs:
 * • a read cannot render "no records" while the migration is still importing;
 * • a clear requested mid-migration runs *after* it, so nothing is written back
 *   into a history the learner just erased;
 * • saves are serialised, so two runs cannot clobber each other's snapshot.
 *
 * Failures are passed to the caller and the chain continues (the queue itself
 * never becomes a rejected promise).
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
  /** Durable backend override (tests, tools). Defaults to the runtime store. */
  store?: AssessmentStore;
  /** Legacy mirror override. `null` means "this runtime has no localStorage". */
  storage?: StorageLike | null;
}

function resolvePersistence(options: PersistenceOptions): {
  store: AssessmentStore;
  storage: StorageLike | null;
} {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  return { store: options.store ?? assessmentStore(storage), storage };
}

/**
 * Authoritative read. Awaits the one-shot migration first, so the caller gets
 * either the real history or a real error — never an empty list that only means
 * "SQLite has not been asked yet".
 *
 * `skipped > 0` means damaged rows exist; the page must say so rather than
 * pretending the history is complete.
 */
export async function loadHistoryAsync(options: PersistenceOptions = {}): Promise<HistorySnapshot> {
  const { store, storage } = resolvePersistence(options);
  return enqueue(async () => {
    await migrateLegacyAssessmentHistory(store, storage);
    return store.list();
  });
}

/**
 * Authoritative save. Resolves only after the backend acknowledged the write,
 * and the resolved snapshot is re-read from the backend: the page cannot show a
 * run that was not persisted. A rejection means "not saved" — the caller must
 * surface a retry, never success.
 */
export async function saveRunAsync(
  result: RunResult,
  options: PersistenceOptions = {},
): Promise<HistorySnapshot> {
  const { store, storage } = resolvePersistence(options);
  return enqueue(async () => {
    await migrateLegacyAssessmentHistory(store, storage);
    await store.save(normalizeBankVersion(result));
    return store.list();
  });
}

/**
 * Authoritative clear. Resolves only after the backend confirmed the delete, and
 * closes the migration for good so the legacy mirror cannot re-seed the store —
 * neither during this call nor on a later load.
 */
export async function clearHistoryAsync(options: PersistenceOptions = {}): Promise<HistorySnapshot> {
  const { store, storage } = resolvePersistence(options);
  return enqueue(async () => {
    try {
      await migrateLegacyAssessmentHistory(store, storage);
    } catch {
      // Erasing is still the learner's intent; a failed migration must not
      // block it. The marker is only written after the clear succeeds.
    }
    await store.clear();
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch {
      // A locked webview still cleared SQLite, which is the authoritative copy.
    }
    markMigrated(storage, Date.now());
    return { runs: [], skipped: 0 };
  });
}

/* --------------------- synchronous legacy mirror (kept) --------------------- */

/**
 * The functions below are the pre-SQLite localStorage API. `*.test.ts` still
 * exercises them, and they remain useful as a synchronous mirror reader for
 * non-UI callers. The page and every authoritative path use the `*Async`
 * functions above; nothing here writes SQLite any more, so a mirror can never
 * be mistaken for the store.
 */

let migration: Promise<MigrationResult> | null = null;

/**
 * Fire-and-forget migration guard for the synchronous entry points. Safe to
 * call repeatedly: the promise is shared, and a failure resets it so the next
 * interaction retries instead of silently giving up forever.
 */
export function ensureAssessmentMigrated(): void {
  if (!IS_TAURI || migration) return;
  migration = migrateLegacyAssessmentHistory().catch((error: unknown) => {
    migration = null;
    void error;
    return { imported: 0, skipped: 0, alreadyMigrated: false, verified: false, libraryWins: false };
  });
}

/** Synchronous read of the legacy mirror only. */
export function loadHistory(storage: StorageLike | null = defaultStorage()): RunResult[] {
  ensureAssessmentMigrated();
  const entries = readEntries(storage);
  return newestFirst(entries.filter(isStoredResult)).map(normalizeBankVersion).slice(0, HISTORY_LIMIT);
}

/** Prepend a run to the legacy mirror (replace same id, cap history). */
export function saveRun(result: RunResult, storage: StorageLike | null = defaultStorage()): RunResult[] {
  ensureAssessmentMigrated();
  const entries = readEntries(storage).filter(isStoredResult);
  const next = newestFirst([result, ...entries.filter((run) => run.id !== result.id)]).slice(0, HISTORY_LIMIT);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, runs: next }));
    } catch {
      // Quota or a locked webview: the in-memory list is still usable.
    }
  }
  return next;
}

/** Remove the legacy mirror (the authoritative clear is `clearHistoryAsync`). */
export function clearHistory(storage: StorageLike | null = defaultStorage()): RunResult[] {
  ensureAssessmentMigrated();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return [];
}

export function latestRun(history: RunResult[], mode?: Mode): RunResult | undefined {
  return history.find((run) => (mode ? run.mode === mode : true));
}

export function latestBaseline(history: RunResult[]): RunResult | undefined {
  return latestRun(history, 'baseline');
}
