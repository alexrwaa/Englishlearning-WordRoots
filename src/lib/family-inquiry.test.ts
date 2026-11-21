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

import { buildInquiry, checkSum, compareHypothesis, loadProgress, saveProgress, splitSum } from './family-inquiry';
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

describe('checkSum', () => {
  it('accepts the dossier split and its connecting-vowel variant', () => {
    expect(checkSum('in + spect + ion', [['in', 'spect', 'ion']]).ok).toBe(true);
    expect(checkSum('in+spect+ion', [['in', 'spect', 'ion']]).ok).toBe(true);
  });

  it('rejects a wrong number of parts', () => {
    expect(checkSum('in + spect', [['in', 'spect', 'ion']]).ok).toBe(false);
  });

  it('tolerates a doubled consonant at the join (orthography, not analysis)', () => {
    // A learner who writes "add + ferent" has the right analysis and the wrong
    // spelling at the seam; that should not be marked as a structural error.
    expect(checkSum('add + ferent', [['ad', 'ferent']]).ok).toBe(true);
    expect(checkSum('ad + ferent', [['add', 'ferent']]).ok).toBe(true);
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
