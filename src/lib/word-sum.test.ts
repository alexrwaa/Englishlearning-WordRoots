/**
 * Word Sum grading rules (0.12.0).
 *
 * The regression this file exists for: the old grader collapsed any run of
 * doubled letters, so `press` and `pres` compared equal and a dropped letter at
 * the seam was graded correct. Every negative case below is a letter that a
 * learner might plausibly drop; every positive case is a change that English
 * orthography really does license, with a name attached.
 */
import { describe, expect, it } from 'vitest';

import { checkSum, RULE_DOCS, splitSum } from './word-sum';

describe('regression: a dropped letter is never free variation', () => {
  const cases: { input: string; accepted: string[][]; reference: string }[] = [
    { input: 'im + pres + ion', accepted: [['im', 'press', 'ion']], reference: 'press' },
    { input: 'mis + ion', accepted: [['miss', 'ion']], reference: 'miss' },
    { input: 'ad + ition', accepted: [['add', 'ition']], reference: 'add' },
    { input: 'oc + asion', accepted: [['occ', 'asion']], reference: 'occ' },
    { input: 'cur + ent', accepted: [['curr', 'ent']], reference: 'curr' },
  ];

  for (const { input, accepted, reference } of cases) {
    it(`rejects ${input} against ${accepted[0].join(' + ')}`, () => {
      const verdict = checkSum(input, accepted);
      expect(verdict.ok).toBe(false);
      // The analysis is the same; only the spelling is wrong. That distinction
      // is the whole point of splitting the verdict into layers.
      expect(verdict.structure).toBe('correct');
      expect(verdict.spelling).toBe('misspelled');
      expect(verdict.ruleIds).toEqual([]);
      expect(verdict.note).toContain(reference);
    });
  }

  it('keeps the learner’s letters in `normalized` when nothing is licensed', () => {
    expect(checkSum('im + pres + ion', [['im', 'press', 'ion']]).normalized).toEqual([
      'im',
      'pres',
      'ion',
    ]);
  });
});

describe('e-drop', () => {
  it('accepts creat + ion for create + ion', () => {
    const verdict = checkSum('creat + ion', [['create', 'ion']]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ruleIds).toEqual(['e-drop']);
    expect(verdict.spelling).toBe('licensed-variant');
    expect(verdict.normalized).toEqual(['create', 'ion']);
  });

  it('accepts the reverse direction: create + ion for creat + ion', () => {
    expect(checkSum('create + ion', [['creat', 'ion']]).ok).toBe(true);
  });

  it('does not drop the e before a consonant-initial suffix', () => {
    expect(checkSum('car + ful', [['care', 'ful']]).ok).toBe(false);
    expect(checkSum('car + ful', [['care', 'ful']]).spelling).toBe('misspelled');
  });
});

describe('y-to-i', () => {
  it('accepts happi + ness for happy + ness', () => {
    const verdict = checkSum('happi + ness', [['happy', 'ness']]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ruleIds).toEqual(['y-to-i']);
  });

  it('accepts the reverse direction: happy + ness for happi + ness', () => {
    expect(checkSum('happy + ness', [['happi', 'ness']]).ok).toBe(true);
  });

  it('keeps the y after a vowel and before -ing', () => {
    expect(checkSum('plai + ing', [['play', 'ing']]).ok).toBe(false);
  });
});

describe('consonant-doubling', () => {
  it('accepts admitt + ed for admit + ed', () => {
    const verdict = checkSum('admitt + ed', [['admit', 'ed']]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ruleIds).toEqual(['consonant-doubling']);
  });

  it('accepts the doubling at an internal seam: ad + mitt + ed', () => {
    const verdict = checkSum('ad + mitt + ed', [['ad', 'mit', 'ed']]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ruleIds).toEqual(['consonant-doubling']);
  });

  it('accepts a monosyllable: stopp + ed', () => {
    expect(checkSum('stopp + ed', [['stop', 'ed']]).ok).toBe(true);
  });

  it('does not double an unstressed final syllable: visitt + ed', () => {
    const verdict = checkSum('visitt + ed', [['visit', 'ed']]);
    expect(verdict.ok).toBe(false);
    expect(verdict.ruleIds).not.toContain('consonant-doubling');
  });

  it('never removes one of a genuine double: pres for press', () => {
    expect(checkSum('pres + ure', [['press', 'ure']]).ok).toBe(false);
  });
});

describe('assimilation (whitelist only)', () => {
  it('accepts ad + ferent for afferent', () => {
    const verdict = checkSum('ad + ferent', [['af', 'ferent']]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ruleIds).toEqual(['assimilation']);
  });

  it('accepts both surface spellings of the prefix', () => {
    expect(checkSum('af + ferent', [['ad', 'ferent']]).ok).toBe(true);
    expect(checkSum('aff + ferent', [['ad', 'ferent']]).ok).toBe(true);
    expect(checkSum('ad + ferent', [['ad', 'ferent']]).ok).toBe(true);
  });

  it('accepts in + possible as im + possible', () => {
    expect(checkSum('im + possible', [['in', 'possible']]).ok).toBe(true);
  });

  it('covers the in- forms il- and ir-', () => {
    expect(checkSum('il + legal', [['in', 'legal']]).ok).toBe(true);
    expect(checkSum('ir + regular', [['in', 'regular']]).ok).toBe(true);
  });

  it('accepts con + lateral as col + lateral', () => {
    expect(checkSum('col + lateral', [['con', 'lateral']]).ok).toBe(true);
  });

  it('rejects a form outside the whitelist: ab + ferent', () => {
    expect(checkSum('ab + ferent', [['af', 'ferent']]).ok).toBe(false);
  });

  it('rejects a changed root: ad + fervent', () => {
    const verdict = checkSum('ad + fervent', [['ad', 'ferent']]);
    expect(verdict.ok).toBe(false);
    expect(verdict.spelling).toBe('misspelled');
  });

  it('rejects aff + fervent: right prefix, wrong root', () => {
    expect(checkSum('aff + fervent', [['af', 'ferent']]).ok).toBe(false);
  });
});

describe('connective-vowel', () => {
  it('accepts the sum without the -o-', () => {
    const verdict = checkSum('spectr + meter', [['spectr', 'o', 'meter']]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ruleIds).toEqual(['connective-vowel']);
  });

  it('accepts the sum with the -o- when the reference omits it', () => {
    expect(checkSum('spectr + o + meter', [['spectr', 'meter']]).ok).toBe(true);
  });

  it('does not let an inserted vowel follow a prefix', () => {
    expect(checkSum('in + o + spect', [['in', 'spect']]).ok).toBe(false);
  });

  it('does not let an inserted vowel follow a vowel-final stem', () => {
    expect(checkSum('happy + o + ness', [['happy', 'ness']]).ok).toBe(false);
  });
});

describe('structure', () => {
  it('marks an empty answer unresolved rather than wrong', () => {
    expect(checkSum('', [['in', 'spect', 'ion']]).structure).toBe('unresolved');
    expect(checkSum('   ', [['in', 'spect', 'ion']]).ok).toBe(false);
  });

  it('marks a wrong part count incorrect', () => {
    expect(checkSum('spect', [['in', 'spect', 'ion']]).structure).toBe('incorrect');
    expect(checkSum('in + spect + ion + s', [['in', 'spect', 'ion']]).structure).toBe('incorrect');
    expect(checkSum('inspection', [['in', 'spect', 'ion']]).structure).toBe('incorrect');
  });

  it('marks a non-letter segment unresolved', () => {
    expect(checkSum('in + sp3ct + ion', [['in', 'spect', 'ion']]).structure).toBe('unresolved');
  });

  it('does not judge when there is no reference analysis', () => {
    const verdict = checkSum('in + spect + ion', []);
    expect(verdict.structure).toBe('unresolved');
    expect(verdict.ok).toBe(false);
  });
});

describe('unresolved instead of guessing', () => {
  it('leaves an unknown morpheme unjudged when a lexicon is supplied', () => {
    const lexicon = new Set(['in', 'spect', 'ion']);
    const verdict = checkSum('in + spek + ion', [['in', 'spect', 'ion']], {
      known: (part) => lexicon.has(part),
    });
    expect(verdict.structure).toBe('unresolved');
    expect(verdict.spelling).toBe('unknown');
    expect(verdict.ok).toBe(false);
    expect(verdict.note).toContain('spek');
  });

  it('leaves a large difference unjudged even without a lexicon', () => {
    const verdict = checkSum('in + look + ion', [['in', 'spect', 'ion']]);
    expect(verdict.structure).toBe('unresolved');
    expect(verdict.ok).toBe(false);
  });
});

describe('several legitimate analyses', () => {
  it('passes when any accepted analysis matches', () => {
    expect(checkSum('spectr + meter', [['spectr', 'meter'], ['spectr', 'o', 'meter']]).ok).toBe(true);
    expect(checkSum('in + spect + ion', [['in', 'spect'], ['in', 'spect', 'ion']]).ok).toBe(true);
  });

  it('prefers a passing analysis over an unresolved one', () => {
    const verdict = checkSum('in + spect + ion', [['in', 'spec'], ['in', 'spect', 'ion']]);
    expect(verdict.ok).toBe(true);
    expect(verdict.structure).toBe('correct');
  });

  it('ignores the hyphen morpheme notation used by dossiers', () => {
    expect(checkSum('in + spect', [['in-', 'spect']]).ok).toBe(true);
  });
});

describe('published rule set', () => {
  it('has five distinct rules, each with a condition, example and counterexample', () => {
    expect(RULE_DOCS).toHaveLength(5);
    expect(new Set(RULE_DOCS.map((doc) => doc.id)).size).toBe(5);
    for (const doc of RULE_DOCS) {
      expect(doc.condition.length).toBeGreaterThan(8);
      expect(doc.example).toContain('→');
      expect(doc.counterexample.length).toBeGreaterThan(4);
    }
  });

  for (const doc of RULE_DOCS) {
    it(`${doc.id}: the example is licensed and the counterexample is not`, () => {
      const accepted = checkSum(doc.accept.input, doc.accept.accepted);
      expect(accepted.ok).toBe(true);
      expect(accepted.ruleIds).toContain(doc.id);

      const rejected = checkSum(doc.reject.input, doc.reject.accepted);
      expect(rejected.ok).toBe(false);
      expect(rejected.ruleIds).not.toContain(doc.id);
    });
  }
});

describe('splitSum', () => {
  it('splits on every arrow learners type', () => {
    expect(splitSum('in → spect → ion')).toEqual(['in', 'spect', 'ion']);
    expect(splitSum('in+spect+ion')).toEqual(['in', 'spect', 'ion']);
    expect(splitSum('in - spect - ion')).toEqual(['in', 'spect', 'ion']);
    expect(splitSum('   ')).toEqual([]);
  });
});
