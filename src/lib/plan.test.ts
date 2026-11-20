import { beforeAll, describe, expect, it } from 'vitest';
import { lessons, loadLessons } from './content';
import { buildDailyPlan, computeStreak, redistribute } from './plan';
import { DEFAULT_SETTINGS, type MemoryCard } from './types';

const DAY = 86_400_000;
const now = Date.UTC(2026, 4, 10, 9);

function card(id: string, due: number, lapses = 0): MemoryCard {
  return {
    cardId: `concept:${id}`,
    kind: 'concept',
    refId: id,
    stability: 5,
    difficulty: 5,
    reps: 2,
    lapses,
    state: 2,
    due,
    lastReview: now - 3 * DAY,
  };
}

// Lessons are a lazily imported bundle now; hydrate them once for the suite.
beforeAll(async () => {
  await loadLessons();
});

describe('daily plan', () => {
  it('caps the review block and defers the rest', () => {
    const cards = Array.from({ length: 120 }, (_, i) => card(`c${i}`, now - DAY));
    const plan = buildDailyPlan({ cards, completed: new Set(), settings: DEFAULT_SETTINGS, now, introducedToday: 0 });
    expect(plan.reviewCards.length).toBeLessThanOrEqual(20);
    expect(plan.deferredCount).toBeGreaterThan(0);
  });

  it('puts the least retrievable cards first', () => {
    const fresh = { ...card('fresh', now - DAY), lastReview: now - DAY };
    const stale = { ...card('stale', now - 40 * DAY), lastReview: now - 40 * DAY };
    const plan = buildDailyPlan({
      cards: [fresh, stale],
      completed: new Set(),
      settings: DEFAULT_SETTINGS,
      now,
      introducedToday: 0,
    });
    expect(plan.reviewCards[0].refId).toBe('stale');
  });

  it('keeps the total budget close to the setting', () => {
    const plan = buildDailyPlan({ cards: [], completed: new Set(), settings: DEFAULT_SETTINGS, now, introducedToday: 0 });
    const total = Object.values(plan.minutes).reduce((a, b) => a + b, 0);
    expect(total).toBe(DEFAULT_SETTINGS.dailyMinutes);
  });

  it('marks a rest day when every lesson is finished and no review is due', () => {
    const allDone = new Set(lessons.map((l) => l.id));
    const plan = buildDailyPlan({
      cards: [],
      completed: allDone,
      settings: DEFAULT_SETTINGS,
      now,
      introducedToday: 0,
    });
    expect(plan.restDay).toBe(true);
    expect(plan.lesson).toBeUndefined();
  });

  it('is not a rest day while lessons remain', () => {
    const plan = buildDailyPlan({
      cards: [],
      completed: new Set(),
      settings: DEFAULT_SETTINGS,
      now,
      introducedToday: 0,
    });
    expect(plan.restDay).toBe(false);
    expect(plan.lesson).toBeDefined();
  });
});

describe('streak', () => {
  const key = (offset: number) => {
    const d = new Date(now - offset * DAY);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  };

  it('counts consecutive days ending today', () => {
    expect(computeStreak([key(0), key(1), key(2)], now)).toBe(3);
  });

  it('still counts when today has not been studied yet', () => {
    expect(computeStreak([key(1), key(2)], now)).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(computeStreak([key(0), key(2)], now)).toBe(1);
  });

  it('spreads deferred reviews instead of stacking them', () => {
    expect(redistribute(50, 20)).toEqual([20, 20, 10]);
  });
});
