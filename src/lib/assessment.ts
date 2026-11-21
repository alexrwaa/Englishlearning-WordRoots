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
 * Assessment runs are a local, optional record. They deliberately do not go
 * through `lib/api.ts`: that layer is the product database and has no generic
 * KV command. `localStorage` works in the browser preview and inside the Tauri
 * webview, so the desktop build needs no Rust change either.
 */
export const STORAGE_KEY = 'wordroots.assessment.v1';
export const HISTORY_LIMIT = 50;

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

export function loadHistory(storage: StorageLike | null = defaultStorage()): RunResult[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.runs)) return [];
    return parsed.runs.filter(isStoredResult).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/** Prepend a run, replace any same-id entry, and cap history. Never throws. */
export function saveRun(result: RunResult, storage: StorageLike | null = defaultStorage()): RunResult[] {
  const next = [result, ...loadHistory(storage).filter((run) => run.id !== result.id)].slice(0, HISTORY_LIMIT);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, runs: next }));
    } catch {
      // Quota or a locked webview: the in-memory list is still usable.
    }
  }
  return next;
}

export function clearHistory(storage: StorageLike | null = defaultStorage()): RunResult[] {
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
