import { describe, expect, it } from 'vitest';
import { allWords } from './content';
import {
  analyze,
  deriveFrom,
  familyIdOf,
  familyMembers,
  judgeAdd,
  resolveFamilyId,
  type WordContext,
} from './derive';

const LEXICON = new Set(allWords().map((w) => w.w));

/** Hand-built dictionaries keep the rule tests independent of content edits. */
const HELP = new Set(['help', 'helpful', 'helpfully', 'unhelpful', 'unhelpfulness', 'helpfulness']);
const NATION = new Set(['nation', 'national', 'nationalize', 'nationalization']);
const ACT = new Set(['act', 'active', 'activate', 'activation']);
const OCCUR = new Set(['occur', 'occurrence']);

describe('spelling rules', () => {
  it('drops a silent e before a vowel-initial suffix', () => {
    const r = deriveFrom('create', ['-ive'], LEXICON);
    expect(r.word).toBe('creative');
    expect(r.steps.at(-1)?.rule).toBe('drop-e');
  });

  it('keeps e after soft c and g', () => {
    expect(deriveFrom('notice', ['-able'], LEXICON).steps.at(-1)?.rule).toBe('keep-e-soft');
    expect(deriveFrom('notice', ['-able'], LEXICON).word).toBe('noticeable');
    expect(deriveFrom('courage', ['-ous'], LEXICON).word).toBe('courageous');
  });

  it('turns final y into i but not before an i-initial suffix', () => {
    const happy = deriveFrom('happy', ['-ness'], LEXICON);
    expect(happy.word).toBe('happiness');
    expect(happy.steps.at(-1)?.rule).toBe('y-to-i');
    expect(deriveFrom('carry', ['-ed'], LEXICON).word).toBe('carried');
    expect(deriveFrom('carry', ['-ing'], LEXICON).word).toBe('carrying');
  });

  it('doubles a stressed final CVC when the dictionary confirms it', () => {
    const r = deriveFrom('occur', ['-ence'], OCCUR);
    expect(r.word).toBe('occurrence');
    expect(r.steps.at(-1)?.rule).toBe('double');
  });

  it('falls back to the undoubled reading for longer, unstressed stems', () => {
    expect(deriveFrom('visit', ['-or'], LEXICON).word).toBe('visitor');
    expect(deriveFrom('run', ['-er'], LEXICON).word).toBe('runner');
    expect(deriveFrom('snow', ['-ing'], LEXICON).word).toBe('snowing');
  });

  it('assimilates a prefix to the base’s first letter', () => {
    const illegal = deriveFrom('legal', ['in-'], LEXICON);
    expect(illegal.word).toBe('illegal');
    expect(illegal.steps[0].rule).toBe('assimilate');
    expect(deriveFrom('possible', ['in-'], LEXICON).word).toBe('impossible');
    expect(deriveFrom('rect', ['con-'], LEXICON).word).toBe('correct');
    expect(deriveFrom('cept', ['ad-'], LEXICON).word).toBe('accept');
  });

  it('merges -t / -s / -ce / -te with -ion into -tion / -sion', () => {
    expect(deriveFrom('produce', ['-tion'], LEXICON).word).toBe('production');
    expect(deriveFrom('connect', ['-ion'], LEXICON).word).toBe('connection');
    expect(deriveFrom('express', ['-ion'], LEXICON).word).toBe('expression');
    expect(deriveFrom('create', ['-ion'], LEXICON).word).toBe('creation');
  });

  it('records a plain join when nothing changes', () => {
    const r = deriveFrom('help', ['-ful'], HELP);
    expect(r.word).toBe('helpful');
    expect(r.steps.at(-1)?.rule).toBe('none');
  });
});

describe('multi-layer derivation', () => {
  it('chains three morphemes and records the intermediate forms', () => {
    const r = deriveFrom('help', ['-ful', '-ness'], HELP);
    expect(r.steps.map((s) => s.to)).toEqual(['helpful', 'helpfulness']);
    expect(r.word).toBe('helpfulness');
    expect(r.valid).toBe(true);
  });

  it('builds unhelpfulness even when the prefix is listed last', () => {
    const r = deriveFrom('help', ['-ful', '-ness', 'un-'], HELP);
    expect(r.steps.map((s) => s.add)).toEqual(['un-', '-ful', '-ness']);
    expect(r.word).toBe('unhelpfulness');
    expect(r.valid).toBe(true);
    expect(r.familyId).toBe('rx-help');
  });

  it('builds nationalization through four layers', () => {
    const r = deriveFrom('nation', ['-al', '-ize', '-ation'], NATION);
    expect(r.steps.map((s) => s.to)).toEqual(['national', 'nationalize', 'nationalization']);
    expect(r.valid).toBe(true);
  });

  it('builds activation through four layers', () => {
    const r = deriveFrom('act', ['-ive', '-ate', '-ion'], ACT);
    expect(r.steps.map((s) => s.to)).toEqual(['active', 'activate', 'activation']);
    expect(r.valid).toBe(true);
  });

  it('reports valid:false for a form the dictionary does not list', () => {
    const r = deriveFrom('help', ['-ful', '-zzz'], HELP);
    expect(r.word).toBe('helpfulzzz');
    expect(r.valid).toBe(false);
  });

  it('keeps every step reversible: each step starts where the last one ended', () => {
    const r = deriveFrom('nation', ['-al', '-ize', '-ation'], NATION);
    for (let i = 1; i < r.steps.length; i += 1) {
      expect(r.steps[i].from).toBe(r.steps[i - 1].to);
    }
  });

  it('resolves a family id from a base spelling', () => {
    expect(familyIdOf('help')).toBe('rx-help');
    expect(resolveFamilyId('help')).toBe('rx-help');
    expect(resolveFamilyId('rx-help')).toBe('rx-help');
  });
});

describe('analyze', () => {
  it('uses the verified analysis of a listed word', () => {
    const a = analyze('happiness');
    expect(a.known).toBe(true);
    expect(a.parts).toEqual(['happy', 'ness']);
    expect(a.steps.at(-1)?.rule).toBe('y-to-i');
    expect(a.note).toBeUndefined();
  });

  it('reconstructs a four-part chain with three steps', () => {
    const a = analyze('unhelpfulness');
    expect(a.parts).toEqual(['un', 'help', 'ful', 'ness']);
    expect(a.steps.map((s) => s.to)).toEqual(['unhelp', 'unhelpful', 'unhelpfulness']);
    expect(a.known).toBe(true);
  });

  it('flags an unlisted spelling as a guess instead of throwing', () => {
    const a = analyze('zzzzq');
    expect(a.known).toBe(false);
    expect(a.note).toContain('未收录');
    expect(a.parts.length).toBeGreaterThan(0);
  });

  it('segments an unlisted but analysable word and marks it unknown', () => {
    const a = analyze('recalibrations');
    expect(a.known).toBe(false);
    expect(a.parts).toContain('re');
    expect(a.parts).toContain('calibr');
    expect(a.note).toContain('未收录');
  });

  it('restores a y→i stem when segmenting an unlisted word', () => {
    const a = analyze('unhappily');
    expect(a.known).toBe(false);
    expect(a.parts).toEqual(['un', 'happy', 'ly']);
    expect(a.steps.at(-1)?.to).toBe('unhappily');
    expect(a.steps.at(-1)?.rule).toBe('y-to-i');
  });

  it('is empty-safe', () => {
    expect(analyze('   ').parts).toEqual([]);
  });
});

describe('three-state judgement', () => {
  const help: WordContext = { word: 'help', parts: ['help'], pos: null };
  const happiness: WordContext = { word: 'happiness', parts: ['happy', 'ness'], pos: 'n' };
  const helpful: WordContext = { word: 'helpful', parts: ['help', 'ful'], pos: 'adj' };
  const helps: WordContext = { word: 'helps', parts: ['help', 's'], pos: 'v' };

  it('marks a listed combination as verified', () => {
    const v = judgeAdd(help, 'ful', LEXICON);
    expect(v.state).toBe('verified');
    expect(v.word).toBe('helpful');
  });

  it('marks a spellable but unlisted combination as unknown, not nonexistent', () => {
    const v = judgeAdd(help, 'ness', LEXICON);
    expect(v.state).toBe('unknown');
    expect(v.word).toBe('helpness');
    expect(v.reason).toContain('未收录');
  });

  it('blocks a repeated suffix', () => {
    const v = judgeAdd(happiness, 'ness', LEXICON);
    expect(v.state).toBe('rule-blocked');
    expect(v.rule).toBe('dup-affix');
  });

  it('blocks a suffix whose required word class does not match', () => {
    const v = judgeAdd(happiness, 'able', LEXICON);
    expect(v.state).toBe('rule-blocked');
    expect(v.rule).toBe('pos-mismatch');
  });

  it('blocks derivation after an inflectional suffix', () => {
    const v = judgeAdd(helps, 'ness', LEXICON);
    expect(v.state).toBe('rule-blocked');
    expect(v.rule).toBe('inflection-order');
  });

  it('blocks an i-initial suffix after the y→i change', () => {
    const v = judgeAdd(happiness, 'ing', LEXICON);
    expect(v.state).toBe('rule-blocked');
    expect(v.rule).toBe('i-conflict');
  });

  it('verifies assimilation in a prefix cell', () => {
    const v = judgeAdd({ word: 'legal', parts: ['legal'], pos: null }, 'in-', LEXICON);
    expect(v.state).toBe('verified');
    expect(v.word).toBe('illegal');
  });

  it('keeps verified words winning over the word-class heuristic', () => {
    const v = judgeAdd(helpful, 'ness', LEXICON);
    expect(v.state).toBe('verified');
    expect(v.word).toBe('helpfulness');
  });
});

describe('familyMembers', () => {
  it('lists words on one morpheme with their depth', () => {
    const members = familyMembers('rx-help');
    const words = members.map((m) => m.word);
    expect(words).toContain('helpful');
    expect(words).toContain('unhelpfulness');
    expect(members.find((m) => m.word === 'unhelpfulness')?.depth).toBe(3);
  });

  it('accepts a form as well as an id', () => {
    expect(familyMembers('help')).toEqual(familyMembers('rx-help'));
  });

  it('returns nothing for an unknown family', () => {
    expect(familyMembers('not-a-morpheme')).toEqual([]);
  });

  it('sorts by depth', () => {
    const depths = familyMembers('rx-help').map((m) => m.depth);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
  });
});
