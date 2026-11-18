import { describe, expect, it } from 'vitest';
import { checkExercise, expectedParts, normalizeWord } from './answer';
import { lessons } from './content';
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

const matrix: Exercise = {
  id: 'e4',
  kind: 'matrix',
  prompt: '用词基 help，加上前缀 un- 与后缀 -ful，写出结果',
  base: 'help',
  prefix: 'un',
  suffix: 'ful',
  answer: 'unhelpful',
  explain: 'un + help + ful → unhelpful。',
};

const text = (value: string) => ({ kind: 'text' as const, value });

describe('answer checking', () => {
  it('normalises spelling variants', () => {
    expect(normalizeWord('  Happi-ness. ')).toBe('happiness');
  });

  it('checks multiple choice by index', () => {
    expect(checkExercise(mcq, { kind: 'choice', index: 0 }).correct).toBe(true);
    expect(checkExercise(mcq, { kind: 'choice', index: 2 }).correct).toBe(false);
  });

  it('accepts alternatives and ignores case', () => {
    expect(checkExercise(cloze, text('PREDICTABLE')).correct).toBe(true);
    expect(checkExercise(cloze, text('unpredictable')).correct).toBe(true);
    expect(checkExercise(cloze, text('predictably')).correct).toBe(false);
  });

  it('flags near misses', () => {
    expect(checkExercise(cloze, text('predictible')).feedback).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* Word sum: the split itself is the skill, so a bare word must fail   */
/* ------------------------------------------------------------------ */

describe('word sum judging', () => {
  it('accepts the correct morpheme sequence', () => {
    expect(checkExercise(sum, text('happy + ness')).correct).toBe(true);
  });

  it('is tolerant of case, spaces and dictionary hyphens', () => {
    expect(checkExercise(sum, text('  HAPPY  +  -ness ')).correct).toBe(true);
  });

  it('ignores a result word copied from the card’s arrow notation', () => {
    const construction: Exercise = {
      id: 'w-sum-arrow',
      kind: 'wordSum',
      prompt: 'p',
      parts: ['con', 'struct', 'ion'],
      answer: 'construction',
      explain: 'e',
    };
    expect(checkExercise(construction, text('con + struct + ion → construction')).correct).toBe(true);
    expect(checkExercise(construction, text('con + struct + ion -> construction')).correct).toBe(true);
    expect(checkExercise(construction, text('con + struct + ion = construction')).correct).toBe(true);
    expect(checkExercise(construction, text('construction = con + struct + ion')).correct).toBe(true);
    expect(checkExercise(construction, text('con + struct + ion → ?')).correct).toBe(true);
  });

  it('rejects the whole word typed without a split', () => {
    const r = checkExercise(sum, text('happiness'));
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('not-a-sum');
    expect(r.feedback).toContain('+');
  });

  it('rejects the whole word even when it is spelled perfectly', () => {
    const construction: Exercise = {
      id: 'w-sum-1',
      kind: 'wordSum',
      prompt: '把词素拼成单词',
      parts: ['con', 'struct', 'ion'],
      answer: 'construction',
      explain: 'con + struct + ion → construction。',
    };
    expect(checkExercise(construction, text('construction')).correct).toBe(false);
    expect(checkExercise(construction, text('con + struct + ion')).correct).toBe(true);
  });

  it('rejects a morpheme that swallows the rest of the word', () => {
    const r = checkExercise(
      {
        id: 'w-sum-2',
        kind: 'wordSum',
        prompt: '把词素拼成单词',
        parts: ['con', 'struct', 'ion'],
        answer: 'construction',
        explain: 'con + struct + ion → construction。',
      },
      text('con + struction'),
    );
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('morpheme');
    expect(r.feedback).toContain('struction');
  });

  it('rejects a part that equals the whole answer', () => {
    const r = checkExercise(
      {
        id: 'w-sum-3',
        kind: 'wordSum',
        prompt: '把词素拼成单词',
        parts: ['con', 'struct', 'ion'],
        answer: 'construction',
        explain: 'con + struct + ion → construction。',
      },
      text('construction + ion'),
    );
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('morpheme');
  });

  it('names the missing morpheme when the split is incomplete', () => {
    const r = checkExercise(
      { ...sum, id: 'w-sum-4', parts: ['un', 'kind', 'ness'], answer: 'unkindness' },
      text('un + kind'),
    );
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('morpheme');
    expect(r.feedback).toContain('ness');
  });

  it('distinguishes the right morphemes in the wrong order', () => {
    const r = checkExercise(sum, text('ness + happy'));
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('order');
    expect(r.feedback).toContain('顺序');
    expect(r.feedback).toContain('happy + ness');
  });

  it('distinguishes a spelling-rule error from a morpheme error', () => {
    const r = checkExercise(sum, text('happyness'));
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('spelling');
    expect(r.feedback).toContain('y→i');
    expect(r.feedback).toContain('happiness');
  });

  it('applies y→i, drop-e, doubling and assimilation correctly', () => {
    const cases: Extract<Exercise, { kind: 'wordSum' }>[] = [
      { id: 's1', kind: 'wordSum', prompt: 'p', parts: ['happy', 'ly'], answer: 'happily', explain: 'e' },
      { id: 's2', kind: 'wordSum', prompt: 'p', parts: ['create', 'ive'], answer: 'creative', explain: 'e' },
      { id: 's3', kind: 'wordSum', prompt: 'p', parts: ['run', 'er'], answer: 'runner', explain: 'e' },
      { id: 's4', kind: 'wordSum', prompt: 'p', parts: ['in', 'legal'], answer: 'illegal', explain: 'e' },
      { id: 's5', kind: 'wordSum', prompt: 'p', parts: ['in', 'regular'], answer: 'irregular', explain: 'e' },
      {
        id: 's6',
        kind: 'wordSum',
        prompt: 'p',
        parts: ['loc', 'al', 'ize', 'ation'],
        answer: 'localization',
        explain: 'e',
      },
    ];
    for (const ex of cases) {
      const r = checkExercise(ex, text(ex.parts.join(' + ')));
      expect(r.correct, `${ex.parts.join(' + ')} -> ${ex.answer}`).toBe(true);
    }
  });

  it('rejects a bare word that skipped an assimilating prefix', () => {
    const r = checkExercise(
      { id: 's7', kind: 'wordSum', prompt: 'p', parts: ['in', 'legal'], answer: 'illegal', explain: 'e' },
      text('inlegal'),
    );
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('spelling');
    expect(r.feedback).toContain('同化');
  });
});

/* ------------------------------------------------------------------ */
/* Matrix: the morphemes are given, so the word itself is the answer   */
/* ------------------------------------------------------------------ */

describe('matrix judging', () => {
  it('derives the same parts as a word sum', () => {
    expect(expectedParts(matrix)).toEqual(['un', 'help', 'ful']);
  });

  it('accepts the assembled word', () => {
    expect(checkExercise(matrix, text('unhelpful')).correct).toBe(true);
  });

  it('also accepts an explicit sum and checks its order', () => {
    expect(checkExercise(matrix, text('un + help + ful')).correct).toBe(true);
    const wrongOrder = checkExercise(matrix, text('help + un + ful'));
    expect(wrongOrder.correct).toBe(false);
    expect(wrongOrder.mistake).toBe('order');
  });

  it('rejects a near miss and points at spelling rules', () => {
    const r = checkExercise(matrix, text('unhelpfull'));
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('spelling');
    expect(r.feedback).toContain('unhelpful');
  });

  it('accepts words whose surface form adds a silent e not present in the root', () => {
    const exclude: Exercise = {
      id: 'm2',
      kind: 'matrix',
      prompt: '用词基 clud 加前缀 ex-，写出“排除”',
      base: 'clud',
      prefix: 'ex',
      answer: 'exclude',
      explain: 'ex + clud(e) → exclude。',
    };
    expect(checkExercise(exclude, text('exclude')).correct).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Whole-curriculum invariants                                         */
/* ------------------------------------------------------------------ */

describe('content invariants', () => {
  const allExercises = lessons.flatMap((lesson) => [...lesson.practice, ...lesson.apply]);

  it('every wordSum is solvable from its own parts', () => {
    const failing: string[] = [];
    for (const ex of allExercises.filter((e) => e.kind === 'wordSum')) {
      const r = checkExercise(ex, text(ex.parts.join(' + ')));
      if (!r.correct) failing.push(ex.id);
    }
    expect(failing).toEqual([]);
  });

  it('every wordSum rejects its bare answer to keep the split mandatory', () => {
    for (const ex of allExercises.filter((e) => e.kind === 'wordSum')) {
      const bare = String(ex.answer);
      expect(checkExercise(ex, text(bare)).correct, `${ex.id} accepted "${bare}"`).toBe(false);
    }
  });

  it('every matrix accepts its answer word', () => {
    for (const ex of allExercises.filter((e) => e.kind === 'matrix')) {
      const r = checkExercise(ex, text(String(ex.answer)));
      expect(r.correct, `${ex.id} rejected "${ex.answer}"`).toBe(true);
    }
  });
});
