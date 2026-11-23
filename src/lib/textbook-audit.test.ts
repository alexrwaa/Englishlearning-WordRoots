/**
 * Locks the audit criteria themselves, not the current numbers.
 *
 * The report is generated, so a test that pins every count would fail on every
 * content edit and get deleted. What must not drift is the measuring rule:
 * a glossary entry is not teaching, an explanation-only mention is not practice,
 * a practice hit must name the point in the question, and the report on disk must
 * be reproducible from the script.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM script, no type declarations by design.
import * as auditModule from '../../scripts/audit-textbook.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

type AuditModule = {
  CRITERIA: Record<string, number | string>;
  classify: (taught: boolean, practiced: boolean, feedback: boolean, explained?: boolean) => string;
  buildAudit: (opts?: { root?: string }) => any;
  evaluateConcept: (def: AnyRecord, corpus: AnyRecord) => any;
  normalizeLesson: (lesson: AnyRecord) => any;
};

const audit = auditModule as unknown as AuditModule;

const CARD = (body: string, extra: AnyRecord = {}) => ({ kind: 'text', title: '测试卡', body, ...extra });
const LESSON = (cards: AnyRecord[], practice: AnyRecord[] = [], apply: AnyRecord[] = []) => ({
  id: 'w99d1',
  week: 99,
  day: 1,
  title: '测试课时',
  cards,
  practice,
  apply,
});

const EXERCISE = (over: AnyRecord = {}) => ({
  id: 'w99d1-p1',
  kind: 'mcq',
  prompt: '看题',
  choices: ['甲', '乙'],
  answer: 0,
  explain: '这一项的解析足够长，可以说明为什么甲对乙错，超过四十个字符的门槛，因此算作有效反馈。',
  ...over,
});

const corpusOf = (lesson: AnyRecord) => {
  const norm = audit.normalizeLesson(lesson);
  return { cards: norm.cards, exercises: norm.exercises };
};

const DVANDVA = {
  id: 'dvandva',
  term: 'dvandva',
  termZh: '并列复合',
  patterns: [/dvandva/i, /并列复合/],
  examples: ['bittersweet'],
};

/** 120+ Chinese characters of real prose that names the concept. */
const LONG_BODY =
  '并列复合词（dvandva）的两个成分地位平等，谁也不修饰谁，整体指 A 和 B 两样东西。' +
  'bittersweet 既苦又甜，deaf-mute 既聋又哑，tragicomic 既悲又喜，都是这一类。' +
  '它既不是向心复合，也不是离心复合：向心词整体是中心语的一种，离心词整体指一个第三者。' +
  '英语的并列复合词不多，梵语与日语里才是能产的类型。判断时只问一句：整体是不是「A 和 B 两者」。';

describe('taught: 只统计正文里有讲解的', () => {
  it('glossary-only coverage is not teaching', () => {
    const corpus = corpusOf(
      LESSON([CARD('本节只列术语，正文没有展开。', { terms: [{ term: 'dvandva', zh: '并列复合', note: '两个成分地位平等' }] })]),
    );
    const result = audit.evaluateConcept(DVANDVA, corpus);
    expect(result.taught).toBe(false);
    expect(result.status).toBe('missing');
  });

  it('a substantial card without an example form is not teaching', () => {
    const body = LONG_BODY.replace(/bittersweet|deaf-mute|tragicomic/g, '某某词');
    const result = audit.evaluateConcept(DVANDVA, corpusOf(LESSON([CARD(body)])));
    expect(result.taught).toBe(false);
  });

  it('prose over the threshold plus one real example is teaching', () => {
    const result = audit.evaluateConcept(DVANDVA, corpusOf(LESSON([CARD(LONG_BODY)])));
    expect(result.taught).toBe(true);
    expect(result.evidence.teaching).toMatchObject({ lessonId: 'w99d1', cardId: 'w99d1-c1' });
  });
});

describe('practiced: 题干要真的问它', () => {
  it('a mention confined to the explanation is not practice', () => {
    const corpus = corpusOf(
      LESSON(
        [CARD(LONG_BODY)],
        [EXERCISE({ prompt: '下面哪个词是复合词？', choices: ['blackbird', 'unhappy'], explain: `${'解析'.repeat(30)}这是 dvandva 的一种。` })],
      ),
    );
    const result = audit.evaluateConcept(DVANDVA, corpus);
    expect(result.taught).toBe(true);
    expect(result.practiced).toBe(false);
    expect(result.status).toBe('partial');
  });

  it('a stem or an option that names the point counts as practice', () => {
    const byStem = corpusOf(LESSON([CARD(LONG_BODY)], [EXERCISE({ prompt: '下面哪个是并列复合词（dvandva）？', choices: ['bittersweet', 'blackbird'] })]));
    expect(audit.evaluateConcept(DVANDVA, byStem).practiced).toBe(true);

    const byOption = corpusOf(
      LESSON([CARD(LONG_BODY)], [EXERCISE({ prompt: '下面哪个词是并列复合词？', choices: ['bittersweet（dvandva）', 'blackbird'] })]),
    );
    expect(audit.evaluateConcept(DVANDVA, byOption).practiced).toBe(true);
  });

  it('a distractor in a lesson that never teaches the point cannot manufacture practice', () => {
    const corpus = corpusOf(
      LESSON([CARD('这节课讲前缀，和复合无关。'.repeat(20))], [EXERCISE({ prompt: '哪个前缀表示「不」？', choices: ['un-（不是 dvandva）', 're-'] })]),
    );
    const result = audit.evaluateConcept(DVANDVA, corpus);
    expect(result.taught).toBe(false);
    expect(result.practiced).toBe(false);
  });

  it('feedback needs a real explanation', () => {
    const corpus = corpusOf(LESSON([CARD(LONG_BODY)], [EXERCISE({ prompt: '哪个是 dvandva？', explain: '对。' })]));
    const result = audit.evaluateConcept(DVANDVA, corpus);
    expect(result.practiced).toBe(true);
    expect(result.feedback).toBe(false);
    expect(result.status).toBe('partial');
  });
});

describe('status is the three-gate combination', () => {
  it('missing without teaching, partial without practice or feedback, complete with all three', () => {
    expect(audit.classify(false, false, false)).toBe('missing');
    expect(audit.classify(false, true, true)).toBe('missing');
    expect(audit.classify(true, false, false)).toBe('partial');
    expect(audit.classify(true, true, false)).toBe('partial');
    expect(audit.classify(true, true, true)).toBe('complete');
    // Explanation without an example is a missing gate, not a missing lesson.
    expect(audit.classify(false, true, true, true)).toBe('partial');
  });
});

describe('the audit reproduces the current course', () => {
  let payload: any;
  let groups: Record<string, any>;

  beforeAll(() => {
    payload = audit.buildAudit();
    groups = payload.groups as Record<string, any>;
  });

  it('reads every lesson, card and exercise', () => {
    // Weeks and lessons are course structure: if they move, something happened
    // worth stopping for. Card and exercise totals move whenever content is
    // added, so pinning them would fail on every legitimate edit — the property
    // worth protecting is that the audit read the whole corpus, not that it is
    // still 1230 cards.
    expect(payload.corpus).toMatchObject({ weeks: 39, lessons: 243 });
    expect(payload.corpus.cards).toBeGreaterThan(1200);
    expect(payload.corpus.exercises).toBeGreaterThan(1500);
  });

  it('S2 covers all 43 concepts and every verdict carries evidence', () => {
    const items = groups.S2.items as any[];
    expect(items).toHaveLength(43);
    for (const item of items) {
      expect(item.evidence.teaching, String(item.id)).toBeTruthy();
    }
  });

  it('the three concepts missing in 0.8.0 are taught in the current content', () => {
    const items = groups.S2.items as any[];
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get('dvandva')?.evidence.teaching).toMatchObject({ lessonId: 'w36d4', cardId: 'w36d4-c6' });
    expect(byId.get('dvandva')?.status).toBe('complete');
    expect(byId.get('grammaticalization')?.evidence.teaching).toMatchObject({ lessonId: 'w36d3', cardId: 'w36d3-c6' });
    expect(byId.get('grammaticalization')?.status).toBe('complete');
    // The old fake coverage was a glossary entry on w15d4; the teaching card must
    // be that lesson's prose card, and the check must be the cloze on often.
    expect(byId.get('spelling-pronunciation')?.evidence.teaching).toMatchObject({ lessonId: 'w15d4', cardId: 'w15d4-c5' });
    expect(byId.get('spelling-pronunciation')?.evidence.practice).toMatchObject({ lessonId: 'w15d4', exerciseId: 'w15d4-p6' });
  });

  it('S3 credits only student-produced artefacts', () => {
    const steps = groups.S3.steps as any[];
    const byId = new Map(steps.map((s) => [s.id, s]));
    expect(byId.get('matrix')?.evidence.student[0]).toMatchObject({ kind: 'matrix' });
    expect(byId.get('wordSum')?.evidence.student[0]).toMatchObject({ kind: 'wordSum' });
    expect(byId.get('observe')?.evidence.student[0]).toMatchObject({ lessonId: 'w38d1', exerciseId: 'w38d1-p6' });
    for (const step of steps) expect(step.studentItemCount, String(step.id)).toBeGreaterThan(0);
  });

  it('S4 flags the two 0.8.0 over-strong claims as isolated', () => {
    const claims = groups.S4.claims as any[];
    const byId = new Map(claims.map((c) => [c.id, c]));
    expect(byId.get('oc-iron-date')?.isolation).toBe('explicit');
    expect(byId.get('oc-iron-date')?.cardIds).toContain('w29d2-c1');
    expect(byId.get('oc-wheel-date')?.isolation).toBe('explicit');
    expect(byId.get('oc-wheel-date')?.cardIds).toContain('w29d2-c3');
    expect(groups.S4.leakCheck.leaks).toEqual([]);
  });

  it('the report on disk is reproducible and names the same numbers', () => {
    const disk = JSON.parse(readFileSync(new URL('../../docs/textbook-audit.json', import.meta.url), 'utf8')) as AnyRecord;
    const strip = (p: AnyRecord) => {
      const rest = { ...p };
      delete rest.generatedAt;
      delete rest.digest;
      return rest;
    };
    expect(strip(disk)).toEqual(strip(payload));

    const md = readFileSync(new URL('../../docs/TEXTBOOK_S2_S3_S4.md', import.meta.url), 'utf8');
    expect(md).toContain(`<!-- audit-digest: ${payload.digest} -->`);
    expect(md).toContain('由 `node scripts/audit-textbook.mjs` 生成');
    for (const key of ['S1', 'S2', 'S3', 'S4']) {
      const g = groups[key];
      expect(md).toContain(`**${g.complete}** / ${g.partial} / ${g.missing}`);
    }
  });
});
