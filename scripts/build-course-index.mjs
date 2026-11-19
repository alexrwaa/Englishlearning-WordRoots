#!/usr/bin/env node
/**
 * Build (and verify) the course index.
 *
 * The portable package used to be validated by counts alone ("at least 84 day
 * files"), which passes even when a week is half copied or a lesson id no longer
 * matches its folder. This script derives the *expected* structure from the
 * content itself, asserts the structure is internally consistent, and writes it
 * to `src/content/course-index.json`. Packaging then compares the copied folder
 * and the ZIP against that index — exact match, not a threshold.
 *
 *   node scripts/build-course-index.mjs            # write the index
 *   node scripts/build-course-index.mjs --check    # exit 1 if the index is stale
 *   node scripts/build-course-index.mjs --root DIR # verify a packaged folder
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? args[rootArg + 1] : '.';

const SOURCE_INDEX = 'src/content/course-index.json';
const REQUIRED_LESSON_FIELDS = [
  'id',
  'week',
  'day',
  'title',
  'tagline',
  'objectives',
  'concepts',
  'knowledgePoints',
  'minutes',
  'level',
  'cards',
  'practice',
  'apply',
  'sources',
];

const problems = [];
const fail = (msg) => problems.push(msg);

function readJson(path, where) {
  try {
    // Strip a BOM: the packaging script writes JSON via .NET, and JSON.parse
    // rejects a leading BOM.
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`${where}: not valid JSON (${error.message})`);
    return null;
  }
}

function verifyLesson(file, path, weekNo, dayNo) {
  const lesson = readJson(path, file);
  if (!lesson) return null;
  for (const field of REQUIRED_LESSON_FIELDS) {
    if (lesson[field] === undefined || lesson[field] === null) fail(`${file}: missing ${field}`);
  }
  const expectedId = `w${String(weekNo).padStart(2, '0')}d${dayNo}`;
  if (lesson.id !== expectedId) fail(`${file}: id is "${lesson.id}", expected "${expectedId}"`);
  if (Number(lesson.week) !== weekNo) fail(`${file}: week is ${lesson.week}, folder says ${weekNo}`);
  if (Number(lesson.day) !== dayNo) fail(`${file}: day is ${lesson.day}, filename says ${dayNo}`);

  const minutes = lesson.minutes ?? {};
  const total = ['review', 'learn', 'practice', 'apply'].reduce((sum, k) => sum + Number(minutes[k] ?? 0), 0);
  // "About 25 minutes" is the design target; the lessons themselves range 25-28.
  // Anything outside that band is either a typo or a lesson that outgrew the slot.
  if (total < 24 || total > 28) fail(`${file}: minutes add up to ${total}, expected 24-28`);

  if (!Array.isArray(lesson.cards) || lesson.cards.length < 4) fail(`${file}: fewer than 4 cards`);
  if (!Array.isArray(lesson.practice) || lesson.practice.length < 4) fail(`${file}: fewer than 4 exercises`);
  if (!Array.isArray(lesson.apply) || lesson.apply.length < 1) fail(`${file}: no apply task`);
  for (const exercise of lesson.practice ?? []) {
    if (!exercise.explain) fail(`${file}: exercise ${exercise.id ?? '?'} has no explain`);
  }
  return lesson;
}

function scan(base) {
  const weeksDir = join(base, 'src/content/weeks');
  if (!existsSync(weeksDir)) {
    fail(`missing course directory: ${weeksDir}`);
    return null;
  }
  const weekDirs = readdirSync(weeksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^week\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();

  const weeks = [];
  let lessonCount = 0;
  let cardCount = 0;
  let exerciseCount = 0;

  for (const dir of weekDirs) {
    const weekNo = Number(dir.slice(4));
    const metaPath = join(weeksDir, dir, 'meta.json');
    if (!existsSync(metaPath)) {
      fail(`${dir}: missing meta.json`);
      continue;
    }
    const meta = readJson(metaPath, `${dir}/meta.json`);
    if (!meta) continue;
    if (Number(meta.week) !== weekNo) fail(`${dir}/meta.json: week is ${meta.week}, folder says ${weekNo}`);
    if (!meta.theme || String(meta.theme).length < 4) fail(`${dir}/meta.json: theme missing or too short`);
    if (!meta.intro || String(meta.intro).length < 20) fail(`${dir}/meta.json: intro missing or too short`);

    const dayFiles = readdirSync(join(weeksDir, dir))
      .filter((f) => /^day\d\.json$/.test(f))
      .sort((a, b) => Number(a.slice(3, 4)) - Number(b.slice(3, 4)));
    // A unit may split a chapter over two uneven weeks (5+4), so 4 is allowed.
    // Contiguity and the index cross-check still catch a truncated copy.
    if (dayFiles.length < 4 || dayFiles.length > 7) {
      fail(`${dir}: ${dayFiles.length} lessons, expected 4-7`);
    }
    const expectedDays = dayFiles.map((_, i) => i + 1);
    const actualDays = dayFiles.map((f) => Number(f.slice(3, 4)));
    if (expectedDays.join(',') !== actualDays.join(',')) {
      fail(`${dir}: lesson numbers are not contiguous (${actualDays.join(',')})`);
    }
    for (const file of dayFiles) {
      const lesson = verifyLesson(`${dir}/${file}`, join(weeksDir, dir, file), weekNo, Number(file.slice(3, 4)));
      if (!lesson) continue;
      lessonCount += 1;
      cardCount += lesson.cards?.length ?? 0;
      exerciseCount += (lesson.practice?.length ?? 0) + (lesson.apply?.length ?? 0);
    }
    weeks.push({
      week: weekNo,
      theme: meta.theme,
      level: meta.level ?? '',
      days: dayFiles.map((f) => `w${String(weekNo).padStart(2, '0')}d${Number(f.slice(3, 4))}`),
    });
  }

  if (weekDirs.length === 0) fail('no week folders found');
  return { weeks, lessonCount, cardCount, exerciseCount };
}

/** A packaged copy must match the index exactly: no extra week, no missing day. */
function verifyPackage(base, index) {
  const weeksDir = join(base, 'courses/weeks');
  if (!existsSync(weeksDir)) {
    fail(`package: missing ${weeksDir}`);
    return;
  }
  const packed = readdirSync(weeksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const expectedWeeks = index.weeks.map((w) => `week${String(w.week).padStart(2, '0')}`);
  if (packed.join(',') !== expectedWeeks.join(',')) {
    fail(`package: week folders differ\n  packed:   ${packed.join(', ')}\n  expected: ${expectedWeeks.join(', ')}`);
  }
  for (const week of index.weeks) {
    const dir = join(weeksDir, `week${String(week.week).padStart(2, '0')}`);
    if (!existsSync(dir)) {
      fail(`package: missing ${dir}`);
      continue;
    }
    const packedDays = readdirSync(dir)
      .filter((f) => f.startsWith('day') && f.endsWith('.json'))
      .map((f) => Number(f.slice(3, 4)))
      .sort((a, b) => a - b);
    const expectedDays = week.days.map((id) => Number(id.slice(-1)));
    if (packedDays.join(',') !== expectedDays.join(',')) {
      fail(`package: week ${week.week} days ${packedDays.join(',')} != expected ${expectedDays.join(',')}`);
    }
  }

  // Lexicon completeness: the app cannot analyse a word without these.
  const lexDir = join(base, 'courses/lexicon');
  for (const file of ['concepts.json', 'forms.json', 'morphemes.json', 'words.json']) {
    const path = join(lexDir, file);
    if (!existsSync(path)) {
      fail(`package: missing courses/lexicon/${file}`);
      continue;
    }
    readJson(path, `courses/lexicon/${file}`);
  }

  const formsPath = join(lexDir, 'forms.json');
  const morphPath = join(lexDir, 'morphemes.json');
  if (existsSync(formsPath) && existsSync(morphPath)) {
    const forms = JSON.parse(readFileSync(formsPath, 'utf8').replace(/^\uFEFF/, ''));
    const morphemes = JSON.parse(readFileSync(morphPath, 'utf8').replace(/^\uFEFF/, ''));
    const known = new Set();
    for (const list of Object.values(forms)) for (const id of list) known.add(id);
    const orphans = morphemes.filter((m) => !known.has(m.id));
    if (orphans.length > 0) {
      fail(
        `package: ${orphans.length} morphemes have no entry in forms.json ` +
          `(e.g. ${orphans.slice(0, 3).map((m) => m.id).join(', ')})`,
      );
    }
    const ids = new Set(morphemes.map((m) => m.id));
    const dangling = [];
    for (const [form, list] of Object.entries(forms)) {
      for (const id of list) if (!ids.has(id)) dangling.push(`${form} -> ${id}`);
    }
    if (dangling.length > 0) {
      fail(`package: forms.json points at missing morphemes (e.g. ${dangling.slice(0, 3).join(', ')})`);
    }
  }

  const manifestPath = join(base, 'courses/manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
    if (Number(manifest.weekCount) !== index.weeks.length) {
      fail(`package: manifest weekCount ${manifest.weekCount} != index ${index.weeks.length}`);
    }
    if (Number(manifest.dayCount) !== index.lessonCount) {
      fail(`package: manifest dayCount ${manifest.dayCount} != index ${index.lessonCount}`);
    }
  } else {
    fail('package: missing courses/manifest.json');
  }
}

function main() {
  // Verifying a packaged folder: the expectation comes from the committed index,
  // because the package has no src/ tree to scan.
  if (root !== '.') {
    const index = readJson(SOURCE_INDEX, SOURCE_INDEX);
    if (!index) {
      report();
      return;
    }
    verifyPackage(root, index);
    report(`package matches index: ${index.weekCount} weeks, ${index.lessonCount} lessons`);
    return;
  }

  const source = scan('.');
  if (!source) {
    report();
    return;
  }

  const index = {
    $comment:
      'Generated by scripts/build-course-index.mjs. The portable package is verified against this file, so a half-copied week or a renamed lesson fails the build instead of shipping.',
    weekCount: source.weeks.length,
    lessonCount: source.lessonCount,
    cardCount: source.cardCount,
    exerciseCount: source.exerciseCount,
    weeks: source.weeks,
  };

  if (checkOnly) {
    if (!existsSync(SOURCE_INDEX)) {
      fail(`${SOURCE_INDEX} missing; run node scripts/build-course-index.mjs`);
    } else {
      const current = readJson(SOURCE_INDEX, SOURCE_INDEX);
      const same =
        current &&
        current.weekCount === index.weekCount &&
        current.lessonCount === index.lessonCount &&
        JSON.stringify(current.weeks) === JSON.stringify(index.weeks);
      if (!same) fail(`${SOURCE_INDEX} is stale; re-run node scripts/build-course-index.mjs`);
    }
  } else {
    if (problems.length === 0) {
      writeFileSync(SOURCE_INDEX, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
      console.log(`course index written: ${SOURCE_INDEX}`);
    }
  }

  report(`weeks ${index.weekCount}, lessons ${index.lessonCount}, cards ${index.cardCount}, exercises ${index.exerciseCount}`);
}

function report(summary) {
  if (problems.length > 0) {
    console.error(`course check FAILED (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  if (summary) console.log(`course check ok: ${summary}`);
}

main();
