import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import morphemes from '../content/lexicon/morphemes.json';
import words from '../content/lexicon/words.json';

/**
 * FAMILY_MEMBERS 回归（docs/FAMILY_MEMBERS.md）。
 *
 * 词族档案的 members 是内容声明，不等于词库已收。本套测试锁住这一轮的
 * 判断：40 个未收录成员里，哪些建了词条、哪些明确不建、哪些只能整词
 * 记录；并保证「不建」不是漏做——每一个成员都必须落到三类之一。
 */
type Word = {
  w: string;
  family?: string;
  parts?: string[];
  partIds?: (string | null)[];
  partResolution?: string;
  glossZh?: string;
  ety?: { historical?: string; contested?: unknown[] };
  note?: string;
};
type Morpheme = { id: string; form: string; allomorphs?: string[] };

const all = words as Word[];
const byWord = new Map(all.map((w) => [w.w.toLowerCase(), w]));
const morphs = morphemes as Morpheme[];
const byId = new Map(morphs.map((m) => [m.id, m]));

/** 本轮补录的词条：逐个给出所属族，防止「建了词条但挂错族」。 */
const ADDED: Record<string, string> = {
  deception: 'fam-cap',
  occupy: 'fam-cap',
  caption: 'fam-cap',
  susceptible: 'fam-cap',
  chronicle: 'fam-chron',
  chronological: 'fam-chron',
  chronometer: 'fam-chron',
  anachronism: 'fam-chron',
  asynchronous: 'fam-chron',
  chronograph: 'fam-chron',
  synchronic: 'fam-chron',
  diachronic: 'fam-chron',
  conducive: 'fam-duct',
  telegraph: 'fam-graph',
  paragraph: 'fam-graph',
  autograph: 'fam-graph',
  monograph: 'fam-graph',
  polygraph: 'fam-graph',
  omit: 'fam-mit',
  remit: 'fam-mit',
  message: 'fam-mit',
  phonograph: 'fam-phon',
  euphony: 'fam-phon',
  symphony: 'fam-phon',
  phonics: 'fam-phon',
  phoneme: 'fam-phon',
  proscribe: 'fam-scrib',
  scripture: 'fam-scrib',
  transcript: 'fam-scrib',
  conscript: 'fam-scrib',
  despise: 'fam-spect',
  spectrum: 'fam-spect',
  construe: 'fam-struct',
};

/**
 * 明确不建词条：生僻、术语堆叠，或现代英语已不可分析。
 * 保留在族页的「词库未收」标注里，不为了覆盖率硬造。
 */
const SKIPPED = new Set([
  'grammar', // 希腊 gramma 整体借入，-ar 不是后缀
  'graphology', // 生僻专业术语
  'scribble', // 拉丁指小形式 scribillare，-ble 不是英语后缀
  'auspices', // 只用复数，avis + specere 的复合在英语里不可切分
  'destroy', // 拉丁 destruere 同源，但英语拼写已磨平
  'chronometry', // 生僻抽象术语（-metry 已由 chronometer 覆盖）
  'chronobiology', // 20 世纪专业复合词，教学价值低
]);

const familyMembers = new Set(
  readdirSync(join(process.cwd(), 'src', 'content', 'families'))
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const family = JSON.parse(
        readFileSync(join(process.cwd(), 'src', 'content', 'families', file), 'utf-8'),
      ) as { members?: { w: string }[] };
      return (family.members ?? []).map((m) => m.w.toLowerCase());
    }),
);

describe('family members 未收录名单的处置', () => {
  it('每个族成员要么已收录，要么在本轮明确不建名单里', () => {
    const unclassified = [...familyMembers].filter((w) => !byWord.has(w) && !SKIPPED.has(w));
    expect(unclassified, `未分类的族成员: ${unclassified.join(', ')}`).toEqual([]);
  });

  it('不建与建词条互斥，且不建的都是真实族成员', () => {
    const overlap = [...SKIPPED].filter((w) => w in ADDED);
    expect(overlap).toEqual([]);
    const strangers = [...SKIPPED].filter((w) => !familyMembers.has(w));
    expect(strangers).toEqual([]);
  });

  it('补录的 33 个词条都存在并挂在声明的族上', () => {
    const missing: string[] = [];
    const wrongFamily: string[] = [];
    for (const [w, family] of Object.entries(ADDED)) {
      const entry = byWord.get(w);
      if (!entry) missing.push(w);
      else if (entry.family !== family) wrongFamily.push(`${w}: ${entry.family} ≠ ${family}`);
    }
    expect(missing).toEqual([]);
    expect(wrongFamily).toEqual([]);
  });

  it('补录词条都有中文释义、词源四层，且 parts 全部指向真实语素', () => {
    const bad: string[] = [];
    for (const w of Object.keys(ADDED)) {
      const entry = byWord.get(w);
      if (!entry) continue;
      if (!entry.glossZh || !/[\u4e00-\u9fff]/.test(entry.glossZh)) bad.push(`${w}: 缺中文释义`);
      if (!entry.ety?.historical) bad.push(`${w}: 缺 ety.historical`);
      const unknown = (entry.partIds ?? []).filter((id): id is string => Boolean(id) && !byId.has(id as string));
      if (unknown.length) bad.push(`${w}: 未知 partId ${unknown.join(',')}`);
    }
    expect(bad).toEqual([]);
  });

  it('除 omit 外，补录词条的切分都解析到唯一 ID', () => {
    const notExact = Object.keys(ADDED)
      .map((w) => byWord.get(w))
      .filter((w): w is Word => Boolean(w))
      .filter((w) => w.partResolution !== 'exact')
      .map((w) => `${w.w}:${w.partResolution}`);
    expect(notExact).toEqual(['omit:unresolved']);
  });

  it('omit 的整词记录有明确理由，不是漏解析', () => {
    const omitted = byWord.get('omit');
    expect(omitted?.parts).toEqual(['omit']);
    expect(omitted?.note).toContain('cx-o');
    expect(omitted?.ety?.historical).toContain('ob-');
  });

  it('despise 的 spis 变体进入 rx-spec，而不是挂在别的同形语素上', () => {
    const spec = byId.get('rx-spec');
    expect(spec?.allomorphs).toContain('spis');
    expect(byWord.get('despise')?.partIds).toEqual(['px-de', 'rx-spec']);
  });

  it('不建词条的理由写进了 docs/FAMILY_MEMBERS.md', () => {
    const doc = readFileSync(join(process.cwd(), 'docs', 'FAMILY_MEMBERS.md'), 'utf-8');
    for (const w of [...SKIPPED, ...Object.keys(ADDED)]) {
      expect(doc.toLowerCase(), `文档未解释 ${w}`).toContain(w);
    }
  });
});
