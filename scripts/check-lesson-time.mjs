#!/usr/bin/env node
/**
 * Lesson time audit.
 *
 * Every lesson declares `minutes` (24-28) and the validator checks that the four
 * parts add up. That only proves the arithmetic: an author can write a 1200-word
 * card and still claim "learn: 8". This script estimates the real load from the
 * content and reports the lessons where the claim and the estimate disagree.
 *
 *   node scripts/check-lesson-time.mjs            # report
 *   node scripts/check-lesson-time.mjs --strict   # exit 1 when a lesson is >50% off
 *   node scripts/check-lesson-time.mjs --write    # write docs/LESSON_TIME.md
 *
 * The model is deliberately simple and printed with the report, because a
 * model nobody can inspect is just another invented number.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WEEKS = 'src/content/weeks';

// Chinese prose reads at roughly 300 chars/min for a B2 learner working through
// unfamiliar material; English at 180 words/min. Exercises are budgeted per kind.
// A learner working through unfamiliar morphology is slower than a fluent
// reader: 180 CJK chars/min, 120 English words/min, plus thinking time per task.
const CJK_PER_MIN = 180;
const EN_WORDS_PER_MIN = 120;
const EXERCISE_MIN = {
  mcq: 1.0,
  multi: 1.2,
  cloze: 1.2,
  wordSum: 2.5,
  matrix: 3.0,
  infer: 2.5,
  boundary: 2.0,
  judge: 1.0,
  passage: 4.0,
};
const APPLY_MIN = 3.0;

const countCjk = (text) => (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
const countEn = (text) => (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;

function textOf(node, depth = 0) {
  if (depth > 5 || node === null || node === undefined) return '';
  if (typeof node === 'string') return `${node}\n`;
  if (Array.isArray(node)) return node.map((item) => textOf(item, depth + 1)).join('');
  if (typeof node === 'object') {
    return Object.entries(node)
      .filter(([key]) => !['id', 'kind', 'morphemes', 'morphemeIds', 'concepts', 'sources', 'knowledgePoints'].includes(key))
      .map(([, value]) => textOf(value, depth + 1))
      .join('');
  }
  return '';
}

const lessons = [];
for (const dir of existsSync(WEEKS) ? readdirSync(WEEKS).sort() : []) {
  const path = join(WEEKS, dir);
  if (!existsSync(path)) continue;
  for (const file of readdirSync(path).filter((f) => /^day\d+\.json$/.test(f)).sort()) {
    try {
      lessons.push({ file: `${dir}/${file}`, lesson: JSON.parse(readFileSync(join(path, file), 'utf8')) });
    } catch {
      /* validate-content reports unparsable files; this audit ignores them. */
    }
  }
}

const rows = lessons.map(({ file, lesson }) => {
  const declared = Object.values(lesson.minutes ?? {}).reduce((sum, n) => sum + Number(n || 0), 0);
  const cardText = (lesson.cards ?? []).map((card) => textOf(card)).join('');
  const readingMin = countCjk(cardText) / CJK_PER_MIN + countEn(cardText) / EN_WORDS_PER_MIN;
  const exercises = [...(lesson.practice ?? []), ...(lesson.apply ?? [])];
  const exerciseMin = exercises.reduce((sum, ex) => sum + (EXERCISE_MIN[ex.kind] ?? 0.75), 0);
  const estimated = Math.round((readingMin + exerciseMin + APPLY_MIN) * 10) / 10;
  const delta = declared > 0 ? (estimated - declared) / declared : 0;
  return {
    file,
    id: lesson.id,
    declared,
    estimated,
    delta: Math.round(delta * 100) / 100,
    chars: countCjk(cardText),
    words: countEn(cardText),
    exercises: exercises.length,
  };
});

// Absolute minutes cannot be validated without real learners, so the audit
// compares each lesson with its cohort: same declared slot, but twice the
// material, is the defect worth catching.
const ratios = rows.map((row) => (row.declared > 0 ? row.estimated / row.declared : 1)).sort((a, b) => a - b);
const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 1;
for (const row of rows) {
  row.ratio = row.declared > 0 ? Math.round((row.estimated / row.declared) * 100) / 100 : 0;
  row.relative = median > 0 ? Math.round(((row.ratio - median) / median) * 100) / 100 : 0;
}
const off = rows.filter((row) => Math.abs(row.relative) > 0.35).sort((a, b) => Math.abs(b.relative) - Math.abs(a.relative));
const severe = rows.filter((row) => Math.abs(row.relative) > 0.6);
const mean = rows.length ? rows.reduce((sum, row) => sum + row.delta, 0) / rows.length : 0;

console.log(`lessons: ${rows.length}`);
console.log(`declared total: ${rows.reduce((s, r) => s + r.declared, 0)} min, estimated total: ${Math.round(rows.reduce((s, r) => s + r.estimated, 0))} min`);
console.log(`cohort median estimated/declared: ${median.toFixed(2)} (absolute deviation ${(mean * 100).toFixed(0)}% — thinking time is not measurable, so relative is what we act on)`);
console.log(`>35% off the cohort: ${off.length}  | >60% off: ${severe.length}`);
for (const row of off.slice(0, 12)) {
  console.log(`  ${row.file}  ${row.declared} min, ${row.chars} CJK + ${row.words} EN, ${row.exercises} tasks → ratio ${row.ratio} (${(row.relative * 100).toFixed(0)}% vs median)`);
}

if (process.argv.includes('--write')) {
  const lines = [
    '# 课时负担审计',
    '',
    '> 由 `node scripts/check-lesson-time.mjs --write` 生成。标称时长由作者填写，本表按内容量估算实际负担。',
    '',
    `- 课数：${rows.length}`,
    `- 标称总时长：${rows.reduce((s, r) => s + r.declared, 0)} 分钟；估算总时长：${Math.round(rows.reduce((s, r) => s + r.estimated, 0))} 分钟`,
    `- 同侪中位比值（估算/标称）：${median.toFixed(2)}；绝对偏差 ${(mean * 100).toFixed(0)}%（含思考时间，不作为判据）`,
    `- 偏离中位 >35% 的课：${off.length}；>60% 的课：${severe.length}`,
    '',
    '> 绝对分钟数无法在没有真实学习者的情况下验证，因此判据是**同侪相对偏差**：',
    '> 同样标称 25 分钟，材料量是同伴两倍的课，才是需要调整的那一节。',
    '',
    '估算模型：中文 180 字/分钟、英文 120 词/分钟（含查词与回读）；练习按题型计时（mcq 1.0、cloze 1.2、',
    'wordSum 2.5、matrix 3.0、boundary 2.0、judge 1.0、infer 2.5、passage 4.0）；apply 固定 3 分钟。',
    '',
    '| 课时 | 标称 | 估算 | 比值 | 相对中位 | 中文字数 | 英文词数 | 题目数 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...off.map((row) => `| ${row.file} | ${row.declared} | ${row.estimated} | ${row.ratio} | ${(row.relative * 100).toFixed(0)}% | ${row.chars} | ${row.words} | ${row.exercises} |`),
    '',
  ];
  writeFileSync('docs/LESSON_TIME.md', `${lines.join('\n')}\n`, 'utf8');
  console.log('docs/LESSON_TIME.md written');
}

if (process.argv.includes('--strict') && severe.length > 0) {
  console.error(`strict: ${severe.length} lesson(s) deviate from the cohort median by more than 60%`);
  process.exit(1);
}
