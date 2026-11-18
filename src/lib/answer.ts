import {
  checkWordSum,
  editDistance,
  normalizeParts,
  partsMatch,
  samePartSet,
  type SpellingStep,
} from './morph';
import type { Exercise } from './types';

export type Response = { kind: 'choice'; index: number } | { kind: 'text'; value: string };

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Free-text answers are compared ignoring case, spaces, hyphens and punctuation. */
export function normalizeWord(s: string): string {
  return normalize(s).replace(/[\s\-.,;:!?"'()]/g, '');
}

/**
 * Why an answer was rejected. The three learner-facing layers are distinct on
 * purpose: picking the wrong morphemes, ordering the right morphemes wrongly,
 * and misspelling the assembled word need different remedial action.
 */
export type MistakeKind = 'morpheme' | 'order' | 'spelling' | 'not-a-sum';

export interface CheckResult {
  correct: boolean;
  expected: string;
  /** Short, specific feedback shown after answering. */
  feedback?: string;
  /** Machine-readable reason; kept out of the UI. */
  mistake?: MistakeKind;
}

export function expectedAnswer(ex: Exercise): string {
  switch (ex.kind) {
    case 'mcq':
    case 'infer':
      return ex.choices[ex.answer] ?? '';
    case 'cloze':
    case 'wordSum':
    case 'matrix':
      return ex.answer;
  }
}

/**
 * The morphemes a word-building exercise is made of, in spelling order.
 * `matrix` is a word sum whose parts are supplied by the prompt
 * (prefix + base + suffix), so it is judged by the same engine.
 */
export function expectedParts(ex: Exercise): string[] {
  if (ex.kind === 'wordSum') return ex.parts;
  if (ex.kind === 'matrix') {
    return [ex.prefix, ex.base, ex.suffix].filter((part): part is string => Boolean(part));
  }
  return [];
}

const RULE_LABELS: { test: RegExp; label: string }[] = [
  { test: /assimilat/i, label: '前缀同化' },
  { test: /y becomes i/i, label: 'y→i' },
  { test: /silent e/i, label: '去 e' },
  { test: /doubles/i, label: '辅音双写' },
];

function ruleLabels(steps: SpellingStep[]): string[] {
  const found = new Set<string>();
  for (const step of steps) {
    for (const { test, label } of RULE_LABELS) {
      if (test.test(step.rule)) found.add(label);
    }
  }
  return [...found];
}

function quoteList(items: string[]): string {
  return items.map((item) => `“${item}”`).join('、');
}

function missingExtra(actual: string[], expected: string[]): { missing: string[]; extra: string[] } {
  const pool = [...expected];
  const missing: string[] = [];
  for (const part of actual) {
    const i = pool.indexOf(part);
    if (i >= 0) pool.splice(i, 1);
  }
  missing.push(...pool);

  const expectedPool = [...expected];
  const extra: string[] = [];
  for (const part of actual) {
    const i = expectedPool.indexOf(part);
    if (i >= 0) expectedPool.splice(i, 1);
    else extra.push(part);
  }
  return { missing, extra };
}

/** Name the spelling rule that turns the morphemes into the answer, if any. */
function spellingHint(expected: string[], answer: string): { labels: string[]; built: string } {
  const built = checkWordSum(expected, answer);
  return { labels: ruleLabels(built.steps), built: built.produced };
}

function morphemeFeedback(ex: Exercise): string {
  const parts = expectedParts(ex);
  return `词素切分不对：这道题要拆成 ${parts.length} 个词素。先找前缀 / 词根 / 后缀的边界，再用 + 连接（例如 ${parts.join(
    ' + ',
  )}）。`;
}

function orderFeedback(userParts: string[], expected: string[]): string {
  return `词素选对了，但顺序不对。词素要按单词中的书写顺序排列：前缀 → 词根 → 后缀。你写的是 ${userParts.join(
    ' + ',
  )}，正确顺序是 ${expected.join(' + ')}。`;
}

const RESULT_ARROW = /\s*(?:→|⟶|➜|⇒|->|=>)\s*/u;
const EQUALS = /\s*(?:=|＝)\s*/u;

function plusCount(s: string): number {
  return (s.match(/[+＋]/g) ?? []).length;
}

/**
 * Course cards render sums as `un + help + ful → unhelpful`, so learners often
 * copy the whole line into the answer box. Take the side of the arrow/equals
 * that actually contains a sum; otherwise the trailing result word would be
 * glued to the last morpheme and produce misleading "missing morpheme" advice.
 */
function sumSideOf(input: string): string {
  for (const separator of [RESULT_ARROW, EQUALS]) {
    const sides = input.split(separator);
    if (sides.length > 1) {
      const best = sides.reduce((a, b) => (plusCount(b) > plusCount(a) ? b : a), sides[0]);
      if (plusCount(best) > 0) return best.trim();
    }
  }
  return input;
}

/**
 * Judge a word-building answer.
 *
 * A bare word is never accepted for `wordSum`: the exercise exists to test the
 * morpheme split, so accepting the whole word would skip the skill entirely.
 * `matrix` shows its morphemes in the prompt and asks for the resulting word,
 * so there a bare word is the intended answer; if the learner supplies a sum
 * instead, the full segmentation checks apply as well.
 */
function checkWordBuilding(ex: Exercise, value: string): CheckResult {
  const expected = normalizeParts(expectedParts(ex));
  const answer = String(ex.answer).trim();
  const target = normalizeWord(answer);
  const typed = sumSideOf(value.trim());
  const hasSum = /[+＋]/.test(typed);

  if (!hasSum) {
    const got = normalizeWord(typed);
    if (!got) return { correct: false, expected: answer, mistake: 'not-a-sum' };

    if (ex.kind === 'matrix') {
      if (got === target) return { correct: true, expected: answer };
      const distance = editDistance(target, got);
      return {
        correct: false,
        expected: answer,
        mistake: distance <= 2 ? 'spelling' : 'morpheme',
        feedback:
          distance <= 2
            ? `差一点：检查拼写规则（去 e、y→i、辅音双写、前缀同化）。${expected.join(' + ')} 应拼成 “${answer}”。`
            : `这不是题干词素拼出的词。题目给的是 ${expected.join(' + ')}，先把它们按顺序接起来再写出结果。`,
      };
    }

    // wordSum: the whole word is the bypass we must close.
    if (got === target) {
      return {
        correct: false,
        expected: answer,
        mistake: 'not-a-sum',
        feedback: `写对了单词，但没有做构词分析。请用 + 写出词素切分（例如 ${expected.join(
          ' + ',
        )}），这样才能确认你理解了词素边界。`,
      };
    }

    const { labels, built } = spellingHint(expected, answer);
    const distance = editDistance(target, got);
    if (distance <= 2 || got === normalizeWord(expected.join(''))) {
      return {
        correct: false,
        expected: answer,
        mistake: 'spelling',
        feedback: `词素可能是对的，但拼写规则用错了：${
          labels.length > 0 ? `注意「${labels.join('、')}」` : '检查词素拼接后的拼写'
        }。${expected.join(' + ')} 应拼成 “${built}”，不是 “${typed}”。请用 + 写出词素切分。`,
      };
    }
    return {
      correct: false,
      expected: answer,
      mistake: 'morpheme',
      feedback: morphemeFeedback(ex),
    };
  }

  const userParts = typed
    .split(/[+＋]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const normalizedUser = normalizeParts(userParts);

  if (normalizedUser.length < 2) {
    return {
      correct: false,
      expected: answer,
      mistake: 'morpheme',
      feedback: `一个词素构不成构词算式。请至少拆成两块再用 + 连接（例如 ${expected.join(' + ')}）。`,
    };
  }

  // A part equal to the whole word is another way of smuggling the answer in.
  if (normalizedUser.some((part) => part === target)) {
    return {
      correct: false,
      expected: answer,
      mistake: 'morpheme',
      feedback: `词素不能等于整词 “${answer}”。请把整词切成词素，再用 + 连接。`,
    };
  }

  if (!samePartSet(normalizedUser, expected)) {
    const { missing, extra } = missingExtra(normalizedUser, expected);
    const detail = [
      missing.length > 0 ? `还缺少 ${quoteList(missing)}` : '',
      extra.length > 0 ? `${quoteList(extra)} 不是这道题的词素` : '',
    ]
      .filter(Boolean)
      .join('；');
    return {
      correct: false,
      expected: answer,
      mistake: 'morpheme',
      feedback: `词素选错了${detail ? `：${detail}` : ''}。先按词素边界切开，再用 + 按顺序连接。`,
    };
  }

  if (!partsMatch(normalizedUser, expected)) {
    return {
      correct: false,
      expected: answer,
      mistake: 'order',
      feedback: orderFeedback(normalizedUser, expected),
    };
  }

  // Morphemes are right; now the orthographic rules must produce the answer
  // character for character. A mismatch here can only mean the content's
  // analysis does not actually build its own answer.
  const built = checkWordSum(normalizedUser, answer);
  if (!built.ok || built.produced.toLowerCase() !== answer.toLowerCase()) {
    const labels = ruleLabels(built.steps);
    return {
      correct: false,
      expected: answer,
      mistake: 'spelling',
      feedback: `词素选对了，但按拼写规则应拼成 “${built.produced}”，与答案 “${answer}” 不一致${
        labels.length > 0 ? `（涉及${labels.join('、')}）` : ''
      }。这通常说明题目的词素分析需要校对，请把这条反馈给课程作者。`,
    };
  }

  return { correct: true, expected: answer };
}

export function checkExercise(ex: Exercise, response: Response): CheckResult {
  const expected = expectedAnswer(ex);

  if (ex.kind === 'mcq' || ex.kind === 'infer') {
    if (response.kind !== 'choice') return { correct: false, expected };
    return { correct: response.index === ex.answer, expected };
  }

  if (response.kind !== 'text') return { correct: false, expected };
  const value = response.value;

  if (ex.kind === 'wordSum' || ex.kind === 'matrix') {
    return checkWordBuilding(ex, value);
  }

  const candidates = [ex.answer, ...('accept' in ex ? ex.accept ?? [] : [])].map(normalizeWord);
  const got = normalizeWord(value);
  if (!got) return { correct: false, expected: ex.answer };
  if (candidates.includes(got)) return { correct: true, expected: ex.answer };

  const distance = Math.min(...candidates.map((c) => editDistance(c, got)));
  return {
    correct: false,
    expected: ex.answer,
    feedback: distance <= 2 ? '非常接近：检查一下拼写或词素边界。' : undefined,
  };
}
