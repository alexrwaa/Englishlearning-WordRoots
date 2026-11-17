import { describe, expect, it } from 'vitest';
import { DAY, currentRetention, intervalFor, newCard, review, retrievability } from './fsrs';

const now = Date.UTC(2026, 0, 1);
const base = newCard('concept:test', 'concept', 'test', now);

describe('fsrs', () => {
  it('starts a new card with the initial stability of the rating', () => {
    const s = review({ state: base, rating: 3, now });
    expect(s.stability).toBeGreaterThan(0);
    expect(s.reps).toBe(1);
    expect(s.state).toBe(2);
    expect(s.due).toBeGreaterThan(now);
  });

  it('rates easy above good above hard above again', () => {
    const again = review({ state: base, rating: 1, now });
    const hard = review({ state: base, rating: 2, now });
    const good = review({ state: base, rating: 3, now });
    const easy = review({ state: base, rating: 4, now });
    expect(hard.stability).toBeGreaterThan(again.stability);
    expect(good.stability).toBeGreaterThan(hard.stability);
    expect(easy.stability).toBeGreaterThan(good.stability);
    expect(easy.difficulty).toBeLessThan(again.difficulty);
  });

  it('grows the interval when the answer is correct on time', () => {
    let state = review({ state: base, rating: 3, now });
    const firstInterval = state.due - now;
    state = review({ state, rating: 3, now: state.due });
    const secondInterval = state.due - state.lastReview!;
    expect(secondInterval).toBeGreaterThan(firstInterval);
  });

  it('lowers stability after a lapse', () => {
    let state = review({ state: base, rating: 3, now });
    state = review({ state, rating: 3, now: state.due });
    const stable = state.stability;
    const lapsed = review({ state, rating: 1, now: state.due });
    expect(lapsed.stability).toBeLessThanOrEqual(stable);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe(3);
  });

  it('keeps difficulty inside 1..10 across many reviews', () => {
    let state = review({ state: base, rating: 1, now });
    for (let i = 0; i < 30; i++) {
      state = review({ state, rating: i % 2 === 0 ? 1 : 4, now: state.due });
      expect(state.difficulty).toBeGreaterThanOrEqual(1);
      expect(state.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it('retrievability decays with time and matches the target at the interval', () => {
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 2);
    expect(retrievability(30, 10)).toBeLessThan(0.9);
  });

  it('converts stability into an interval of at least one day', () => {
    expect(intervalFor(0.01)).toBe(1);
    expect(intervalFor(10, 0.9)).toBeGreaterThanOrEqual(9);
    expect(intervalFor(3650, 0.9)).toBeGreaterThan(3000);
  });

  it('reports near-zero retention for a card reviewed far in the past', () => {
    const state = review({ state: base, rating: 3, now });
    expect(currentRetention(state, now + 400 * DAY)).toBeLessThan(0.2);
  });

  it('schedules same-day repeats within the day', () => {
    const state = review({ state: base, rating: 3, now });
    const againToday = review({ state, rating: 1, now: now + 60_000 });
    expect(againToday.due - (now + 60_000)).toBeLessThanOrEqual(DAY);
  });
});
