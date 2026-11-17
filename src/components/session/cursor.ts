/**
 * Session cursor: the position inside a lesson, persisted in
 * `LessonState.cursor` so a session can resume after leaving the page.
 *
 * Encoding: `stageOrdinal * 1000 + itemIndex`.
 *   0 review · 1 learn · 2 practice · 3 apply · 4 summary (4000)
 *
 * The ordinal is fixed by the canonical stage order, not by the *rendered*
 * stage list: the review stage disappears when nothing is due, and the cursor
 * must still decode to the same place.
 */
import type { Lesson } from '../../lib/types';

export const STAGE_KEYS = ['review', 'learn', 'practice', 'apply'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];
export type StageOrSummary = StageKey | 'summary';

export const STAGE_ORDER: StageKey[] = [...STAGE_KEYS];
export const SUMMARY_CURSOR = 4000;
const SPAN = 1000;

export interface StageInfo {
  key: StageKey;
  label: string;
  count: number;
}

const STAGE_LABEL: Record<StageKey, string> = {
  review: '复习',
  learn: '学习',
  practice: '练习',
  apply: '应用',
};

export function stageLabel(key: StageOrSummary): string {
  return key === 'summary' ? '小结' : STAGE_LABEL[key];
}

export function encodeCursor(stage: StageOrSummary, index = 0): number {
  if (stage === 'summary') return SUMMARY_CURSOR;
  const ordinal = STAGE_KEYS.indexOf(stage);
  const safe = Math.max(0, Math.min(SPAN - 1, Math.floor(index)));
  return Math.max(0, ordinal) * SPAN + safe;
}

export function decodeCursor(cursor: number): { stage: StageOrSummary; index: number } {
  if (!Number.isFinite(cursor) || cursor <= 0) return { stage: 'review', index: 0 };
  if (cursor >= SUMMARY_CURSOR) return { stage: 'summary', index: 0 };
  const ordinal = Math.floor(cursor / SPAN);
  const index = Math.floor(cursor % SPAN);
  return { stage: STAGE_KEYS[Math.min(ordinal, STAGE_KEYS.length - 1)], index };
}

/** Stages that actually have content, in canonical order. */
export function buildStages(lesson: Lesson, reviewCount: number): StageInfo[] {
  const list: StageInfo[] = [];
  if (reviewCount > 0) list.push({ key: 'review', label: STAGE_LABEL.review, count: reviewCount });
  if (lesson.cards.length > 0) list.push({ key: 'learn', label: STAGE_LABEL.learn, count: lesson.cards.length });
  if (lesson.practice.length > 0)
    list.push({ key: 'practice', label: STAGE_LABEL.practice, count: lesson.practice.length });
  if (lesson.apply.length > 0) list.push({ key: 'apply', label: STAGE_LABEL.apply, count: lesson.apply.length });
  return list;
}

/**
 * Human-readable position for the home page ("继续学习（第 N 步）").
 * N counts every item of every stage that would run before the cursor.
 */
export function stepNumber(lesson: Lesson, cursor: number, reviewCount: number): number {
  const pos = decodeCursor(cursor);
  if (pos.stage === 'summary') return 0;
  const counts: Record<StageKey, number> = {
    review: reviewCount,
    learn: lesson.cards.length,
    practice: lesson.practice.length,
    apply: lesson.apply.length,
  };
  const ordinal = STAGE_KEYS.indexOf(pos.stage);
  const before = STAGE_KEYS.slice(0, ordinal).reduce((sum, key) => sum + counts[key], 0);
  return before + pos.index + 1;
}

/**
 * Rough share of the lesson finished, derived from the cursor.
 * Stage granularity only — the exact item count lives in the session itself.
 */
export function cursorPercent(cursor: number): number {
  if (cursor <= 0) return 0;
  const pos = decodeCursor(cursor);
  if (pos.stage === 'summary') return 100;
  const ordinal = STAGE_KEYS.indexOf(pos.stage);
  return Math.min(95, Math.round(((ordinal + 0.5) / STAGE_KEYS.length) * 100));
}
