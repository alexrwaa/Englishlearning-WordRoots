/**
 * Daily plan builder. Time is a budget, not a countdown: overdue reviews are
 * capped and the remainder is re-spread over the following days instead of
 * piling up after a missed day.
 */
import { currentRetention, intervalFor } from './fsrs';
import { lessons } from './content';
import type { Lesson, MemoryCard, Settings } from './types';

export const DAY = 86_400_000;

export interface DailyPlan {
  lesson?: Lesson;
  /** Cards selected for the 5-minute review block, hardest first. */
  reviewCards: MemoryCard[];
  /** Reviews that exist but were deferred to keep the day within budget. */
  deferredCount: number;
  minutes: { review: number; learn: number; practice: number; apply: number };
  newCards: number;
  /** Set when the learner already finished everything scheduled. */
  restDay: boolean;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Rough per-item time costs used to fit the plan into the daily budget. */
const SECONDS_PER_REVIEW = 22;
const SECONDS_PER_EXERCISE = 55;

export function buildDailyPlan(args: {
  cards: MemoryCard[];
  completed: Set<string>;
  settings: Settings;
  now: number;
  /** Number of new concept cards already introduced today. */
  introducedToday: number;
}): DailyPlan {
  const { cards, completed, settings, now, introducedToday } = args;
  const budget = settings.dailyMinutes;
  const reviewMinutes = Math.max(3, Math.round(budget * 0.2));
  const learnMinutes = Math.max(6, Math.round(budget * 0.32));
  const practiceMinutes = Math.max(5, Math.round(budget * 0.28));
  const applyMinutes = Math.max(3, budget - reviewMinutes - learnMinutes - practiceMinutes);

  const due = cards
    .filter((c) => c.state > 0 && c.due <= now + 60_000)
    .map((c) => ({ c, retention: currentRetention(c, now) }))
    .sort((a, b) => a.retention - b.retention || b.c.lapses - a.c.lapses)
    .map((x) => x.c);

  const reviewCap = Math.max(4, Math.floor((reviewMinutes * 60) / SECONDS_PER_REVIEW));
  const reviewCards = due.slice(0, reviewCap);

  // A day's worth of new material: cap by both the setting and the time budget.
  const maxNew = Math.max(2, Math.min(settings.newCardsPerDay, Math.floor((practiceMinutes * 60) / (SECONDS_PER_EXERCISE * 2))));
  const newCards = Math.max(0, maxNew - introducedToday);

  const lesson = lessons.find((l) => !completed.has(l.id));

  return {
    lesson,
    reviewCards,
    deferredCount: Math.max(0, due.length - reviewCards.length),
    minutes: { review: reviewMinutes, learn: learnMinutes, practice: practiceMinutes, apply: applyMinutes },
    newCards,
    restDay: !lesson && reviewCards.length === 0,
  };
}

/** Consecutive days with at least one recorded attempt, ending today or yesterday. */
export function computeStreak(days: string[], now: number): number {
  const set = new Set(days);
  let streak = 0;
  let cursor = now;
  if (!set.has(dayKey(cursor))) cursor -= DAY;
  while (set.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

export function todayKey(now: number): string {
  return dayKey(now);
}

/** Distribute deferred reviews over the next days so no day explodes. */
export function redistribute(dueCount: number, cap: number): number[] {
  if (dueCount <= cap) return [dueCount];
  const days = Math.ceil(dueCount / cap);
  const out: number[] = [];
  let left = dueCount;
  for (let i = 0; i < days; i++) {
    const take = Math.min(cap, left);
    out.push(take);
    left -= take;
  }
  return out;
}

/** Next interval preview shown under the rating buttons. */
export function previewInterval(card: MemoryCard, rating: 1 | 2 | 3 | 4, retention: number): string {
  const stability = card.stability || 1;
  const factor = rating === 1 ? 0.35 : rating === 2 ? 0.8 : rating === 3 ? 1.35 : 1.9;
  const days = intervalFor(stability * factor, retention);
  if (days < 1) return '<1 天';
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.round(days / 30)} 个月`;
  return `${(days / 365).toFixed(1)} 年`;
}
