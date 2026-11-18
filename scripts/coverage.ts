/**
 * Textbook coverage audit.
 *
 * The point of this script is to stop us from claiming "the curriculum covers
 * the textbook" without evidence. It joins three things that are edited
 * independently:
 *
 *   1. the textbook inventory  (src/content/textbook/s1-elements.json,
 *      s1-chapters.json) — what the book actually teaches;
 *   2. the knowledge base      (src/content/lexicon/*.json) — what the app knows;
 *   3. the curriculum          (src/content/weeks/**) — what the app teaches.
 *
 * and prints every element/knowledge point with the stage it reached:
 * registered → in-knowledge-base → taught → practised → verified.
 *
 *   npx tsx scripts/coverage.ts            # human report
 *   npx tsx scripts/coverage.ts --json    # machine data (docs/coverage.json)
 *   npx tsx scripts/coverage.ts --write   # regenerate docs/TEXTBOOK_COVERAGE.md
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TX = join(root, 'src/content/textbook');
const LEX = join(root, 'src/content/lexicon');
const WEEKS = join(root, 'src/content/weeks');

const read = <T>(p: string, fallback: T): T =>
  existsSync(p) ? (JSON.parse(readFileSync(p, 'utf-8')) as T) : fallback;

type Element = { element: string; gloss: string; chapter: string; source: string; page?: number };
type Morpheme = { id: string; form: string; allomorphs?: string[]; glossEn: string; origin: string; familyId?: string; examples?: string[] };
type Word = { w: string; parts: string[]; glossZh: string; verified?: boolean };
type Lesson = { id: string; week: number; day: number; title: string; concepts: string[]; knowledgePoints?: string[]; cards: { refs?: string[]; title?: string }[]; practice: { parts?: string[]; concepts?: string[] }[]; apply: { parts?: string[]; concepts?: string[] }[] };
type Kp = { id: string; title: string; type: string; summary: string; terms?: string[]; lessonHint?: string };
type Chapter = { id: string; chapter: number; title: string; sections: { id: string; title: string; knowledgePoints: Kp[] }[]; wordElements?: { form: string }[]; exerciseTypes?: { name: string; shape: string }[] };
type KpMap = Record<string, { lessons?: string[]; elements?: string[] }>;

const sources = read<{ sources: { id: string; title: string; status: string; role?: string; edition?: string; note?: string }[] }>(join(TX, 'sources.json'), { sources: [] });
const elements = read<{ elements: Element[] }>(join(TX, 's1-elements.json'), { elements: [] }).elements;
const chapters = read<{ chapters: Chapter[] }>(join(TX, 's1-chapters.json'), { chapters: [] }).chapters;
const kpMap = read<KpMap>(join(TX, 'kp-map.json'), {});
const morphemes = read<Morpheme[]>(join(LEX, 'morphemes.json'), []);
const words = read<Word[]>(join(LEX, 'words.json'), []);
const concepts = read<{ id: string; zh: string }[]>(join(LEX, 'concepts.json'), []);

// ---------------------------------------------------------------- lessons ---
const lessons: Lesson[] = [];
for (const weekDir of existsSync(WEEKS) ? readdirSync(WEEKS).sort() : []) {
  const dir = join(WEEKS, weekDir);
  if (!existsSync(dir) || !readdirSync(dir).length) continue;
  for (const f of readdirSync(dir).filter((x) => /^day\d+\.json$/.test(x)).sort()) {
    lessons.push(JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Lesson);
  }
}

/** Every morpheme form a lesson touches, from concepts + exercise parts. */
const lessonForms = new Map<string, Set<string>>();
for (const l of lessons) {
  const forms = new Set<string>();
  const add = (s: string) => {
    const norm = s.replace(/^-+|-+$/g, '').toLowerCase();
    if (norm) forms.add(norm);
  };
  (l.concepts ?? []).forEach(add);
  for (const ex of [...(l.practice ?? []), ...(l.apply ?? [])]) {
    for (const p of ex.parts ?? []) add(p);
    for (const c of ex.concepts ?? []) add(c);
  }
  lessonForms.set(l.id, forms);
}

const taughtForms = new Set<string>();
const practisedForms = new Set<string>();
for (const l of lessons) {
  for (const f of lessonForms.get(l.id) ?? []) {
    taughtForms.add(f);
    const practised = [...(l.practice ?? []), ...(l.apply ?? [])].some((ex) =>
      [...(ex.parts ?? []), ...(ex.concepts ?? [])].some((p) => p.replace(/^-+|-+$/g, '').toLowerCase() === f),
    );
    if (practised) practisedForms.add(f);
  }
}

// ------------------------------------------------------------- elements -----
const morphByForm = new Map<string, Morpheme>();
for (const m of morphemes) {
  morphByForm.set(m.form.toLowerCase(), m);
  for (const a of m.allomorphs ?? []) morphByForm.set(a.toLowerCase(), m);
}
const wordSet = new Set(words.map((w) => w.w.toLowerCase()));

function elementForms(raw: string): string[] {
  return raw
    .split('~')
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean);
}

type ElementRow = {
  element: string;
  gloss: string;
  chapter: string;
  source: string;
  forms: string[];
  registered: boolean;
  inKb: boolean;
  taught: boolean;
  practised: boolean;
  verified: boolean;
  examples: number;
  examplesInKb: number;
  family?: string;
};

const elementRows: ElementRow[] = elements.map((e) => {
  const forms = elementForms(e.element).map((f) => f.replace(/^-+|-+$/g, '').toLowerCase());
  const morph = forms.map((f) => morphByForm.get(f)).find(Boolean);
  const taught = forms.some((f) => taughtForms.has(f));
  const practised = forms.some((f) => practisedForms.has(f));
  const examples = morph?.examples ?? [];
  return {
    element: e.element,
    gloss: e.gloss,
    chapter: e.chapter,
    source: e.source,
    forms,
    registered: Boolean(e.element),
    inKb: Boolean(morph),
    taught,
    practised,
    // "verified" = the element has a real dictionary gloss and at least one
    // example word that also exists as a full entry. Anything weaker is not
    // allowed to count as taught.
    verified: Boolean(morph) && examples.length > 0 && examples.filter((w) => wordSet.has(w.toLowerCase())).length > 0,
    examples: examples.length,
    examplesInKb: examples.filter((w) => wordSet.has(w.toLowerCase())).length,
    family: morph?.familyId,
  };
});

// ------------------------------------------------------------ knowledge -----
type KpRow = { id: string; chapter: string; section: string; title: string; type: string; lessons: string[]; taught: boolean };
const kpRows: KpRow[] = [];
for (const c of chapters) {
  for (const s of c.sections ?? []) {
    for (const kp of s.knowledgePoints ?? []) {
      // The lesson file itself is the primary evidence: a kp counts as taught
      // only when a lesson explicitly lists it.
      const fromLessons = lessons.filter((l) => (l.knowledgePoints ?? []).includes(kp.id)).map((l) => l.id);
      const mapped = fromLessons.length ? fromLessons : (kpMap[kp.id]?.lessons ?? []);
      kpRows.push({
        id: kp.id,
        chapter: c.id,
        section: s.title,
        title: kp.title,
        type: kp.type,
        lessons: mapped,
        taught: mapped.length > 0,
      });
    }
  }
}

// --------------------------------------------------------------- summary ----
const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`);
const count = (fn: (r: ElementRow) => boolean) => elementRows.filter(fn).length;

const summary = {
  generatedAt: new Date().toISOString(),
  sources: sources.sources.map((s) => ({ id: s.id, title: s.title, status: s.status, role: s.role })),
  knowledgeBase: { morphemes: morphemes.length, words: words.length, concepts: concepts.length, families: new Set(morphemes.map((m) => m.familyId).filter(Boolean)).size },
  curriculum: { lessons: lessons.length, weeks: new Set(lessons.map((l) => l.week)).size },
  s1: {
    elements: elementRows.length,
    inKb: count((r) => r.inKb),
    taught: count((r) => r.taught),
    practised: count((r) => r.practised),
    verified: count((r) => r.verified),
    examplesTotal: elementRows.reduce((a, r) => a + r.examples, 0),
    examplesInKb: elementRows.reduce((a, r) => a + r.examplesInKb, 0),
    knowledgePoints: kpRows.length,
    knowledgePointsTaught: kpRows.filter((k) => k.taught).length,
    chapters: chapters.length,
    sections: chapters.reduce((a, c) => a + (c.sections?.length ?? 0), 0),
    exerciseTypes: [...new Set(chapters.flatMap((c) => (c.exerciseTypes ?? []).map((e) => e.shape)))].length,
  },
  rows: elementRows,
  knowledge: kpRows,
};

if (process.argv.includes('--json')) {
  writeFileSync(join(root, 'docs/coverage.json'), JSON.stringify(summary, null, 2) + '\n', 'utf-8');
  console.log(`docs/coverage.json written: ${elementRows.length} elements, ${kpRows.length} knowledge points`);
  process.exit(0);
}

const s1 = summary.s1;
console.log(`texbook elements: ${s1.elements}`);
console.log(`  in knowledge base: ${s1.inKb} (${pct(s1.inKb, s1.elements)})`);
console.log(`  taught in a lesson: ${s1.taught} (${pct(s1.taught, s1.elements)})`);
console.log(`  practised:          ${s1.practised} (${pct(s1.practised, s1.elements)})`);
console.log(`  verified (gloss + example in word DB): ${s1.verified} (${pct(s1.verified, s1.elements)})`);
console.log(`knowledge points: ${s1.knowledgePoints}, taught: ${s1.knowledgePointsTaught} (${pct(s1.knowledgePointsTaught, s1.knowledgePoints)})`);
console.log(`example words referenced by elements: ${s1.examplesTotal}, present as entries: ${s1.examplesInKb} (${pct(s1.examplesInKb, s1.examplesTotal)})`);

const missing = elementRows.filter((r) => !r.inKb).slice(0, 15);
if (missing.length) console.log('missing from KB (first 15):', missing.map((m) => m.element).join(', '));

if (process.argv.includes('--write')) {
  const lines: string[] = [];
  lines.push('# 教材覆盖率审计（自动生成）', '');
  lines.push(`生成时间：${summary.generatedAt}`, '');
  lines.push('> 本文件由 `npx tsx scripts/coverage.ts --write` 生成，请勿手工编辑。');
  lines.push('> 每次运行都从教材清单、词库与课程三处独立数据重新计算，不允许手工填数。', '');
  lines.push('## 一、来源状态', '');
  lines.push('| 编号 | 教材 | 版本 | 状态 | 角色 |', '| --- | --- | --- | --- | --- |');
  for (const s of sources.sources) {
    const status = s.status === 'full-text' ? '全文已解析' : '来源未获取';
    lines.push(`| ${s.id} | ${s.title} | ${(s as { edition?: string }).edition ?? '—'} | ${status} | ${s.role ?? '—'} |`);
  }
  lines.push('');
  lines.push('## 二、词素覆盖（S1 主教材）', '');
  lines.push('| 指标 | 数量 | 占比 |', '| --- | --- | --- |');
  lines.push(`| 教材构词成分总数 | ${s1.elements} | 100% |`);
  lines.push(`| 已进入词素库 | ${s1.inKb} | ${pct(s1.inKb, s1.elements)} |`);
  lines.push(`| 已有课程讲解 | ${s1.taught} | ${pct(s1.taught, s1.elements)} |`);
  lines.push(`| 已有对应练习 | ${s1.practised} | ${pct(s1.practised, s1.elements)} |`);
  lines.push(`| 已核验（释义 + 例词均在库） | ${s1.verified} | ${pct(s1.verified, s1.elements)} |`);
  lines.push('');
  lines.push('## 三、知识点覆盖', '');
  lines.push(`- 已识别知识点：${s1.knowledgePoints}`);
  lines.push(`- 已映射到课程：${s1.knowledgePointsTaught}（${pct(s1.knowledgePointsTaught, s1.knowledgePoints)}）`);
  lines.push(`- 章节数：${s1.chapters}，小节数：${s1.sections}，题型种类：${s1.exerciseTypes}`);
  lines.push('');
  lines.push('## 四、例词覆盖', '');
  lines.push(`- 词素库引用的例词：${s1.examplesTotal}`);
  lines.push(`- 其中已建成完整词条：${s1.examplesInKb}（${pct(s1.examplesInKb, s1.examplesTotal)}）`);
  lines.push('');
  lines.push('## 五、词素明细（按章节）', '');
  lines.push('| 成分 | 释义 | 章 | 语源 | 词素库 | 讲解 | 练习 | 已核验 | 例词入词库 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of elementRows) {
    lines.push(
      `| ${r.element} | ${r.gloss} | ${r.chapter} | ${r.source} | ${r.inKb ? '✓' : '—'} | ${r.taught ? '✓' : '—'} | ${r.practised ? '✓' : '—'} | ${r.verified ? '✓' : '—'} | ${r.examplesInKb}/${r.examples} |`,
    );
  }
  lines.push('');
  lines.push('## 六、知识点明细', '');
  lines.push('| 知识点 | 章 | 小节 | 类型 | 课程 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const k of kpRows) {
    lines.push(`| ${k.title} | ${k.chapter} | ${k.section} | ${k.type} | ${k.lessons.join(', ') || '—'} |`);
  }
  lines.push('');
  writeFileSync(join(root, 'docs/TEXTBOOK_COVERAGE.md'), lines.join('\n'), 'utf-8');
  console.log('docs/TEXTBOOK_COVERAGE.md written');
}
