import { describe, expect, it } from 'vitest';
import { createEmptyCard, fsrs, generatorParameters, Rating as RefRating, type Grade } from 'ts-fsrs';
import {
  DAY,
  currentRetention,
  intervalFor,
  newCard,
  review,
  retrievability,
  type Rating,
  type SchedulingState,
} from './fsrs';

const now = Date.UTC(2026, 0, 1);
const base = newCard('concept:test', 'concept', 'test', now);

describe('fsrs', () => {
  it('starts a new card in the learning state after a good answer', () => {
    const s = review({ state: base, rating: 3, now });
    expect(s.stability).toBeGreaterThan(0);
    expect(s.reps).toBe(1);
    expect(s.state).toBe(1);
    expect(s.due).toBeGreaterThan(now);
  });

  it('uses the FSRS-5 exponential initial difficulty, not the 4.5 linear form', () => {
    const good = review({ state: base, rating: 3, now });
    // w4 - e^(w5*(3-1)) + 1 = 7.1949 - e^1.069 + 1
    expect(good.difficulty).toBeCloseTo(5.2824, 3);
    const again = review({ state: base, rating: 1, now });
    expect(again.difficulty).toBeCloseTo(7.1949, 3);
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

/* ------------------------------------------------------------------ */
/* Cross-validation against the reference ts-fsrs implementation       */
/* ------------------------------------------------------------------ */

const refFsrs = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: true }));
const REF_RATING: Record<Rating, RefRating> = {
  1: RefRating.Again,
  2: RefRating.Hard,
  3: RefRating.Good,
  4: RefRating.Easy,
};

function relativeError(actual: number, reference: number): number {
  if (reference === 0) return Math.abs(actual);
  return Math.abs(actual - reference) / reference;
}

describe('fsrs vs ts-fsrs (FSRS-5 reference)', () => {
  // The reference library exposes the canonical FSRS-5 equations and default
  // weights. Fuzz is disabled because it deliberately randomises intervals and
  // would make the comparison non-deterministic; everything else is left at
  // its default (learning steps enabled).
  const start = Date.UTC(2026, 0, 1);
  const ratings: Rating[] = [3, 3, 1, 2, 3, 4];
  const gaps = [1, 3, 7, 15, 30];

  it('matches stability, difficulty, state and due for the same rating chain', () => {
    let ours: SchedulingState = newCard('concept:cross', 'concept', 'cross', start);
    let ref = createEmptyCard(new Date(start));
    let at = start;

    for (let i = 0; i < ratings.length; i++) {
      if (i > 0) at += gaps[i - 1] * DAY;
      const rating = ratings[i];

      ours = review({ state: ours, rating, now: at });
      ref = refFsrs.next(ref, new Date(at), REF_RATING[rating] as Grade).card;

      expect(relativeError(ours.stability, ref.stability)).toBeLessThanOrEqual(0.02);
      expect(relativeError(ours.difficulty, ref.difficulty)).toBeLessThanOrEqual(0.02);
      expect(ours.state).toBe(ref.state);
      expect(Math.abs(ours.due - ref.due.getTime())).toBeLessThanOrEqual(DAY);
    }
  });

  it('keeps stability monotonic for a run of correct answers', () => {
    let state: SchedulingState = newCard('concept:good', 'concept', 'good', start);
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      state = review({ state, rating: 3, now: i === 0 ? start : state.due });
      seen.push(state.stability);
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
  });

  it('never lowers difficulty when answers keep failing', () => {
    let state: SchedulingState = newCard('concept:bad', 'concept', 'bad', start);
    const seen: number[] = [];
    let at = start;
    for (let i = 0; i < 6; i++) {
      state = review({ state, rating: 1, now: at });
      seen.push(state.difficulty);
      at = state.due;
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] - 1e-9);
    }
  });

  it('matches the reference across a deterministic pseudo-random rating stream', () => {
    let worstStability = 0;
    let worstDifficulty = 0;
    let worstDue = 0;
    let stateMismatches = 0;

    for (let seed = 0; seed < 10; seed++) {
      let ours: SchedulingState = newCard(`concept:rand-${seed}`, 'concept', 'rand', start);
      let ref = createEmptyCard(new Date(start));
      let at = start;
      let x = seed * 7919 + 13;

      for (let step = 0; step < 25; step++) {
        if (step > 0) {
          x = (x * 1103515245 + 12345) & 0x7fffffff;
          at += (1 + (x % 45)) * DAY;
        }
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        const rating = ((x % 4) + 1) as Rating;

        ours = review({ state: ours, rating, now: at });
        ref = refFsrs.next(ref, new Date(at), REF_RATING[rating] as Grade).card;

        worstStability = Math.max(worstStability, relativeError(ours.stability, ref.stability));
        worstDifficulty = Math.max(worstDifficulty, relativeError(ours.difficulty, ref.difficulty));
        worstDue = Math.max(worstDue, Math.abs(ours.due - ref.due.getTime()) / DAY);
        if (ours.state !== ref.state) stateMismatches += 1;
      }
    }

    expect(worstStability).toBeLessThanOrEqual(0.02);
    expect(worstDifficulty).toBeLessThanOrEqual(0.02);
    expect(worstDue).toBeLessThanOrEqual(1);
    expect(stateMismatches).toBe(0);
  });
});
