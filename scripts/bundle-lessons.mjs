#!/usr/bin/env node
/**
 * Bundle lesson JSON into one lazily-loaded file.
 *
 * The course is ~230 files. Loading them through a lazy `import.meta.glob`
 * emits 230 chunks — one HTTP request (or file read) each, which is worse than
 * the bytes it saves. This bundles them into `src/content/lessons-bundle.json`,
 * a single chunk the app imports after the shell paints.
 *
 * The file is generated but committed, so `npm test` and a fresh clone work
 * without a build step. `--check` fails when the bundle is stale.
 *
 *   node scripts/bundle-lessons.mjs          # write
 *   node scripts/bundle-lessons.mjs --check  # verify freshness
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WEEKS = 'src/content/weeks';
const OUT = 'src/content/lessons-bundle.json';

const weekDirs = existsSync(WEEKS)
  ? readdirSync(WEEKS)
      .filter((dir) => /^week\d+$/.test(dir))
      .sort()
  : [];

const hash = createHash('sha256');
const weeks = [];

for (const dir of weekDirs) {
  const path = join(WEEKS, dir);
  const files = readdirSync(path).filter((f) => /^(meta|day\d+)\.json$/.test(f)).sort();
  let meta = null;
  const lessons = [];
  for (const file of files) {
    const raw = readFileSync(join(path, file), 'utf8');
    hash.update(raw);
    const parsed = JSON.parse(raw);
    if (file === 'meta.json') meta = parsed;
    else lessons.push(parsed);
  }
  if (!meta) continue;
  lessons.sort((a, b) => a.day - b.day);
  weeks.push({ week: meta.week, theme: meta.theme, intro: meta.intro, lessons });
}

const contentHash = hash.digest('hex').slice(0, 16);
const bundle = { contentHash, weekCount: weeks.length, lessonCount: weeks.reduce((n, w) => n + w.lessons.length, 0), weeks };

if (process.argv.includes('--check')) {
  if (!existsSync(OUT)) {
    console.error('lessons-bundle.json missing: run node scripts/bundle-lessons.mjs');
    process.exit(1);
  }
  const current = JSON.parse(readFileSync(OUT, 'utf8'));
  if (current.contentHash !== contentHash) {
    console.error(`lessons-bundle.json is stale (${current.contentHash} != ${contentHash}): run node scripts/bundle-lessons.mjs`);
    process.exit(1);
  }
  console.log(`lessons bundle ok: ${bundle.weekCount} weeks, ${bundle.lessonCount} lessons (${contentHash})`);
  process.exit(0);
}

writeFileSync(OUT, `${JSON.stringify(bundle)}\n`, 'utf8');
const size = (readFileSync(OUT).length / 1024 / 1024).toFixed(2);
console.log(`lessons-bundle.json written: ${bundle.weekCount} weeks, ${bundle.lessonCount} lessons, ${size} MB, hash ${contentHash}`);
