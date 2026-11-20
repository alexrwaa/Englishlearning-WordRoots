import { describe, expect, it } from 'vitest';
import { boundaryCuts, checkExercise, drawCuts, expectedAnswer, expectedParts, normalizeWord } from './answer';
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
/* Boundary: the learner draws the cuts, so judging is positional      */
/* ------------------------------------------------------------------ */

const boundary: Exercise = {
  id: 'b1',
  kind: 'boundary',
  prompt: '把 unhelpfulness 切成词素',
  word: 'unhelpfulness',
  segments: ['un', 'help', 'ful', 'ness'],
  explain: 'un + help + ful + ness → unhelpfulness。',
};

const cutsOf = (value: number[]) => ({ kind: 'cuts' as const, value });

describe('boundary judging', () => {
  it('derives cut positions from the split itself', () => {
    expect(boundaryCuts(['un', 'help', 'ful', 'ness'])).toEqual([1, 5, 8]);
    expect(drawCuts('unhelpfulness', boundaryCuts(['un', 'help', 'ful', 'ness']))).toBe('un|help|ful|ness');
    expect(expectedParts(boundary)).toEqual(['un', 'help', 'ful', 'ness']);
  });

  it('accepts the right cuts regardless of tap order or repetition', () => {
    expect(checkExercise(boundary, cutsOf([1, 5, 8])).correct).toBe(true);
    expect(checkExercise(boundary, cutsOf([8, 1, 5])).correct).toBe(true);
    expect(checkExercise(boundary, cutsOf([1, 1, 5, 8])).correct).toBe(true);
  });

  it('judges on segments alone when the author omits answer', () => {
    const { answer: _omitted, ...withoutAnswer } = boundary as Extract<Exercise, { kind: 'boundary' }>;
    expect(_omitted).toBeUndefined();
    expect(checkExercise(withoutAnswer as Exercise, cutsOf([1, 5, 8])).correct).toBe(true);
    expect(checkExercise(withoutAnswer as Exercise, cutsOf([1, 5])).correct).toBe(false);
  });

  it('rejects an empty submission without blocking the flow', () => {
    const r = checkExercise(boundary, cutsOf([]));
    expect(r.correct).toBe(false);
    expect(r.feedback).toContain('还没有切任何一刀');
    expect(r.feedback).toContain('4 段');
  });

  it('names an extra cut and shows what the learner actually drew', () => {
    const r = checkExercise(boundary, cutsOf([1, 3, 5, 8]));
    expect(r.correct).toBe(false);
    expect(r.mistake).toBe('boundary');
    expect(r.feedback).toContain('多切了 1 刀');
    // The learner's drawing and the standard one are both spelled out.
    expect(r.feedback).toContain('un|he|lp|ful|ness');
    expect(r.feedback).toContain('un|help|ful|ness');
  });

  it('names a missing cut', () => {
    const r = checkExercise(boundary, cutsOf([1, 5]));
    expect(r.correct).toBe(false);
    expect(r.feedback).toContain('少切了 1 刀');
    expect(r.feedback).toContain('un|help|fulness');
  });

  it('rejects a typed answer instead of silently failing', () => {
    const r = checkExercise(boundary, text('un|help|ful|ness'));
    expect(r.correct).toBe(false);
    expect(r.feedback).toContain('点出切分位置');
  });

  it('refuses to mark a split whose segments do not build the word', () => {
    const broken = {
      ...(boundary as Extract<Exercise, { kind: 'boundary' }>),
      segments: ['un', 'help', 'full', 'ness'],
    };
    const r = checkExercise(broken, cutsOf([1, 5, 9]));
    expect(r.correct).toBe(false);
    expect(r.feedback).toContain('题目数据有误');
  });
});

/* ------------------------------------------------------------------ */
/* Judge: single choice, but every distractor must be justified        */
/* ------------------------------------------------------------------ */

const judge: Exercise = {
  id: 'j1',
  kind: 'judge',
  prompt: '下面哪个是真实英语词？',
  choices: ['unhelpfulness', 'unhelpness', 'helpfulnessless'],
  answer: 0,
  whyNot: ['-ness 只能接在形容词后，unhelp 不是形容词。', 'helpfulness 不能再接 -less 构成新词。'],
  explain: 'un + help + ful + ness 四层都能在词典里查到。',
};

describe('judge judging', () => {
  it('uses the correct choice as the expected answer', () => {
    expect(expectedAnswer(judge)).toBe('unhelpfulness');
    expect(checkExercise(judge, { kind: 'choice', index: 0 }).correct).toBe(true);
  });

  it('rejects a distractor', () => {
    const r = checkExercise(judge, { kind: 'choice', index: 1 });
    expect(r.correct).toBe(false);
    expect(r.expected).toBe('unhelpfulness');
  });

  it('does not throw on an out-of-range index', () => {
    const r = checkExercise(judge, { kind: 'choice', index: 7 });
    expect(r.correct).toBe(false);
    expect(r.expected).toBe('unhelpfulness');
  });

  it('rejects a text response', () => {
    expect(checkExercise(judge, text('unhelpfulness')).correct).toBe(false);
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

  it('every boundary split rebuilds its word and accepts its own cuts', () => {
    const boundaries = allExercises.filter(
      (e): e is Extract<Exercise, { kind: 'boundary' }> => e.kind === 'boundary',
    );
    for (const ex of boundaries) {
      expect(ex.segments.join(''), `${ex.id} segments`).toBe(ex.word.toLowerCase());
      expect(ex.segments.length, `${ex.id} needs >= 2 segments`).toBeGreaterThanOrEqual(2);
      const r = checkExercise(ex, cutsOf(boundaryCuts(ex.segments)));
      expect(r.correct, `${ex.id} rejected its own split`).toBe(true);
      if (ex.answer) {
        const trailingNoOp = ex.segments.length - 1;
        expect(ex.answer.filter((i) => i !== trailingNoOp), `${ex.id} answer`).toEqual(
          boundaryCuts(ex.segments),
        );
      }
    }
  });

  it('every judge justifies each of its distractors', () => {
    const judges = allExercises.filter((e): e is Extract<Exercise, { kind: 'judge' }> => e.kind === 'judge');
    for (const ex of judges) {
      expect(ex.whyNot.length, `${ex.id} whyNot`).toBe(ex.choices.length - 1);
      expect(ex.answer, `${ex.id} answer`).toBeGreaterThanOrEqual(0);
      expect(ex.answer, `${ex.id} answer`).toBeLessThan(ex.choices.length);
    }
  });
});
