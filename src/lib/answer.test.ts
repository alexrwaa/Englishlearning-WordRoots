import { describe, expect, it } from 'vitest';
import { checkExercise, normalizeWord } from './answer';
import type { Exercise } from './types';

const mcq: Exercise = {
  id: 'e1',
  kind: 'mcq',
  prompt: '哪一个词素表示“不”？',
  choices: ['un-', '-ness', '-ful'],
  answer: 0,
  explain: 'un- 是否定前缀。',
};

const sum: Exercise = {
  id: 'e2',
  kind: 'wordSum',
  prompt: '写出构词算式的结果',
  parts: ['happy', 'ness'],
  answer: 'happiness',
  explain: 'y 在辅音后变 i。',
};

const cloze: Exercise = {
  id: 'e3',
  kind: 'cloze',
  prompt: '填空',
  sentence: 'The results are ___ (predict).',
  answer: 'predictable',
  accept: ['unpredictable'],
  explain: '-able 构成形容词。',
};

describe('answer checking', () => {
  it('normalises spelling variants', () => {
    expect(normalizeWord('  Happi-ness. ')).toBe('happiness');
  });

  it('checks multiple choice by index', () => {
    expect(checkExercise(mcq, { kind: 'choice', index: 0 }).correct).toBe(true);
    expect(checkExercise(mcq, { kind: 'choice', index: 2 }).correct).toBe(false);
  });

  it('accepts a word sum with spaces or plus signs', () => {
    expect(checkExercise(sum, { kind: 'text', value: 'happy + ness' }).correct).toBe(true);
    expect(checkExercise(sum, { kind: 'text', value: 'happiness' }).correct).toBe(true);
  });

  it('accepts a sum whose surface form needs an orthographic rule', () => {
    expect(checkExercise(sum, { kind: 'text', value: 'happy + ness' }).correct).toBe(true);
  });

  it('explains a sum built from the right morphemes but the wrong result', () => {
    const target: Exercise = { ...sum, id: 'e2b', answer: 'unhelpfulness' };
    const r = checkExercise(target, { kind: 'text', value: 'un + help + ness' });
    expect(r.correct).toBe(false);
    expect(r.feedback).toContain('拼写');
  });

  it('accepts alternatives and ignores case', () => {
    expect(checkExercise(cloze, { kind: 'text', value: 'PREDICTABLE' }).correct).toBe(true);
    expect(checkExercise(cloze, { kind: 'text', value: 'unpredictable' }).correct).toBe(true);
    expect(checkExercise(cloze, { kind: 'text', value: 'predictably' }).correct).toBe(false);
  });

  it('flags near misses', () => {
    expect(checkExercise(cloze, { kind: 'text', value: 'predictible' }).feedback).toBeDefined();
  });
});
