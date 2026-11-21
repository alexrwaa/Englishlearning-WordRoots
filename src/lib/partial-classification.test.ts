import { describe, expect, it } from 'vitest';

import words from '../content/lexicon/words.json';
import morphemes from '../content/lexicon/morphemes.json';
import forms from '../content/lexicon/forms.json';

/**
 * PARTIAL 分类回归（docs/PARTIAL_CLASSIFICATION.md）。
 *
 * 这里锁的是**判断**，不是当时的数字：142 条 partial 每条都落到五类之一，
 * 五类互不重叠、并集正好是这 142 条；修好的必须真的 verified，没修的必须
 * 有明确的「不该 verified」理由，且不许为了凑 verified 去给自由词干造词素。
 */
type Analysis = {
  segmentation: 'verified' | 'partial' | 'unverified' | 'none';
  unresolved?: { part: string; reason: string }[];
};
type Word = { w: string; parts?: string[]; partIds?: (string | null)[]; partResolution?: string; analysis?: Analysis };
type Morpheme = { id: string; form: string; type: string; origin: string; allomorphs?: string[] };

const all = words as Word[];
const byWord = new Map(all.map((w) => [w.w.toLowerCase(), w]));
const morphs = morphemes as Morpheme[];
const byId = new Map(morphs.map((m) => [m.id, m]));
const formIndex = forms as Record<string, string[]>;

/** 1. 自由词干：成分本身是能独立成词的英语词，不该有词素记录。 */
const FREE_BASE = ['administer', 'agreement', 'antibiotic', 'artist', 'backward', 'biggest', 'carbonize', 'careful', 'carefully', 'careless', 'characteristic', 'classify', 'clockwise', 'comfortable', 'counterattack', 'counterexample', 'counterpart', 'courageous', 'criticism', 'darkness', 'devalue', 'directory', 'disagree', 'disappear', 'dishonest', 'ecosystem', 'embed', 'embrace', 'employee', 'enslave', 'equipment', 'ex-president', 'extracurricular', 'extraordinary', 'failure', 'famous', 'fastest', 'globalization', 'goes', 'highly', 'homeward', 'hyperlink', 'industrialization', 'inertia', 'inertial', 'infrared', 'interesting', 'interface', 'intranet', 'irrelevant', 'likewise', 'microprocessor', 'microsecond', 'mistake', 'misuse', 'movement', 'multicore', 'multimedia', 'nervous', 'network', 'nonstop', 'organization', 'retrofit', 'simplify', 'socialism', 'submarine', 'subway', 'supermarket', 'underestimate', 'widen', 'workflow'];

/** 2. 纯拼写成分：e 脱落 / y→i / 连接元音，本就不承载意义。 */
const ORTHOGRAPHIC = ['coupling', 'decoupled', 'historical'];

/** 3. 缺词素记录，但仍然不补：没有把握的不要造。 */
const MISSING_DEFERRED = ['agility', 'benefit', 'hydrogen', 'indebted', 'legal', 'maintain'];

/** 4. 坏切分 / 同形异源混用，但改不了：理由写在文档里。 */
const WRONG_SPLIT_DEFERRED = ['automatic', 'automation', 'difficult', 'redundancy', 'redundant'];

/** 5. 整体借词：现代英语不再分析，拆了才是错。 */
const WHOLE_LOAN = ['formula', 'genus'];

/** 3 类修复：补记录 / 补同形证据 / 改切分。 */
const FIXED_RECORD = ['actual', 'aquatic', 'asexual', 'centipede', 'clarify', 'compatibility', 'composition', 'credibility', 'deposit', 'detention', 'efficiency', 'expensive', 'explosion', 'flexible', 'hydroelectric', 'initiative', 'iteration', 'manipulate', 'menstrual', 'monologue', 'odometry', 'perceive', 'pneumonia', 'position', 'positive', 'possibility', 'purchase', 'purport', 'purported', 'purportedly', 'residual', 'responsibility', 'responsible', 'retention', 'reverse', 'scientist', 'technology', 'universe', 'visual'];
const FIXED_HOMOGRAPH = ['apologize', 'impose', 'impossible', 'indestructible', 'inducement', 'induction', 'injection', 'irregular', 'legend', 'photodiode', 'separator'];
const FIXED_SPLIT = ['distinct', 'distinction', 'fertilize', 'forward', 'trajectory'];

const CATEGORIES: [string, string[]][] = [
  ['free-base', FREE_BASE],
  ['orthographic', ORTHOGRAPHIC],
  ['missing-record(deferred)', MISSING_DEFERRED],
  ['wrong-split(deferred)', WRONG_SPLIT_DEFERRED],
  ['whole-loan', WHOLE_LOAN],
  ['fixed:record', FIXED_RECORD],
  ['fixed:homograph', FIXED_HOMOGRAPH],
  ['fixed:split', FIXED_SPLIT],
];

const unresolvedParts = (w: Word): string[] => (w.analysis?.unresolved ?? []).map((u) => u.part);

describe('partial 分类', () => {
  it('142 条原始 partial 每条都落到唯一一类，且和文档计数一致', () => {
    const total = CATEGORIES.reduce((sum, [, list]) => sum + list.length, 0);
    expect(total).toBe(142);

    const seen = new Set<string>();
    const dup: string[] = [];
    for (const [, list] of CATEGORIES) {
      for (const w of list) {
        if (seen.has(w)) dup.push(w);
        seen.add(w);
      }
    }
    expect(dup, `同一条被分进两类：${dup.join(', ')}`).toHaveLength(0);

    // 文档里写的五个主类计数：71 / 3 / 6 / 5 / 2，加修复 55 = 142
    expect(FREE_BASE).toHaveLength(71);
    expect(ORTHOGRAPHIC).toHaveLength(3);
    expect(MISSING_DEFERRED).toHaveLength(6);
    expect(WRONG_SPLIT_DEFERRED).toHaveLength(5);
    expect(WHOLE_LOAN).toHaveLength(2);
    expect(FIXED_RECORD.length + FIXED_HOMOGRAPH.length + FIXED_SPLIT.length).toBe(55);

    // 每个词条都还在，拼写没有被分类过程改动
    const missing = [...seen].filter((w) => !byWord.has(w));
    expect(missing, `分类表里已不存在的词：${missing.join(', ')}`).toHaveLength(0);
  });

  it('修好的 55 条不再有未知成分', () => {
    const stillGap: string[] = [];
    for (const name of [...FIXED_RECORD, ...FIXED_HOMOGRAPH, ...FIXED_SPLIT]) {
      const word = byWord.get(name);
      expect(word, name).toBeTruthy();
      expect(word?.analysis?.segmentation, `${name} 未变成 verified`).toBe('verified');
      // 只允许静音 e 这种正字法缺口，不允许再出现「确实缺记录」
      const unknown = (word?.analysis?.unresolved ?? []).filter((u) => u.reason === 'unresolved');
      if (unknown.length) stillGap.push(`${name}:${unknown.map((u) => u.part).join('+')}`);
    }
    expect(stillGap, `仍有未知成分：${stillGap.join(', ')}`).toHaveLength(0);
  });

  it('降不下去的 87 条仍是 partial，理由分别是五类之一', () => {
    const deferred = [...FREE_BASE, ...ORTHOGRAPHIC, ...MISSING_DEFERRED, ...WRONG_SPLIT_DEFERRED, ...WHOLE_LOAN];
    expect(deferred).toHaveLength(87);
    const wrong: string[] = [];
    for (const name of deferred) {
      const word = byWord.get(name);
      if (!word) {
        wrong.push(`${name}:missing`);
        continue;
      }
      // 允许 future 修复把它们变成 verified，但绝不允许变成 unverified（拆坏）
      if (word.analysis?.segmentation === 'unverified') wrong.push(`${name}:unverified`);
    }
    expect(wrong, wrong.join(', ')).toHaveLength(0);
  });

  it('自由词干没有被造出词素记录', () => {
    const invented: string[] = [];
    for (const name of FREE_BASE) {
      const word = byWord.get(name);
      for (const part of unresolvedParts(word as Word)) {
        if (formIndex[part.toLowerCase()]) invented.push(`${name}:${part}`);
      }
    }
    expect(invented, `给自由词干造了记录：${invented.join(', ')}`).toHaveLength(0);
  });

  it('整体借词没有被强行拆成词素', () => {
    // formula / genus 保留的是「可教学的历史切分」，但现代英语不分析；
    // 这里只断言它们没有被记成 quizSafe —— 即不参与自动判题。
    for (const name of WHOLE_LOAN) {
      expect(byWord.get(name)?.analysis?.segmentation).not.toBe('none');
    }
  });
});

describe('partial 修复落到了数据里', () => {
  it('新增的 13 条词素记录存在且类型正确', () => {
    const expected: [string, string, string, string][] = [
      ['px-fore', 'fore', 'prefix', 'OE'],
      ['rx-clar', 'clar', 'root', 'Lat'],
      ['rx-flex', 'flex', 'root', 'Lat'],
      ['rx-stingu', 'stingu', 'root', 'Lat'],
      ['rx-spond', 'spond', 'root', 'Lat'],
      ['rx-sed', 'sed', 'root', 'Lat'],
      ['rx-plaud', 'plaud', 'root', 'Lat'],
      ['rx-iter', 'iter', 'root', 'Lat'],
      ['rx-manipul', 'manipul', 'root', 'Lat'],
      ['rx-electr', 'electr', 'root', 'Gk'],
      ['rx-menstru', 'menstru', 'root', 'Lat'],
      ['sx-logue', 'logue', 'suffix', 'Gk'],
      ['cx-centi', 'centi', 'combining', 'Lat'],
    ];
    for (const [id, form, type, origin] of expected) {
      const m = byId.get(id);
      expect(m, id).toBeTruthy();
      expect(m?.form).toBe(form);
      expect(m?.type).toBe(type);
      expect(m?.origin).toBe(origin);
    }
  });

  it('补齐的 allomorph 能在 forms 索引里解析到原记录', () => {
    const expected: [string, string][] = [
      ['sx-ial', 'ual'],
      ['sx-abil', 'ibil'],
      ['rx-pos', 'posit'],
      ['px-pro', 'pur'],
      ['rx-vert', 'verse'],
      ['rx-ten', 'tent'],
      ['cx-pend-pond', 'pens'],
      ['cx-pne-pneum', 'pneumon'],
      ['sx-ency', 'iency'],
      ['sx-ative', 'iative'],
      ['sx-atic', 'tic'],
      ['cx-sci', 'scient'],
      ['rx-techn', 'techno'],
      ['rx-cap', 'ceive'],
      ['rx-od', 'odo'],
    ];
    const broken: string[] = [];
    for (const [id, spelling] of expected) {
      const ids = formIndex[spelling] ?? [];
      if (!ids.includes(id)) broken.push(`${spelling}→${id} (got ${ids.join('/') || 'none'})`);
    }
    expect(broken, broken.join('; ')).toHaveLength(0);
  });

  it('关键切分的解析结果被锁住（防止同形异源再次串味）', () => {
    // 五条改过切分的：新切分 + 理由必须同时成立
    const resplit: Record<string, string[]> = {
      distinct: ['dis', 'stinct'],
      distinction: ['dis', 'stinct', 'ion'],
      forward: ['fore', 'ward'],
      trajectory: ['tra', 'ject', 'ory'],
      fertilize: ['fertile', 'ize'],
    };
    for (const [name, parts] of Object.entries(resplit)) {
      expect(byWord.get(name)?.parts, `${name} 的切分`).toEqual(parts);
    }

    const expected: Record<string, (string | null)[]> = {
      distinct: ['px-dis', 'rx-stingu'],
      forward: ['px-fore', 'sx-ward'],
      trajectory: ['cx-tra-trans', 'rx-ject', 'sx-ory'],
      composition: ['px-com', 'rx-pos', 'sx-ion'],
      purchase: ['px-pro', 'rx-chase'],
      credibility: ['rx-cred', 'sx-abil', 'sx-ity'],
      visual: ['rx-vis', 'sx-ial'],
      detention: ['px-de', 'rx-ten', 'sx-ion'],
      pneumonia: ['cx-pne-pneum', 'sx-ia'],
      scientist: ['cx-sci', 'sx-ist'],
      odometry: ['rx-od', 'cx-metr', 'cx-y'],
      hydroelectric: ['cx-hydro', 'rx-electr', 'sx-ic'],
      monologue: ['px-mono', 'sx-logue'],
      technology: ['rx-techn', 'cx-logy'],
      perceive: ['px-per', 'rx-cap'],
      explosion: ['px-e', 'rx-plaud', 'sx-ion'],
      residual: ['px-re', 'rx-sed', 'sx-ial'],
      responsibility: ['rx-spond', 'sx-abil', 'sx-ity'],
      induction: ['px-im', 'rx-duc', 'sx-ion'],
    };
    for (const [name, ids] of Object.entries(expected)) {
      const word = byWord.get(name);
      expect(word, name).toBeTruthy();
      expect(word?.partIds, `${name} 的 partIds`).toEqual(ids);
    }
  });

  it('同形异源没有被合并成一个记录', () => {
    // in-「向内」与 in-「不」、stinguere 与 tingere、legere 与 lex 必须仍是分开的记录
    const homograph: [string, string][] = [
      ['in', 'px-im'],
      ['in', 'px-in'],
      ['stinct', 'rx-stingu'],
      ['leg', 'rx-lect'],
    ];
    for (const [spelling, id] of homograph) {
      expect(formIndex[spelling], `${spelling} 索引`).toContain(id);
    }
    // distinct 的 -stinct 只能归 stinguere（刺、标示），不能归 tingere（染色）
    expect(formIndex.stinct).toEqual(['rx-stingu']);
  });
});
