/**
 * Tests for the assessment module.
 *
 * Two kinds of guarantees live here:
 *  • scoring is arithmetic that can be wrong (weights, denominators, dimension
 *    isolation, out-of-range answers), and
 *  • the item bank is honest: unique ids, in-range answers, explanations, and
 *    no headword that the course already teaches — otherwise "transfer" would
 *    silently become "recall".
 *
 * This is the automated *software* test. It says nothing about learning
 * outcomes; that distinction is the point of `docs/ASSESSMENT.md`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import {
  DIMENSIONS,
  DIFFICULTY_WEIGHT,
  HISTORY_LIMIT,
  buildRun,
  clearHistory,
  compareResults,
  confidenceFor,
  formatDuration,
  inspectItemBank,
  isAnswerInRange,
  isCorrect,
  itemBankProblems,
  itemsForMode,
  latestBaseline,
  loadHistory,
  loadItemBank,
  planRun,
  saveRun,
  scoreRun,
  STORAGE_KEY,
  type AnswerRecord,
  type AssessmentItem,
  type AssessmentRun,
  type Mode,
  type RunResult,
  type StorageLike,
} from './assessment';

const bank = loadItemBank();

function itemOf(dimension: AssessmentItem['dimension'], difficulty: 1 | 2 | 3, offset = 0): AssessmentItem {
  const pool = bank.filter((item) => item.dimension === dimension && item.difficulty === difficulty);
  const item = pool[offset];
  if (!item) throw new Error(`missing fixture item ${dimension}/${difficulty}/${offset}`);
  return item;
}

function answerAll(run: AssessmentRun, correct: boolean): AnswerRecord[] {
  return run.items.map((item) => ({
    itemId: item.id,
    choice: correct ? item.answer : (item.answer + 1) % item.choices.length,
    ms: 1000,
  }));
}

/* ------------------------------- the bank -------------------------------- */

describe('item bank', () => {
  it('ships with no structural problems', () => {
    expect(itemBankProblems()).toEqual([]);
  });

  it('has at least 60 items and 12 per dimension', () => {
    expect(bank.length).toBeGreaterThanOrEqual(60);
    for (const dimension of DIMENSIONS) {
      expect(bank.filter((item) => item.dimension === dimension).length).toBeGreaterThanOrEqual(12);
    }
  });

  it('covers all three difficulties inside every dimension', () => {
    for (const dimension of DIMENSIONS) {
      for (const difficulty of [1, 2, 3] as const) {
        const count = bank.filter((item) => item.dimension === dimension && item.difficulty === difficulty).length;
        expect(count, `${dimension} difficulty ${difficulty}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('has unique ids that match the dimension prefix', () => {
    const ids = bank.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of bank) expect(item.id.startsWith(`as-${item.dimension}-`)).toBe(true);
  });

  it('keeps every answer inside its choices and explains every item', () => {
    for (const item of bank) {
      expect(Number.isInteger(item.answer)).toBe(true);
      expect(item.answer).toBeGreaterThanOrEqual(0);
      expect(item.answer).toBeLessThan(item.choices.length);
      expect(item.choices.length).toBeGreaterThanOrEqual(2);
      expect(new Set(item.choices).size).toBe(item.choices.length);
      expect(item.explain.trim().length).toBeGreaterThan(0);
    }
  });

  it('spreads the correct option across all four positions', () => {
    const counts = [0, 1, 2, 3].map((index) => bank.filter((item) => item.answer === index).length);
    for (const count of counts) expect(count).toBeGreaterThanOrEqual(10);
  });

  it('names a headword for every non-recall item, and never for recall', () => {
    for (const item of bank) {
      if (item.dimension === 'recall') expect(item.word).toBeUndefined();
      else expect(item.word).toBeTruthy();
    }
  });

  it('rejects a bank with duplicate ids and out-of-range answers', () => {
    const base = {
      id: 'as-recall-99',
      dimension: 'recall',
      difficulty: 1,
      prompt: 'p',
      choices: ['a', 'b'],
      answer: 0,
      explain: 'e',
    };
    const result = inspectItemBank({
      version: 1,
      items: [base, { ...base }, { ...base, id: 'as-recall-98', answer: 2 }],
    });
    expect(result.items).toHaveLength(1);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        'id 重复：as-recall-99',
        expect.stringContaining('answer 越界'),
      ]),
    );
  });
});

/* ------------------------- item pool vs. the course ----------------------- */

describe('item pool is disjoint from the course', () => {
  const weeksDir = fileURLToPath(new URL('../content/weeks', import.meta.url));

  function readAllLessonText(dir: string): string {
    const parts: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) parts.push(readAllLessonText(path));
      else if (entry.name.endsWith('.json')) parts.push(readFileSync(path, 'utf8'));
    }
    return parts.join('\n');
  }

  const courseText = readAllLessonText(weeksDir).toLowerCase();

  it('uses lowercase ASCII headwords so the check cannot miss inflections', () => {
    for (const item of bank) {
      if (!item.word) continue;
      expect(item.word).toMatch(/^[a-z][a-z-]*$/);
    }
  });

  it('never teaches an assessed headword anywhere in weeks/**', () => {
    const collisions = bank
      .filter((item) => item.word)
      .filter((item) => courseText.includes(item.word!.toLowerCase()))
      .map((item) => `${item.id}:${item.word}`);
    expect(collisions).toEqual([]);
  });
});

/* -------------------------------- scoring -------------------------------- */

describe('scoring', () => {
  it('gives 100 when every administered item is right', () => {
    const run = buildRun('baseline', 1_000);
    const result = scoreRun(run, answerAll(run, true), 2_000);
    expect(result.overall).toBe(100);
    for (const dimension of result.dimensions) expect(dimension.score).toBe(100);
  });

  it('gives 0 when every administered item is wrong', () => {
    const run = buildRun('baseline', 1_000);
    const result = scoreRun(run, answerAll(run, false), 2_000);
    expect(result.overall).toBe(0);
    for (const dimension of result.dimensions) expect(dimension.score).toBe(0);
  });

  it('scores dimensions independently', () => {
    const run = buildRun('baseline', 1_000);
    const answers = run.items.map((item) => ({
      itemId: item.id,
      choice: item.dimension === 'recall' ? (item.answer + 1) % item.choices.length : item.answer,
      ms: 1000,
    }));
    const result = scoreRun(run, answers, 2_000);
    expect(result.dimensions.find((d) => d.dimension === 'recall')?.score).toBe(0);
    for (const dimension of result.dimensions.filter((d) => d.dimension !== 'recall')) {
      expect(dimension.score).toBe(100);
    }
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThan(100);
  });

  it('weights a difficulty-3 item more than a difficulty-1 item', () => {
    const easy = itemOf('recall', 1, 0);
    const hard = itemOf('recall', 3, 0);
    const run: AssessmentRun = { id: 'weighted', mode: 'baseline', startedAt: 0, items: [easy, hard] };
    const answers: AnswerRecord[] = [
      { itemId: easy.id, choice: (easy.answer + 1) % easy.choices.length, ms: 1000 },
      { itemId: hard.id, choice: hard.answer, ms: 1000 },
    ];
    const result = scoreRun(run, answers, 10);
    const score = result.dimensions.find((d) => d.dimension === 'recall')?.score ?? 0;
    // 2 / (1 + 2) = 66.7, not the unweighted 50.
    expect(DIFFICULTY_WEIGHT[3] / (DIFFICULTY_WEIGHT[1] + DIFFICULTY_WEIGHT[3])).toBeCloseTo(2 / 3);
    expect(score).toBe(66.7);
  });

  it('counts an unanswered item as zero instead of skipping it', () => {
    const run = buildRun('checkpoint', 0);
    const partial = answerAll(run, true).slice(0, -1);
    const result = scoreRun(run, partial, 1);
    const last = run.items[run.items.length - 1];
    const dimension = result.dimensions.find((d) => d.dimension === last.dimension)!;
    expect(dimension.answered).toBe(dimension.total - 1);
    expect(dimension.score).toBeLessThan(100);
    expect(result.overall).toBeLessThan(100);
  });

  it('treats out-of-range and malformed choices as wrong', () => {
    const item = bank[0];
    expect(isAnswerInRange(item, item.answer)).toBe(true);
    expect(isAnswerInRange(item, -1)).toBe(false);
    expect(isAnswerInRange(item, item.choices.length)).toBe(false);
    expect(isAnswerInRange(item, 1.5)).toBe(false);
    expect(isAnswerInRange(item, Number.NaN)).toBe(false);
    expect(isCorrect(item, item.answer)).toBe(true);
    expect(isCorrect(item, 999)).toBe(false);

    const run: AssessmentRun = { id: 'oob', mode: 'baseline', startedAt: 0, items: [item] };
    const result = scoreRun(run, [{ itemId: item.id, choice: 999, ms: 10 }], 20);
    expect(result.overall).toBe(0);
  });

  it('ignores answers for items that were not administered', () => {
    const run = buildRun('baseline', 0);
    const answers = [
      ...answerAll(run, true),
      { itemId: 'as-recall-99', choice: 0, ms: 5000 },
    ];
    const result = scoreRun(run, answers, 10);
    expect(result.overall).toBe(100);
    expect(result.answers).toHaveLength(answers.length);
  });

  it('reports answer time as the sum of question times', () => {
    const run = buildRun('checkpoint', 0);
    const answers = run.items.map((item) => ({ itemId: item.id, choice: item.answer, ms: 1500 }));
    const result = scoreRun(run, answers, 999_999);
    expect(result.durationMs).toBe(run.items.length * 1500);
    expect(formatDuration(90_000)).toBe('1 分 30 秒');
    expect(formatDuration(9_000)).toBe('9 秒');
  });

  it('marks short forms as low confidence', () => {
    expect(confidenceFor(0)).toBe('low');
    expect(confidenceFor(4)).toBe('low');
    expect(confidenceFor(5)).toBe('medium');
    expect(confidenceFor(10)).toBe('high');

    const run = buildRun('baseline', 0);
    const result = scoreRun(run, answerAll(run, true), 1);
    expect(result.overallConfidence).toBe('low');
    for (const dimension of result.dimensions) expect(dimension.confidence).toBe('low');
  });
});

/* ------------------------------- blueprints ------------------------------ */

describe('run blueprints', () => {
  const modes: Mode[] = ['baseline', 'checkpoint', 'retest'];
  const expectedPerDimension: Record<Mode, number> = { baseline: 3, checkpoint: 2, retest: 3 };

  it('fills every blueprint slot from the shipped bank', () => {
    for (const mode of modes) expect(planRun(mode).missing).toEqual([]);
  });

  it('selects the documented number of items per dimension', () => {
    for (const mode of modes) {
      const run = buildRun(mode, 0);
      expect(run.items).toHaveLength(expectedPerDimension[mode] * DIMENSIONS.length);
      for (const dimension of DIMENSIONS) {
        expect(run.items.filter((item) => item.dimension === dimension)).toHaveLength(
          expectedPerDimension[mode],
        );
      }
    }
  });

  it('never repeats an item inside one run', () => {
    for (const mode of modes) {
      const ids = itemsForMode(mode).map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('makes retest a parallel form of baseline, not the same questions', () => {
    const baseline = itemsForMode('baseline');
    const retest = itemsForMode('retest');
    expect(retest.map((item) => item.id)).not.toEqual(baseline.map((item) => item.id));
    const baselineIds = new Set(baseline.map((item) => item.id));
    expect(retest.every((item) => !baselineIds.has(item.id))).toBe(true);

    const profile = (items: AssessmentItem[]) =>
      DIMENSIONS.map((dimension) =>
        [1, 2, 3].map((difficulty) => items.filter(
          (item) => item.dimension === dimension && item.difficulty === difficulty,
        ).length),
      );
    expect(profile(retest)).toEqual(profile(baseline));
  });

  it('does not overlap baseline and checkpoint either', () => {
    const baseline = new Set(itemsForMode('baseline').map((item) => item.id));
    expect(itemsForMode('checkpoint').every((item) => !baseline.has(item.id))).toBe(true);
  });
});

/* ------------------------------ comparisons ------------------------------ */

describe('comparison between runs', () => {
  it('returns null without a reference run', () => {
    const run = buildRun('checkpoint', 0);
    expect(compareResults(scoreRun(run, answerAll(run, true), 1), undefined)).toBeNull();
  });

  it('reports per-dimension deltas and an overall delta', () => {
    const baselineRun = buildRun('baseline', 0);
    const baseline = scoreRun(baselineRun, answerAll(baselineRun, false), 1);
    const retestRun = buildRun('retest', 2);
    const retest = scoreRun(retestRun, answerAll(retestRun, true), 3);
    const delta = compareResults(retest, baseline)!;
    expect(delta.overall).toBe(100);
    expect(delta.dimensions).toHaveLength(DIMENSIONS.length);
    for (const dimension of delta.dimensions) expect(dimension.delta).toBe(100);
  });
});

/* -------------------------------- storage -------------------------------- */

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function resultWithId(id: string): RunResult {
  const run = buildRun('checkpoint', 0);
  return { ...scoreRun(run, answerAll(run, true), 1), id };
}

describe('history storage', () => {
  it('writes under the documented key and reads back', () => {
    const storage = new MemoryStorage();
    saveRun(resultWithId('a'), storage);
    expect(storage.getItem(STORAGE_KEY)).toContain('"version":1');
    const history = loadHistory(storage);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('a');
    expect(latestBaseline(history)).toBeUndefined();
  });

  it('replaces a run with the same id instead of duplicating it', () => {
    const storage = new MemoryStorage();
    saveRun(resultWithId('same'), storage);
    saveRun({ ...resultWithId('same'), overall: 42 }, storage);
    const history = loadHistory(storage);
    expect(history).toHaveLength(1);
    expect(history[0].overall).toBe(42);
  });

  it('caps history at the documented limit', () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) saveRun(resultWithId(`r${i}`), storage);
    expect(loadHistory(storage)).toHaveLength(HISTORY_LIMIT);
  });

  it('survives corrupt JSON and a missing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadHistory(storage)).toEqual([]);
    expect(loadHistory(null)).toEqual([]);
    expect(saveRun(resultWithId('x'), null)).toHaveLength(1);
  });

  it('clears the key', () => {
    const storage = new MemoryStorage();
    saveRun(resultWithId('a'), storage);
    clearHistory(storage);
    expect(loadHistory(storage)).toEqual([]);
  });
});
