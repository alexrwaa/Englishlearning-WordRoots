/**
 * Personal learning report (0.11.0).
 *
 * The claim being protected: the numbers come from real attempts, and the report
 * never pretends to know something the data lacks (hint usage, error type,
 * causal effect). A test that only checked totals would let a future edit turn
 * "wrong once" into a "weak spot" and turn the disclaimer into marketing copy.
 */
import { describe, expect, it } from 'vitest';

import { buildExerciseIndex, buildReport, kindLabel, serializeReport } from './learning-report';
import type { Attempt } from './types';

const index = buildExerciseIndex([
  {
    id: 'w01d1',
    practice: [
      { id: 'p1', kind: 'mcq', prompt: 'q', explain: 'e', choices: ['a', 'b'], answer: 0, concepts: ['c-morpheme'] },
      { id: 'p2', kind: 'cloze', prompt: 'q', explain: 'e', sentence: '___', answer: 'x', concepts: ['c-boundary'] },
    ],
  },
]);

function attempt(partial: Partial<Attempt> & Pick<Attempt, 'exerciseId' | 'correct' | 'durationMs'>): Attempt {
  return {
    lessonId: 'w01d1',
    kind: 'mcq',
    ts: Date.parse('2026-11-21T10:00:00Z'),
    ...partial,
  };
}

describe('buildReport', () => {
  it('sums real answer time instead of lesson estimates', () => {
    const report = buildReport(
      [
        attempt({ exerciseId: 'p1', correct: true, durationMs: 30_000 }),
        attempt({ exerciseId: 'p2', correct: false, durationMs: 45_000, kind: 'cloze' }),
      ],
      index,
    );
    expect(report.minutes).toBe(1); // 75s rounds to 1 minute, never to 0
    expect(report.attempts).toBe(2);
  });

  it('computes accuracy per exercise kind', () => {
    const report = buildReport(
      [
        attempt({ exerciseId: 'p1', correct: true, durationMs: 1000 }),
        attempt({ exerciseId: 'p1', correct: false, durationMs: 1000 }),
        attempt({ exerciseId: 'p2', correct: true, durationMs: 1000, kind: 'cloze' }),
      ],
      index,
    );
    const mcq = report.byKind.find((row) => row.kind === 'mcq');
    const cloze = report.byKind.find((row) => row.kind === 'cloze');
    expect(mcq?.accuracy).toBe(0.5);
    expect(cloze?.accuracy).toBe(1);
  });

  it('does not call a single mistake a weak concept', () => {
    const report = buildReport(
      [attempt({ exerciseId: 'p1', correct: false, durationMs: 1000 })],
      index,
    );
    expect(report.weakConcepts).toEqual([]);
  });

  it('lists a concept after two wrong answers, with its attempt count', () => {
    const report = buildReport(
      [
        attempt({ exerciseId: 'p1', correct: false, durationMs: 1000 }),
        attempt({ exerciseId: 'p1', correct: false, durationMs: 1000 }),
        attempt({ exerciseId: 'p1', correct: true, durationMs: 1000 }),
      ],
      index,
    );
    const row = report.weakConcepts.find((c) => c.conceptId === 'c-morpheme');
    expect(row?.wrong).toBe(2);
    expect(row?.attempts).toBe(3);
  });

  it('counts an exercise as repeated only after two failures', () => {
    const report = buildReport(
      [
        attempt({ exerciseId: 'p1', correct: false, durationMs: 1 }),
        attempt({ exerciseId: 'p2', correct: false, durationMs: 1 }),
      ],
      index,
    );
    expect(report.repeated).toEqual([]);

    const twice = buildReport(
      [
        attempt({ exerciseId: 'p1', correct: false, durationMs: 1 }),
        attempt({ exerciseId: 'p1', correct: false, durationMs: 1 }),
      ],
      index,
    );
    expect(twice.repeated[0].exerciseId).toBe('p1');
  });

  it('keeps the limitations visible in the returned object', () => {
    const report = buildReport([attempt({ exerciseId: 'p1', correct: true, durationMs: 1 })], index);
    const text = report.limitations.join(' ');
    expect(text).toMatch(/提示使用次数/);
    expect(text).toMatch(/阅读卡片/);
  });

  it('handles an exercise the index does not know without dropping the attempt', () => {
    const report = buildReport([attempt({ exerciseId: 'unknown', correct: false, durationMs: 1 })], index);
    expect(report.attempts).toBe(1);
    expect(report.weakConcepts).toEqual([]);
  });
});

describe('serializeReport', () => {
  it('carries the disclaimer so exports cannot be quoted as evidence', () => {
    const report = buildReport([attempt({ exerciseId: 'p1', correct: true, durationMs: 1 })], index);
    const json = JSON.parse(serializeReport(report)) as { disclaimer: string; report: { attempts: number } };
    expect(json.report.attempts).toBe(1);
    expect(json.disclaimer).toMatch(/不是教学效果证据/);
  });
});

describe('kindLabel', () => {
  it('labels every kind the app writes, and passes unknown kinds through', () => {
    for (const kind of ['mcq', 'cloze', 'wordSum', 'matrix', 'judge', 'boundary']) {
      expect(kindLabel(kind)).not.toBe(kind);
    }
    expect(kindLabel('something-new')).toBe('something-new');
  });
});
