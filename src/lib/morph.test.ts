import { describe, expect, it } from 'vitest';
import { applySuffix, buildWord, editDistance, explainSum, parseWordSum } from './morph';

describe('orthographic joining rules', () => {
  it('drops a silent e before a vowel-initial suffix', () => {
    expect(applySuffix('create', 'ive').text).toBe('creative');
    expect(applySuffix('hope', 'ing').text).toBe('hoping');
  });

  it('keeps e after soft c and g', () => {
    expect(applySuffix('notice', 'able').text).toBe('noticeable');
    expect(applySuffix('courage', 'ous').text).toBe('courageous');
  });

  it('turns final y into i', () => {
    expect(applySuffix('happy', 'ness').text).toBe('happiness');
    expect(applySuffix('carry', 'ed').text).toBe('carried');
  });

  it('keeps y before a suffix starting with i', () => {
    expect(applySuffix('carry', 'ing').text).toBe('carrying');
  });

  it('doubles a final consonant for short CVC bases', () => {
    expect(applySuffix('run', 'er').text).toBe('runner');
    expect(applySuffix('big', 'est').text).toBe('biggest');
  });

  it('does not double w, x or y', () => {
    expect(applySuffix('snow', 'ing').text).toBe('snowing');
    expect(applySuffix('play', 'er').text).toBe('player');
  });

  it('records the rule it applied', () => {
    const r = applySuffix('happy', 'ness');
    expect(r.steps.some((s) => /y becomes i/.test(s.rule))).toBe(true);
  });
});

describe('buildWord', () => {
  it('joins a prefix and suffix around a base', () => {
    const r = buildWord('un', 'help', 'ful');
    expect(r.word).toBe('unhelpful');
    // The lexicon confirms the form, so the matrix may present it as a real word.
    expect(r.attested).toBe(true);
    expect(r.entry?.parts).toEqual(['un', 'help', 'ful']);
  });

  it('never claims a word exists without lexicon evidence', () => {
    expect(buildWord('', 'zzz', 'qqq').attested).toBe(false);
    expect(buildWord('un', 'struct', 'ion').attested).toBe(false);
  });
});

describe('word sums', () => {
  it('parses flexible separators', () => {
    expect(parseWordSum('un + help + ful')).toEqual(['un', 'help', 'ful']);
    expect(parseWordSum('un+help+ful')).toEqual(['un', 'help', 'ful']);
  });

  it('explains a sum whose surface form needs a rule', () => {
    const steps = explainSum(['happy', 'ness'], 'happiness');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('measures near misses', () => {
    expect(editDistance('happiness', 'hapiness')).toBe(1);
  });
});
