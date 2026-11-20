/**
 * Boundary-exercise geometry: where the cuts fall, which are wrong, how to draw
 * them. Kept free of any content/lexicon import so Node tooling (the validator)
 * can use the same rules as the UI instead of re-deriving them.
 */
/**
 * The letter-gap indices implied by a canonical split. Gap `i` sits between
 * letter `i` and letter `i + 1`; the last segment ends at the word's end and so
 * carries no cut, which is why a split of `n` segments yields `n - 1` cuts.
 */
export function boundaryCuts(segments: string[]): number[] {
  const cuts: number[] = [];
  let at = 0;
  for (let i = 0; i < segments.length - 1; i += 1) {
    at += segments[i].length;
    if (at > 0) cuts.push(at - 1);
  }
  return cuts;
}

/** Which expected cuts are missing, and which cuts the learner added. */
export function cutDiff(expected: number[], got: number[]): { missing: number[]; extra: number[] } {
  const expectedSet = new Set(expected);
  const gotSet = new Set(got);
  return {
    missing: expected.filter((cut) => !gotSet.has(cut)),
    extra: got.filter((cut) => !expectedSet.has(cut)),
  };
}

/** The word with every cut drawn in, e.g. "un|help|ful|ness". */
export function drawCuts(word: string, cuts: number[]): string {
  const set = new Set(cuts);
  return [...word].map((letter, i) => (i < word.length - 1 && set.has(i) ? `${letter}|` : letter)).join('');
}

