/**
 * Textbook-gap regression tests (S2 / S3 / S4).
 *
 * Locks in the fixes made after docs/TEXTBOOK_S2_S3_S4.md:
 * - three S2 concepts that were missing (dvandva, grammaticalization,
 *   spelling pronunciation — the last one was a fake-coverage term gloss);
 * - seven S2 partials that lacked either explanation, examples or a check;
 * - one S3 inquiry cycle (data → student's own hypothesis → counterexample);
 * - the S4 claims that were stated too strongly, plus the two unlabelled
 *   textbook simplifications.
 *
 * Every assertion names a real card title or exercise id, so a future edit that
 * drops the teaching (not just the wording) fails here instead of silently
 * lowering coverage again.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type Exercise = {
  id: string;
  kind: string;
  prompt: string;
  answer?: string | number | number[];
  choices?: string[];
  sentence?: string;
  word?: string;
  segments?: string[];
  explain: string;
};

type Card = { kind: string; title: string; body: string; terms?: { term: string }[] };

type Lesson = {
  id: string;
  minutes: Record<string, number>;
  cards: Card[];
  practice: Exercise[];
  apply: Exercise[];
};

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf-8');

const readLesson = (week: number, day: number): Lesson =>
  JSON.parse(read(`../content/weeks/week${String(week).padStart(2, '0')}/day${day}.json`)) as Lesson;

const card = (lesson: Lesson, titlePart: string): Card => {
  const hit = lesson.cards.find((c) => c.title.includes(titlePart));
  if (!hit) throw new Error(`${lesson.id} has no card titled like "${titlePart}"`);
  return hit;
};

const exercise = (lesson: Lesson, id: string): Exercise => {
  const hit = [...lesson.practice, ...lesson.apply].find((e) => e.id === id);
  if (!hit) throw new Error(`${lesson.id} has no exercise ${id}`);
  return hit;
};

describe('course shape is unchanged', () => {
  it('still has 243 lessons and 39 weeks', () => {
    const weeks = readdirSync(new URL('../content/weeks', import.meta.url), { withFileTypes: true }).filter(
      (d) => d.isDirectory() && /^week\d{2}$/.test(d.name),
    );
    const lessons = weeks.reduce(
      (sum, w) =>
        sum +
        readdirSync(new URL(`../content/weeks/${w.name}`, import.meta.url)).filter((f) => /^day\d\.json$/.test(f))
          .length,
      0,
    );
    expect(weeks).toHaveLength(39);
    expect(lessons).toBe(243);
  });

  it('keeps every touched lesson inside the 24–28 minute band', () => {
    for (const [week, day] of [
      [9, 1],
      [15, 4],
      [29, 2],
      [33, 4],
      [34, 1],
      [35, 2],
      [35, 6],
      [36, 3],
      [36, 4],
      [37, 2],
      [38, 1],
      [38, 2],
      [38, 6],
      [39, 3],
    ] as const) {
      const total = Object.values(readLesson(week, day).minutes).reduce((a, b) => a + b, 0);
      expect(total, `w${week}d${day}`).toBeGreaterThanOrEqual(24);
      expect(total, `w${week}d${day}`).toBeLessThanOrEqual(28);
    }
  });
});

describe('S2 missing concepts are now taught (explanation + example + check)', () => {
  it('dvandva: w36d4 explains the third compound type with examples and a check', () => {
    const lesson = readLesson(36, 4);
    const c = card(lesson, 'dvandva');
    expect(c.body).toContain('并列复合词');
    expect(c.body).toContain('bittersweet');
    expect(c.body).toContain('地位平等');
    // Boundary against the two types the course already taught.
    expect(c.body).toContain('向心');
    expect(c.body).toContain('离心');

    const p = exercise(lesson, 'w36d4-p6');
    expect(p.prompt).toContain('dvandva');
    expect(p.choices?.[p.answer as number]).toBe('bittersweet');
    expect(p.explain).toContain('向心');
  });

  it('grammaticalization: w36d3 gives the lexical→grammatical channel, examples and a check', () => {
    const lesson = readLesson(36, 3);
    const c = card(lesson, '实词变语法词');
    expect(c.body).toContain('grammaticalization');
    expect(c.body).toContain('be going to');
    expect(c.body).toContain('单向性');
    expect(c.body).toContain('语义漂白');

    const p = exercise(lesson, 'w36d3-p6');
    expect(p.kind).toBe('cloze');
    expect(p.answer).toBe('grammaticalization');
    expect(p.explain).toContain('实词');
  });

  it('spelling pronunciation: w15d4 teaches it in the body, not only in the term list', () => {
    const lesson = readLesson(15, 4);
    const c = card(lesson, '容易踩的坑');
    expect(c.body).toContain('spelling pronunciation');
    expect(c.body).toContain('often');
    expect(c.body).toContain('waistcoat');
    // The old fake coverage was a term entry with no prose; the term must now
    // sit on a card whose body actually defines it.
    expect(c.terms?.some((t) => t.term === 'spelling pronunciation')).toBe(true);

    const p = exercise(lesson, 'w15d4-p6');
    expect(p.kind).toBe('cloze');
    expect(p.answer).toBe('spelling');
    expect(p.sentence).toContain('often');
  });
});

describe('S2 partials now have explanation + example + check', () => {
  it('blocking: w39d3 names the mechanism and separates it from rule violation', () => {
    const lesson = readLesson(39, 3);
    const c = card(lesson, '阻塞');
    expect(c.body).toContain('blocking');
    expect(c.body).toContain('glory');
    expect(c.body).toContain('不是规则违规');
    expect(c.body).toContain('词汇化');

    const p = exercise(lesson, 'w39d3-p6');
    expect(p.prompt).toContain('gloriosity');
    expect(p.choices?.[p.answer as number]).toContain('阻塞');
  });

  it('reduplication: w37d2 adds types, an example set and a check', () => {
    const lesson = readLesson(37, 2);
    const c = card(lesson, '重叠');
    expect(c.body).toContain('reduplication');
    expect(c.body).toContain('完全重叠');
    expect(c.body).toContain('orang-orang');
    expect(c.body).toContain('ablaut reduplication');

    const p = exercise(lesson, 'w37d2-p6');
    expect(p.choices?.[p.answer as number]).toBe('zigzag');
    expect(p.explain).toContain('部分重叠');
  });

  it('morphological typology: w33d4 gives the four-way frame and its limits', () => {
    const lesson = readLesson(33, 4);
    const c = card(lesson, '标签表');
    expect(c.body).toContain('孤立语');
    expect(c.body).toContain('黏着语');
    expect(c.body).toContain('屈折语');
    expect(c.body).toContain('多式综合语');
    expect(c.body).toContain('描述性概括');
    expect(c.body).toContain('优劣');

    const p = exercise(lesson, 'w33d4-p6');
    expect(p.choices?.[p.answer as number]).toContain('描述性概括');
  });

  it('tree diagram: w38d6 draws the tree and states the internal-node rule', () => {
    const lesson = readLesson(38, 6);
    const c = card(lesson, '画成树');
    expect(c.body).toContain('unhelpfulness');
    expect(c.body).toContain('helpful');
    expect(c.body).toContain('内部节点');
    expect(c.body).toContain('先 help + ful');

    const p = exercise(lesson, 'w38d6-p6');
    expect(p.choices?.[p.answer as number]).toBe('[[un + [help + ful]] + ness]');
    expect(p.explain).toContain('内部节点');
  });

  it('structural ambiguity: w38d2 shows two legal parses, not one wrong one', () => {
    const lesson = readLesson(38, 2);
    const c = card(lesson, '结构歧义');
    expect(c.body).toContain('unlockable');
    expect(c.body).toContain('都落在词素边界上');

    const p = exercise(lesson, 'w38d2-p6');
    expect(p.prompt).toContain('unlockable');
    expect(p.choices?.[p.answer as number]).toContain('[un + [lock + able]]');
    expect(p.explain).toContain('结构歧义');
  });

  it('tense vs aspect: w35d2 defines both categories and contrasts them', () => {
    const lesson = readLesson(35, 2);
    const c = card(lesson, '时与体');
    expect(c.body).toContain('tense');
    expect(c.body).toContain('aspect');
    expect(c.body).toContain('has walked');
    expect(c.body).toContain('不是“过去时”');

    const p = exercise(lesson, 'w35d2-p6');
    expect(p.choices?.[p.answer as number]).toContain('完成体');
  });

  it('metathesis: w34d1 names it, gives three examples and a check', () => {
    const lesson = readLesson(34, 1);
    const c = card(lesson, '两个音换了位置');
    expect(c.body).toContain('metathesis');
    expect(c.body).toContain('brid');
    expect(c.body).toContain('through');
    expect(c.body).toContain('ask');
    expect(c.body).toContain('口误');

    const p = exercise(lesson, 'w34d1-p6');
    expect(p.kind).toBe('cloze');
    expect(p.answer).toBe('metathesis');
  });
});

describe('S3: students propose a rule before being told it', () => {
  it('w38d1 supplies raw data without stating the rule', () => {
    const lesson = readLesson(38, 1);
    const data = card(lesson, '规则先由你写');
    expect(data.body).toContain('/wɔːkt/');
    expect(data.body).toContain('/ˈwɒntɪd/');
    expect(data.body).toContain('先写下来');
    // The point of the step: the rule must not be printed before the attempt.
    expect(data.body).not.toContain('前面是 t 或 d');
  });

  it('w38d1 then supplies a counterexample that forces the rule to be revised', () => {
    const lesson = readLesson(38, 1);
    const refutation = card(lesson, '反例');
    expect(refutation.body).toContain('blessed');
    expect(refutation.body).toContain('learned');
    expect(refutation.body).toContain('被推翻');
    expect(refutation.body).toContain('词汇条件');
    expect(refutation.body).toContain('/blest/');
  });

  it('the two checks require choosing the surviving hypothesis and using it', () => {
    const lesson = readLesson(38, 1);
    const revise = exercise(lesson, 'w38d1-p6');
    expect(revise.prompt).toContain('blessed');
    expect(revise.choices?.[revise.answer as number]).toContain('按词条');

    const use = exercise(lesson, 'w38d1-p7');
    expect(use.kind).toBe('boundary');
    expect(use.word).toBe('decided');
    expect(use.segments?.join('')).toBe('decided');
    expect(use.segments).toContain('ed');
    expect(use.explain).toContain('/ɪd/');
  });
});

describe('S4: over-strong claims are labelled instead of asserted', () => {
  it('w29d2 no longer turns the missing iron word into a clear verdict', () => {
    const lesson = readLesson(29, 2);
    const c = card(lesson, '没有“铁”');
    expect(c.body).toContain('教材的推断');
    expect(c.body).toContain('教材说法');
    expect(c.body).toContain('bear');
    expect(c.body).not.toContain('结论很清楚');
    expect(c.body).not.toContain('已经散开了');
  });

  it('w29d2 no longer turns the wheel vocabulary into a hard date limit', () => {
    const lesson = readLesson(29, 2);
    const c = card(lesson, '轮轴');
    expect(c.body).toContain('教材由此给出一个上限');
    expect(c.body).toContain('不是硬约束');
    expect(c.body).toContain('有争议');
    expect(c.body).not.toContain('不可能早于');
  });

  it('the wheel exercise now tests the labelled claim, not the strong one', () => {
    const lesson = readLesson(29, 2);
    const p = exercise(lesson, 'w29d2-p2');
    const answer = p.choices?.[p.answer as number] ?? '';
    expect(answer).toContain('上限线索');
    expect(answer).toContain('不是硬约束');
    expect(p.explain).toContain('bear');
  });

  it('w09d1 says the three-layer model is not the whole vocabulary', () => {
    const lesson = readLesson(9, 1);
    const c = card(lesson, '三层对照表');
    expect(c.body).toContain('这三层不是全集');
    expect(c.body).toContain('古北欧语');
  });

  it('w35d6 labels the “one step up” image as a teaching metaphor', () => {
    const lesson = readLesson(35, 6);
    const c = card(lesson, '对应不是音值相等');
    expect(c.body).toContain('教材说法');
    expect(c.body).toContain('教学隐喻');
    expect(c.body).toContain('地域差');
  });

  it('w33d4 labels 19th-century typology as a descriptive frame, not a ranking', () => {
    const lesson = readLesson(33, 4);
    const c = card(lesson, '标签表');
    expect(c.body).toContain('19 世纪');
    expect(c.body).toContain('描述性概括');
    expect(c.body).toContain('已被抛弃');
  });
});
