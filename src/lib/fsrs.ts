/**
 * FSRS-based scheduler (free spaced repetition scheduler, FSRS-5 formulation).
 *
 * Implemented from the published FSRS-5 equations so the app does not depend on
 * a network model. Two independent memory systems are tracked:
 *
 *  - `concept`   cards: can the learner recall a morpheme/rule/word-family fact?
 *  - `inference` cards: can the learner *transfer* that knowledge to analyse an
 *    unfamiliar word? These are scheduled from inference exercises only, so that
 *    remembering a gloss never inflates the transfer rating.
 */

export type Rating = 1 | 2 | 3 | 4; // again | hard | good | easy

export interface SchedulingState {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  due: number;
  lastReview: number | null;
}

export const DAY = 86_400_000;

/** FSRS-5 default weights. */
export const DEFAULT_W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
  1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // 0.9^(1/DECAY) - 1

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + FACTOR * (t / stability), DECAY);
}

function initialStability(rating: Rating, w: readonly number[]): number {
  return Math.max(0.1, w[rating - 1]);
}

/**
 * FSRS-5 initial difficulty (paper eq. 4):
 *   D0(G) = w4 - e^(w5 * (G - 1)) + 1
 * The earlier exponential form replaced the linear FSRS-4.5 formula; using the
 * linear form with FSRS-5 weights makes the first difficulty far too high and
 * poisons every later stability update.
 */
function initialDifficulty(rating: Rating, w: readonly number[]): number {
  return clamp(w[4] - Math.exp((rating - 1) * w[5]) + 1, 1, 10);
}

/**
 * FSRS-5 difficulty update (paper eq. 5): linear damping toward 10, then mean
 * reversion to D0(Easy). `w[6]` is the rating delta and `w[7]` the reversion
 * weight — not w[5]/w[6] as in FSRS-4.5.
 */
function nextDifficulty(d: number, rating: Rating, w: readonly number[]): number {
  const delta = -w[6] * (rating - 3);
  const damped = d + (delta * (10 - d)) / 9;
  return clamp(w[7] * initialDifficulty(4, w) + (1 - w[7]) * damped, 1, 10);
}

function nextShortTermStability(s: number, rating: Rating, w: readonly number[]): number {
  return clamp(s * Math.exp(w[17] * (rating - 3 + w[18])), 0.01, 36500);
}

function stabilityAfterRecall(
  s: number,
  d: number,
  r: number,
  rating: Rating,
  w: readonly number[],
): number {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  const growth =
    1 +
    Math.exp(w[8]) *
      (11 - d) *
      Math.pow(s, -w[9]) *
      (Math.exp((1 - r) * w[10]) - 1) *
      hardPenalty *
      easyBonus;
  return clamp(s * growth, 0.01, 36500);
}

function stabilityAfterForget(
  s: number,
  d: number,
  r: number,
  w: readonly number[],
): number {
  const sf =
    w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
  return clamp(sf, 0.01, 36500);
}

/** Interval in days for a target retention. */
export function intervalFor(stability: number, targetRetention = 0.9): number {
  const r = clamp(targetRetention, 0.7, 0.99);
  const raw = (stability / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, 36500);
}

export interface ReviewArgs {
  state: SchedulingState;
  rating: Rating;
  now: number;
  targetRetention?: number;
  weights?: readonly number[];
}

export function review(args: ReviewArgs): SchedulingState {
  const { state, rating, now } = args;
  const w = args.weights ?? DEFAULT_W;
  const retention = args.targetRetention ?? 0.9;

  if (state.state === 0 || state.lastReview === null || state.stability <= 0) {
    const s = initialStability(rating, w);
    const d = initialDifficulty(rating, w);
    const base = {
      stability: s,
      difficulty: d,
      reps: state.reps + 1,
      lapses: state.lapses,
      lastReview: now,
    };
    // FSRS-5 learning steps for a brand-new card.
    if (rating === 1) return { ...base, state: 1, due: now + 60_000 };
    if (rating === 2) return { ...base, state: 1, due: now + 5 * 60_000 };
    if (rating === 3) return { ...base, state: 1, due: now + 10 * 60_000 };
    return { ...base, state: 2, due: now + intervalFor(s, retention) * DAY };
  }

  const elapsedDays = Math.max(0, Math.floor((now - state.lastReview) / DAY));
  const d = nextDifficulty(state.difficulty, rating, w);

  // Learning / relearning steps keep the card in the short-term scheduler.
  if (state.state === 1 || state.state === 3) {
    const s = nextShortTermStability(state.stability, rating, w);
    const base = {
      stability: s,
      difficulty: d,
      reps: state.reps + 1,
      lapses: state.lapses,
      state: state.state,
      lastReview: now,
    };
    if (rating === 1) return { ...base, due: now + 5 * 60_000 };
    if (rating === 2) return { ...base, due: now + 10 * 60_000 };
    if (rating === 3) {
      return { ...base, state: 2, due: now + intervalFor(s, retention) * DAY };
    }
    const goodStep = nextShortTermStability(state.stability, 3, w);
    const days = Math.max(intervalFor(s, retention), intervalFor(goodStep, retention) + 1);
    return { ...base, state: 2, due: now + days * DAY };
  }

  const r = retrievability(elapsedDays, state.stability);
  // Stability updates use the difficulty the card had *at* this review; the
  // updated difficulty is only stored for the next review (FSRS-5 eq. 6/7).
  const sAgain = stabilityAfterForget(state.stability, state.difficulty, r, w);

  if (rating === 1) {
    return {
      stability: sAgain,
      difficulty: d,
      reps: state.reps + 1,
      lapses: state.lapses + 1,
      state: 3,
      due: now + 5 * 60_000,
      lastReview: now,
    };
  }

  const sHard = stabilityAfterRecall(state.stability, state.difficulty, r, 2, w);
  const sGood = stabilityAfterRecall(state.stability, state.difficulty, r, 3, w);
  const sEasy = stabilityAfterRecall(state.stability, state.difficulty, r, 4, w);

  // FSRS-5 orders the four candidate intervals so a harder rating can never be
  // scheduled later than an easier one (again < hard < good < easy).
  const hardDays = Math.max(intervalFor(sHard, retention), intervalFor(sAgain, retention) + 1);
  const goodDays = Math.max(intervalFor(sGood, retention), hardDays + 1);
  const easyDays = Math.max(intervalFor(sEasy, retention), goodDays + 1);
  const [s, days] = rating === 2 ? [sHard, hardDays] : rating === 3 ? [sGood, goodDays] : [sEasy, easyDays];

  return {
    stability: s,
    difficulty: d,
    reps: state.reps + 1,
    lapses: state.lapses,
    state: 2,
    due: now + days * DAY,
    lastReview: now,
  };
}

/** Convert a first-attempt outcome into an FSRS rating. */
export function ratingForOutcome(correct: boolean, usedHint: boolean, fast: boolean): Rating {
  if (!correct) return 1;
  if (usedHint) return 2;
  return fast ? 4 : 3;
}

/** Predicted recall probability at `now` — used to order reviews by risk. */
export function currentRetention(state: SchedulingState, now: number): number {
  if (state.lastReview === null || state.stability <= 0) return 0;
  return retrievability((now - state.lastReview) / DAY, state.stability);
}

export function newCard(cardId: string, kind: 'concept' | 'inference', refId: string, now: number): (SchedulingState & { cardId: string; kind: 'concept' | 'inference'; refId: string }) {
  return {
    cardId,
    kind,
    refId,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    due: now,
    lastReview: null,
  };
}
