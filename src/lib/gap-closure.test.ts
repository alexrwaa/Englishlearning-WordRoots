/**
 * Gap-closure regression tests (0.9.2, docs/GAP_CLOSURE.md).
 *
 * The 41 S1 partials and the 3 S2 partials are closed by four different means,
 * and each means has a failure mode this file has to catch:
 *
 *   1. 没讲 → 补正文：the new card must carry the point and an example form;
 *   2. 缺定点练习 → 补原创题：the new item must name the point in its stem and
 *      explain why the tempting option is wrong (>= 60 chars);
 *   3. 有题没识别 → 改匹配：every `S1_PRACTICE_ANCHORS` entry must still match the
 *      exercise it names, and the audit must credit that exercise, not another;
 *   4. 事实错误 → 改正：no item may be closed by re-labelling; the verdicts are
 *      read back from the audit, not asserted from the doc.
 *
 * Nothing here pins unrelated counts, so ordinary content edits stay free.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM script, no type declarations by design.
import * as auditModule from '../../scripts/audit-textbook.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Audit = {
  S1_PRACTICE_ANCHORS: Record<string, { exerciseId: string; must: RegExp; note?: string }[]>;
  S1_TEACHING_OVERRIDES: Record<string, string>;
  buildAudit: () => any;
  loadCorpus: () => any;
};

const audit = auditModule as unknown as Audit;

const payload = audit.buildAudit();
const corpus = audit.loadCorpus();
const s1 = new Map<string, any>(payload.groups.S1.items.map((i: any) => [i.id, i]));
const s2 = new Map<string, any>(payload.groups.S2.items.map((i: any) => [i.id, i]));
const exerciseById = new Map<string, any>(corpus.exercises.map((e: any) => [e.exerciseId, e]));
const cardById = new Map<string, any>(corpus.cards.map((c: any) => [c.cardId, c]));

/** The 44 items the 0.9.2 report had to close. */
const CLOSED_S1 = [
  'kp-s1c1s1-2', 'kp-s1c1s2-1', 'kp-s1c1s3-2', 'kp-s1c1s4-1', 'kp-s1c1s4-2', 'kp-s1c1s8-2',
  'kp-s1c2s6-1', 'kp-s1c2s9-5', 'kp-s1c3s1-3', 'kp-s1c3s9-1', 'kp-s1c3s9-2', 'kp-s1c3s11-1',
  'kp-s1c3s16-1', 'kp-s1c4s1-3', 'kp-s1c4s5-1', 'kp-s1c4s8-1', 'kp-s1c5s1-1', 'kp-s1c5s2-1',
  'kp-s1c5s5-3', 'kp-s1c5s6-1', 'kp-s1c5s6-3', 'kp-s1c6s10-1', 'kp-s1c7s1-2', 'kp-s1c7s9-1',
  'kp-s1c7s10-2', 'kp-s1c7s12-1', 'kp-s1c8s1-2', 'kp-s1c8s2-4', 'kp-s1c8s2-5', 'kp-s1c8s3-2',
  'kp-s1c8s3-4', 'kp-s1c8s6-2', 'kp-s1c8s8-3', 'kp-s1c9s2-2', 'kp-s1c9s5-2', 'kp-s1c10s7-2',
  'kp-s1c10s7-3', 'kp-s1c10s10-3', 'kp-s1c11s4-1', 'kp-s1c11s5-2', 'kp-s1c11s6-3',
] as const;

const CLOSED_S2 = ['morphology', 'selection', 'hypercorrection'] as const;

/** New exercises written for the 18 S1 items that had no direct check. */
const NEW_S1_EXERCISES: [kp: string, exerciseId: string, must: RegExp][] = [
  ['kp-s1c1s3-2', 'w02d6-p6', /词典|收录/],
  ['kp-s1c1s4-1', 'w07d5-p6', /社区|19 世纪/],
  ['kp-s1c1s8-2', 'w07d5-p7', /腐化|丰富/],
  ['kp-s1c8s8-3', 'w07d5-p7', /管控|规范/],
  ['kp-s1c2s6-1', 'w09d7-p6', /三阶段/],
  ['kp-s1c2s9-5', 'w35d5-p6', /西撒克逊|伦敦/],
  ['kp-s1c3s9-1', 'w03d4-p7', /semi-/],
  ['kp-s1c3s11-1', 'w12d7-p7', /收益/],
  ['kp-s1c3s16-1', 'w07d4-p6', /截短/],
  ['kp-s1c4s5-1', 'w03d1-p7', /同化/],
  ['kp-s1c4s8-1', 'w05d3-p7', /duc/],
  ['kp-s1c5s2-1', 'w23d2-p6', /气流/],
  ['kp-s1c5s5-3', 'w23d5-p6', /三轴|部位/],
  ['kp-s1c5s6-1', 'w23d6-p6', /标尺|元音/],
  ['kp-s1c5s6-3', 'w23d7-p6', /中央元音/],
  ['kp-s1c6s10-1', 'w20d7-p6', /检查表|六步/],
  ['kp-s1c8s1-2', 'w12d5-p7', /hypertension/],
  ['kp-s1c9s2-2', 'w13d6-p6', /词根/],
];

describe('44 条 partial 现在都有讲解证据与练习证据', () => {
  it('S1: every closed point is complete and the evidence is clickable', () => {
    for (const id of CLOSED_S1) {
      const item = s1.get(id);
      expect(item, id).toBeTruthy();
      expect(item.status, id).toBe('complete');
      expect(item.evidence.teaching?.lessonId, id).toBeTruthy();
      expect(item.evidence.teaching?.cardId, id).toBeTruthy();
      expect(cardById.get(item.evidence.teaching.cardId), `${id} teaching card`).toBeTruthy();
      expect(item.evidence.practice?.lessonId, id).toBeTruthy();
      expect(item.evidence.practice?.exerciseId, id).toBeTruthy();
      expect(exerciseById.get(item.evidence.practice.exerciseId), `${id} practice item`).toBeTruthy();
    }
  });

  it('S2: every closed concept is complete and the evidence is clickable', () => {
    for (const id of CLOSED_S2) {
      const item = s2.get(id);
      expect(item, id).toBeTruthy();
      expect(item.status, id).toBe('complete');
      expect(cardById.get(item.evidence.teaching.cardId), `${id} teaching card`).toBeTruthy();
      expect(exerciseById.get(item.evidence.practice.exerciseId), `${id} practice item`).toBeTruthy();
    }
  });

  it('no closed point is still partial or missing', () => {
    for (const id of CLOSED_S1) expect(s1.get(id).status, id).not.toBe('partial');
    for (const id of CLOSED_S2) expect(s2.get(id).status, id).not.toBe('partial');
  });
});

describe('归因 3：锚点必须仍然命中它点名的那道题', () => {
  it('every anchor names a real exercise and its `must` matches the question', () => {
    for (const [kp, anchors] of Object.entries(audit.S1_PRACTICE_ANCHORS)) {
      expect(s1.get(kp), kp).toBeTruthy();
      for (const anchor of anchors) {
        const e = exerciseById.get(anchor.exerciseId);
        expect(e, `${kp} → ${anchor.exerciseId}`).toBeTruthy();
        expect(anchor.must.test(e.promptText), `${kp} must match ${anchor.exerciseId}: ${e.stemText.slice(0, 80)}`).toBe(true);
        // Feedback gate is the same for anchor and recall paths.
        expect(e.explain.length, `${anchor.exerciseId} explain`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('when the audit credits an anchor, it is the first matching one', () => {
    for (const [kp, anchors] of Object.entries(audit.S1_PRACTICE_ANCHORS)) {
      const item = s1.get(kp);
      if (item.evidence.practice?.how !== 'anchor') continue;
      const firstMatch = anchors.find((a) => {
        const e = exerciseById.get(a.exerciseId);
        return e && a.must.test(e.promptText);
      });
      expect(firstMatch, kp).toBeTruthy();
      expect(item.evidence.practice.exerciseId, kp).toBe(firstMatch!.exerciseId);
    }
  });

  it('4 条 teaching 覆盖由 overrides 指定，且指向的卡真的在讲解该点', () => {
    for (const [kp, cardId] of Object.entries(audit.S1_TEACHING_OVERRIDES)) {
      expect(s1.get(kp).evidence.teaching.cardId, kp).toBe(cardId);
      expect(cardById.get(cardId), cardId).toBeTruthy();
    }
  });
});

describe('归因 2 / 1：新补的题必须真的问那个点', () => {
  it('each new S1 exercise exists, names the point and explains the trap', () => {
    for (const [kp, exerciseId, must] of NEW_S1_EXERCISES) {
      const e = exerciseById.get(exerciseId);
      expect(e, exerciseId).toBeTruthy();
      expect(must.test(e.promptText), `${exerciseId} prompt`).toBe(true);
      expect(Array.from(e.explain).length, `${exerciseId} explain`).toBeGreaterThanOrEqual(60);
      // The item must be the one the audit credits for that point.
      expect(s1.get(kp).evidence.practice.exerciseId, `${kp} → ${exerciseId}`).toBe(exerciseId);
    }
  });

  it('new prose cards carry the point they were written for', () => {
    // 三阶段框架（kp-s1c2s6-1）：正文必须写出三段分期，而不只是一条时间轴表。
    const stages = cardById.get('w09d7-c6');
    expect(stages).toBeTruthy();
    for (const token of ['古英语', '中古英语', '现代英语', '1066']) expect(stages.body).toContain(token);
    // 四重收益（kp-s1c3s11-1）
    const benefits = cardById.get('w12d7-c6');
    expect(benefits).toBeTruthy();
    for (const token of ['preclude', 'fer', '-able', 'ask / question / interrogate']) expect(benefits.body).toContain(token);
    // 借词层音系规则（kp-s1c4s5-1）
    const layers = cardById.get('w03d1-c6');
    expect(layers).toBeTruthy();
    for (const token of ['im-', 'unbalanced', '软化']) expect(layers.body).toContain(token);
    // 单音节词根的两种命运（kp-s1c9s2-2）
    const roots = cardById.get('w13d6-c6');
    expect(roots).toBeTruthy();
    for (const token of ['caud-', 'dent-', 'sun', 'man']) expect(roots.body).toContain(token);
  });

  it('S2 morphology now has its own example forms on the teaching card', () => {
    const card = cardById.get(s2.get('morphology').evidence.teaching.cardId);
    for (const token of ['teachers', 'unkind', 'table']) expect(card.body).toContain(token);
  });

  it('S2 selection is recognised from the option that states the host condition', () => {
    const e = exerciseById.get('w38d3-p4');
    expect(e).toBeTruthy();
    expect(e.optionText).toContain('宿主必须是形容词');
    expect(s2.get('selection').evidence.practice.exerciseId).toBe('w38d3-p4');
  });

  it('S2 hypercorrection gets a check that names the concept, not one that hides it in feedback', () => {
    const e = exerciseById.get('w16d3-p6');
    expect(e).toBeTruthy();
    expect(e.promptText).toContain('过度纠正');
    expect(s2.get('hypercorrection').evidence.practice.exerciseId).toBe('w16d3-p6');
  });
});

describe('报告与审计一致', () => {
  it('docs/GAP_CLOSURE.md lists every closed id', () => {
    const doc = readFileSync(new URL('../../docs/GAP_CLOSURE.md', import.meta.url), 'utf8');
    for (const id of [...CLOSED_S1, ...CLOSED_S2]) expect(doc, id).toContain(id);
  });

  it('the audit on disk agrees with the live build for the closed ids', () => {
    const disk = JSON.parse(readFileSync(new URL('../../docs/textbook-audit.json', import.meta.url), 'utf8'));
    const diskS1 = new Map<string, any>(disk.groups.S1.items.map((i: any) => [i.id, i]));
    const diskS2 = new Map<string, any>(disk.groups.S2.items.map((i: any) => [i.id, i]));
    for (const id of CLOSED_S1) expect(diskS1.get(id).status, id).toBe(s1.get(id).status);
    for (const id of CLOSED_S2) expect(diskS2.get(id).status, id).toBe(s2.get(id).status);
  });
});
