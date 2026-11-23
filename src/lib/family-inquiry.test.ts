/**
 * Inquiry rules (0.11.0).
 *
 * The teaching claim is that a learner can discover the pattern instead of being
 * told it, so the tests check the rules that make that claim honest: the first
 * step must not leak the split, grading must only touch factual answers, and a
 * word the lexicon lacks must not be presented as non-existent.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildInquiry, checkSum, compareHypothesis, loadProgress, saveProgress, splitSum, tierLabel, tierOf } from './family-inquiry';
import type { FamilyDossier } from './content';

const dossier = JSON.parse(
  readFileSync('src/content/families/fam-spect.json', 'utf8'),
) as FamilyDossier;

const known = (word: string) => ['inspect', 'spectator', 'respect'].includes(word);

describe('buildInquiry', () => {
  const model = buildInquiry(dossier, known);

  it('offers the six SWI steps in order', () => {
    expect(model.steps.map((s) => s.id)).toEqual([
      'observe',
      'discover',
      'hypothesize',
      'verify',
      'counterexample',
      'summarize',
    ]);
  });

  it('observes with word forms only — no split, no gloss', () => {
    expect(model.observe.length).toBeGreaterThanOrEqual(4);
    for (const item of model.observe) {
      // A form is a single lowercase word; anything with "+" or a space would be
      // the answer leaking into the first step.
      expect(item.w).toMatch(/^[a-z][a-z-]*$/);
    }
  });

  it('marks whether the lexicon can open each observed word', () => {
    const inspect = model.observe.find((o) => o.w === 'inspect');
    if (inspect) expect(inspect.known).toBe(true);
    for (const item of model.observe) {
      expect(item.known).toBe(known(item.w));
    }
  });

  it('has at least one counterexample, and every trap carries an explanation', () => {
    expect(model.traps.length).toBeGreaterThanOrEqual(1);
    for (const trap of model.traps) {
      expect(trap.note.length).toBeGreaterThan(10);
    }
  });

  it('builds a verify step with both members and non-members', () => {
    const positives = model.verify.filter((v) => v.inFamily);
    const negatives = model.verify.filter((v) => !v.inFamily);
    expect(positives.length).toBeGreaterThanOrEqual(2);
    expect(negatives.length).toBeGreaterThanOrEqual(1);
    for (const item of model.verify) expect(item.explain.length).toBeGreaterThan(5);
  });

  it('accepts more than one legitimate word sum where the dossier supports it', () => {
    expect(model.sums.length).toBeGreaterThanOrEqual(1);
    for (const sum of model.sums) {
      expect(sum.accepted.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('layered exploration', () => {
  const first = buildInquiry(dossier, known, { session: 0 });
  const second = buildInquiry(dossier, known, { session: 1 });

  it('classifies members by how much structure they show', () => {
    expect(tierOf({ layer: ['in', 'spect'] })).toBe('basic');
    expect(tierOf({ layer: ['in', 'spect', 'ion'] })).toBe('variation');
    expect(tierOf({ relation: 'cognate', layer: ['spec', 't'] })).toBe('advanced');
    expect(tierLabel('advanced')).toBe('进阶');
  });

  it('offers a different set of words on a second pass', () => {
    const firstWords = first.observe.map((o) => o.w).join(',');
    const secondWords = second.observe.map((o) => o.w).join(',');
    expect(firstWords).not.toBe(secondWords);
  });

  it('prefers words the learner has not met yet', () => {
    const met = first.observe.map((o) => o.w);
    const third = buildInquiry(dossier, known, { session: 0, explored: met });
    const overlap = third.observe.filter((o) => met.includes(o.w));
    expect(overlap.length).toBeLessThanOrEqual(1);
  });

  it('does not verify with a word it just showed', () => {
    for (const model of [first, second]) {
      const shown = new Set(model.observe.map((o) => o.w));
      const reused = model.verify.filter((v) => v.inFamily && shown.has(v.w));
      expect(reused).toEqual([]);
    }
  });

  it('never presents a cognate as a modern derivation', () => {
    for (const item of first.verify.filter((v) => v.inFamily)) {
      if (item.explain.includes('派生')) {
        expect(item.explain).not.toMatch(/同源.*派生(?!——)/);
      }
    }
  });

  it('reports how many words the learner has already seen', () => {
    expect(first.seen).toBe(0);
    const withHistory = buildInquiry(dossier, known, { explored: first.observe.map((o) => o.w) });
    expect(withHistory.seen).toBeGreaterThan(0);
  });
});

describe('checkSum', () => {
  it('accepts the dossier split and its connecting-vowel variant', () => {
    expect(checkSum('in + spect + ion', [['in', 'spect', 'ion']]).ok).toBe(true);
    expect(checkSum('in+spect+ion', [['in', 'spect', 'ion']]).ok).toBe(true);
  });

  it('rejects a wrong number of parts', () => {
    expect(checkSum('in + spect', [['in', 'spect', 'ion']]).ok).toBe(false);
  });

  it('no longer treats any doubled letter as free variation', () => {
    // The old normaliser collapsed every doubled letter, so a dropped letter at
    // the seam looked like a valid variant. That let "im + pres + ion" pass.
    const dropped = checkSum('im + pres + ion', [['im', 'press', 'ion']]);
    expect(dropped.ok).toBe(false);
    expect(dropped.structure).toBe('correct');
    expect(dropped.spelling).toBe('misspelled');
    expect(dropped.note).toContain('press');
  });

  it('accepts an assimilation only through the named prefix rule', () => {
    // ad + ferent → afferent is licensed (ad- assimilates before f-); the extra
    // d in "add + ferent" is not, because the suffix does not begin with a vowel
    // and ad- is a prefix, not a stem that doubles.
    expect(checkSum('ad + ferent', [['af', 'ferent']]).ok).toBe(true);
    expect(checkSum('add + ferent', [['ad', 'ferent']]).ok).toBe(false);
  });

  it('splits on the arrows learners actually type', () => {
    expect(splitSum('in → spect → ion')).toEqual(['in', 'spect', 'ion']);
  });
});

describe('compareHypothesis', () => {
  it('never grades a hypothesis as wrong — only as more or less close', () => {
    expect(compareHypothesis('看', '看')).toBe('close');
    expect(compareHypothesis('看东西', '看')).toBe('close');
    expect(compareHypothesis('看法', '看')).toBe('close');
    expect(compareHypothesis('看着某物', '看')).toBe('close');
    expect(compareHypothesis('完全无关的说法', '看')).toBe('distant');
  });

  it('treats an empty hypothesis as distant, not as an error', () => {
    expect(compareHypothesis('   ', '看')).toBe('distant');
  });
});

describe('progress', () => {
  function memStore() {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  }

  it('round-trips progress per family', () => {
    const store = memStore();
    saveProgress('fam-spect', { step: 2, done: ['observe', 'discover'], hypothesis: '看' }, store);
    const loaded = loadProgress('fam-spect', store);
    expect(loaded?.step).toBe(2);
    expect(loaded?.hypothesis).toBe('看');
  });

  it('returns null for an unknown family or corrupt storage', () => {
    const store = memStore();
    expect(loadProgress('fam-nope', store)).toBeNull();
    store.setItem('wordroots.family.inquiry.v1', 'not json');
    expect(loadProgress('fam-spect', store)).toBeNull();
  });

  it('keeps two families independent', () => {
    const store = memStore();
    saveProgress('fam-spect', { step: 1, done: [], hypothesis: '' }, store);
    saveProgress('fam-struct', { step: 4, done: [], hypothesis: '' }, store);
    expect(loadProgress('fam-spect', store)?.step).toBe(1);
    expect(loadProgress('fam-struct', store)?.step).toBe(4);
  });
});
