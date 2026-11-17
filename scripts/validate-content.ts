/**
 * Course content validator.
 *
 * Runs in CI on every push. Catches the failure modes that matter for a
 * learning product: broken references, impossible answer keys, duplicate ids,
 * thin or placeholder content, and lessons that would take more than the
 * advertised 25 minutes to read.
 *
 * Usage:
 *   npx tsx scripts/validate-content.ts           # errors only
 *   STRICT=1 npx tsx scripts/validate-content.ts  # require all 12 weeks / 84 lessons
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'content');
const WEEKS_DIR = join(ROOT, 'weeks');
const LEX_DIR = join(ROOT, 'lexicon');

type Json = Record<string, unknown>;
const errors: string[] = [];
const warnings: string[] = [];

function fail(msg: string) {
  errors.push(msg);
}

function warn(msg: string) {
  warnings.push(msg);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const concepts: { id: string }[] = existsSync(join(LEX_DIR, 'concepts.json'))
  ? readJson<{ id: string }[]>(join(LEX_DIR, 'concepts.json'))
  : [];
const morphemes: { form: string; allomorphs?: string[] }[] = existsSync(join(LEX_DIR, 'morphemes.json'))
  ? readJson<{ form: string; allomorphs?: string[] }[]>(join(LEX_DIR, 'morphemes.json'))
  : [];
const words: { w: string; parts: string[] }[] = existsSync(join(LEX_DIR, 'words.json'))
  ? readJson<{ w: string; parts: string[] }[]>(join(LEX_DIR, 'words.json'))
  : [];

const conceptIds = new Set(concepts.map((c) => c.id));
const morphemeForms = new Set<string>();
for (const m of morphemes) {
  morphemeForms.add(m.form.replace(/^-+|-+$/g, '').toLowerCase());
  for (const a of m.allomorphs ?? []) morphemeForms.add(a.replace(/^-+|-+$/g, '').toLowerCase());
}
const wordSet = new Set(words.map((w) => w.w.toLowerCase()));

const PLACEHOLDER = /(TODO|FIXME|占位|lorem ipsum|Lorem ipsum|待补充|示例课程|xxx)/;

const weekFiles = existsSync(WEEKS_DIR)
  ? readdirSync(WEEKS_DIR).filter((f) => /^week\d{2}\.json$/.test(f)).sort()
  : [];

if (weekFiles.length === 0) {
  fail('no week files found in src/content/weeks');
}

const seenLessonIds = new Set<string>();
let lessonCount = 0;
let exerciseCount = 0;
let cardCount = 0;

for (const file of weekFiles) {
  const week = readJson<Json>(join(WEEKS_DIR, file));
  const weekNo = Number(week.week);
  if (!Number.isInteger(weekNo) || weekNo < 1 || weekNo > 12) fail(`${file}: invalid week number`);
  if (!week.theme || String(week.theme).length < 4) fail(`${file}: missing theme`);
  const lessons = (week.lessons ?? []) as Json[];
  if (lessons.length !== 7) warn(`${file}: expected 7 lessons, found ${lessons.length}`);

  lessons.forEach((lesson, idx) => {
    const where = `${file} lesson ${String(lesson.id ?? idx)}`;
    lessonCount += 1;
    const id = String(lesson.id ?? '');
    if (!/^w\d{2}d\d$/.test(id)) fail(`${where}: id must look like w03d02`);
    if (seenLessonIds.has(id)) fail(`${where}: duplicate lesson id ${id}`);
    seenLessonIds.add(id);
    if (Number(lesson.week) !== weekNo) fail(`${where}: week field mismatch`);
    if (Number(lesson.day) !== idx + 1) fail(`${where}: day should be ${idx + 1}`);

    for (const field of ['title', 'tagline'] as const) {
      if (!lesson[field] || String(lesson[field]).length < 3) fail(`${where}: missing ${field}`);
    }
    const objectives = (lesson.objectives ?? []) as string[];
    if (objectives.length < 2) fail(`${where}: needs at least 2 objectives`);
    const prereqs = (lesson.prereqs ?? []) as string[];
    const lessonIdSet = new Set<string>();
    for (const p of prereqs) {
      if (!/^w\d{2}d\d$/.test(p) && !p.startsWith('c-')) {
        fail(`${where}: prereq ${p} is neither a lesson id nor a concept id`);
      }
      lessonIdSet.add(p);
    }

    const cards = (lesson.cards ?? []) as Json[];
    cardCount += cards.length;
    if (cards.length < 3) fail(`${where}: needs at least 3 learning cards (found ${cards.length})`);
    if (cards.length > 8) warn(`${where}: ${cards.length} cards may exceed the 8-minute learn block`);
    cards.forEach((card, ci) => {
      if (!card.kind) fail(`${where} card ${ci}: missing kind`);
      if (!card.title) fail(`${where} card ${ci}: missing title`);
      const body = String(card.body ?? '');
      if (body.length < 70) fail(`${where} card ${ci}: body too thin (${body.length} chars)`);
      if (PLACEHOLDER.test(body)) fail(`${where} card ${ci}: contains placeholder text`);
      if (card.kind === 'matrix') {
        const cells = (card.words ?? []) as Json[];
        if (cells.length < 4) warn(`${where} card ${ci}: matrix needs at least 4 attested words`);
        for (const cell of cells) {
          const w = String(cell.w ?? '').toLowerCase();
          const parts = (cell.parts ?? []) as string[];
          if (!w || parts.length < 2) fail(`${where} card ${ci}: matrix word ${w} needs >= 2 parts`);
          if (wordSet.size > 0 && !wordSet.has(w)) {
            warn(`${where} card ${ci}: matrix word "${w}" missing from lexicon/words.json`);
          }
        }
      }
      if (card.kind === 'sum') {
        const sums = (card.sums ?? []) as Json[];
        if (sums.length < 2) warn(`${where} card ${ci}: word-sum card should show >= 2 sums`);
        for (const s of sums) {
          const parts = (s.parts ?? []) as string[];
          if (parts.length < 2) fail(`${where} card ${ci}: sum needs >= 2 parts`);
          if (!s.result) fail(`${where} card ${ci}: sum missing result`);
        }
      }
    });

    const practice = (lesson.practice ?? []) as Json[];
    const apply = (lesson.apply ?? []) as Json[];
    if (practice.length < 4) fail(`${where}: needs >= 4 practice exercises (found ${practice.length})`);
    if (apply.length < 1) fail(`${where}: needs >= 1 inference/apply exercise`);

    const ids = new Set<string>();
    for (const ex of [...practice, ...apply]) {
      exerciseCount += 1;
      const eid = String(ex.id ?? '');
      const at = `${where} exercise ${eid}`;
      if (!eid) fail(`${at}: missing id`);
      if (ids.has(eid)) fail(`${at}: duplicate exercise id`);
      ids.add(eid);
      if (!ex.prompt || String(ex.prompt).length < 4) fail(`${at}: missing prompt`);
      if (!ex.explain || String(ex.explain).length < 12) fail(`${at}: missing explanation`);
      if (PLACEHOLDER.test(JSON.stringify(ex))) fail(`${at}: contains placeholder text`);
      const conceptsRef = (ex.concepts ?? []) as string[];
      for (const ref of conceptsRef) {
        if (!conceptIds.has(ref) && !morphemeForms.has(ref.replace(/^-+|-+$/g, '').toLowerCase())) {
          fail(`${at}: unknown concept/morpheme reference "${ref}"`);
        }
      }
      switch (ex.kind) {
        case 'mcq':
        case 'infer': {
          const choices = (ex.choices ?? []) as string[];
          const answer = Number(ex.answer);
          if (choices.length < 3) fail(`${at}: needs >= 3 choices`);
          if (!Number.isInteger(answer) || answer < 0 || answer >= choices.length) {
            fail(`${at}: answer index out of range`);
          }
          if (new Set(choices.map((c) => c.trim().toLowerCase())).size !== choices.length) {
            fail(`${at}: duplicate choices`);
          }
          if (ex.kind === 'infer') {
            const passage = String(ex.passage ?? '');
            if (passage.length < 40) fail(`${at}: inference passage too short`);
            const word = String(ex.word ?? '');
            if (!word) fail(`${at}: inference exercise missing target word`);
            if (word && !passage.toLowerCase().includes(word.toLowerCase())) {
              fail(`${at}: target word "${word}" does not appear in the passage`);
            }
            if (!ex.strategy) fail(`${at}: inference exercise needs a strategy note`);
          }
          break;
        }
        case 'cloze': {
          const sentence = String(ex.sentence ?? '');
          if (!sentence.includes('___')) fail(`${at}: cloze sentence must contain ___`);
          if (!ex.answer) fail(`${at}: cloze missing answer`);
          break;
        }
        case 'wordSum': {
          const parts = (ex.parts ?? []) as string[];
          if (parts.length < 2) fail(`${at}: word sum needs >= 2 parts`);
          if (!ex.answer) fail(`${at}: word sum missing answer`);
          break;
        }
        case 'matrix': {
          if (!ex.base) fail(`${at}: matrix exercise missing base`);
          if (!ex.answer) fail(`${at}: matrix exercise missing answer`);
          if (!ex.prefix && !ex.suffix) fail(`${at}: matrix exercise needs a prefix or suffix`);
          break;
        }
        default:
          fail(`${at}: unknown exercise kind ${String(ex.kind)}`);
      }
    }

    const sources = (lesson.sources ?? []) as Json[];
    if (sources.length === 0) fail(`${where}: needs at least one source reference`);
    for (const s of sources) {
      if (!['S1', 'S2', 'S3', 'S4', 'S5'].includes(String(s.id))) {
        fail(`${where}: source id ${String(s.id)} must be S1..S5`);
      }
      if (!s.title) fail(`${where}: source missing title`);
    }

    const minutes = (lesson.minutes ?? {}) as Record<string, number>;
    const total = (minutes.review ?? 0) + (minutes.learn ?? 0) + (minutes.practice ?? 0) + (minutes.apply ?? 0);
    if (total < 15 || total > 35) fail(`${where}: total minutes ${total} outside 15-35`);
  });
}

const strict = process.env.STRICT === '1' || process.env.STRICT === 'true';
if (strict) {
  if (weekFiles.length < 12) fail(`strict: expected 12 week files, found ${weekFiles.length}`);
  if (lessonCount < 84) fail(`strict: expected 84 lessons, found ${lessonCount}`);
}

const summary = [
  `weeks: ${weekFiles.length}`,
  `lessons: ${lessonCount}`,
  `cards: ${cardCount}`,
  `exercises: ${exerciseCount}`,
  `morphemes: ${morphemes.length}`,
  `words: ${words.length}`,
  `concepts: ${concepts.length}`,
].join(' · ');

console.log(summary);
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning(s)`);
  for (const w of warnings.slice(0, 60)) console.log(`  - ${w}`);
  if (warnings.length > 60) console.log(`  ... ${warnings.length - 60} more`);
}
if (errors.length) {
  console.error(`\n✖ ${errors.length} error(s)`);
  for (const e of errors.slice(0, 80)) console.error(`  - ${e}`);
  if (errors.length > 80) console.error(`  ... ${errors.length - 80} more`);
  process.exit(1);
}
console.log('\n✓ content valid');
