import { checkWordSum, editDistance } from './morph';
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

export interface CheckResult {
  correct: boolean;
  expected: string;
  /** Short, specific feedback shown after answering. */
  feedback?: string;
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

export function checkExercise(ex: Exercise, response: Response): CheckResult {
  const expected = expectedAnswer(ex);

  if (ex.kind === 'mcq' || ex.kind === 'infer') {
    if (response.kind !== 'choice') return { correct: false, expected };
    return { correct: response.index === ex.answer, expected };
  }

  if (response.kind !== 'text') return { correct: false, expected };
  const value = response.value;

  if (ex.kind === 'wordSum') {
    const parts = value.split(/[+＋]/).map((p) => p.trim()).filter(Boolean);
    const target = normalizeWord(ex.answer);
    if (parts.length === 0) return { correct: false, expected: ex.answer };
    if (normalizeWord(parts.join('')) === target) return { correct: true, expected: ex.answer };
    // Accept the sum when the joining rules produce the right spelling.
    if (checkWordSum(parts, ex.answer).ok) return { correct: true, expected: ex.answer };
    // The parts may be right but joined with the wrong spelling rule.
    const morphemesRight =
      parts.length > 0 && parts.every((p) => normalizeWord(ex.answer).includes(normalizeWord(p)));
    return {
      correct: false,
      expected: ex.answer,
      feedback: morphemesRight
        ? `词素选对了，但拼接后的拼写是 “${parts.join('')}”。注意拼写规则（去 e、y→i、辅音双写等）。`
        : undefined,
    };
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
