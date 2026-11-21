#!/usr/bin/env node
/**
 * Keep the documented word-status numbers in sync with the lexicon.
 *
 * docs/WORD_STATUS.md used to carry hand-typed counts, and they drifted from the
 * release notes within a day. This script owns one block of that file, computes
 * it from the shipped JSON, and fails CI when the block is stale.
 *
 *   node scripts/word-status-report.mjs           # rewrite the block
 *   node scripts/word-status-report.mjs --check   # exit 1 when out of date
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const WORDS = 'src/content/lexicon/words.json';
const DOC = 'docs/WORD_STATUS.md';
const START = '<!-- status:begin -->';
const END = '<!-- status:end -->';

const words = JSON.parse(readFileSync(WORDS, 'utf8'));
const count = (fn) => words.filter(fn).length;
const seg = (value) => count((w) => w.analysis?.segmentation === value);
const ety = (value) => count((w) => w.analysis?.etymology?.status === value);

const unresolvedParts = [];
for (const word of words) {
  for (const gap of word.analysis?.unresolved ?? []) {
    if (gap.reason === 'unresolved') unresolvedParts.push(gap.part);
  }
}
const topGaps = Object.entries(
  unresolvedParts.reduce((acc, part) => ((acc[part] = (acc[part] ?? 0) + 1), acc), {}),
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([part, n]) => `${part}（${n}）`)
  .join('、');

const block = [
  START,
  '',
  `| 项目 | 数量 |`,
  `| --- | --- |`,
  `| 词条 | ${words.length} |`,
  `| segmentation = verified | ${seg('verified')} |`,
  `| segmentation = partial | ${seg('partial')} |`,
  `| segmentation = unverified | ${seg('unverified')} |`,
  `| etymology documented | ${ety('documented')} |`,
  `| etymology inferred | ${ety('inferred')} |`,
  `| etymology disputed | ${ety('disputed')} |`,
  `| etymology unknown | ${ety('unknown')} |`,
  `| quizSafe | ${count((w) => w.analysis?.quizSafe)} |`,
  `| legacy \`verified\` | ${count((w) => w.verified)} |`,
  '',
  `剩余未解析成分按出现次数：${topGaps || '（无）'}。`,
  '',
  '> 以上数字由 `node scripts/word-status-report.mjs` 从 `words.json` 计算，',
  '> CI 会跑 `--check`，文档与数据不一致时构建失败。',
  '',
  END,
].join('\n');

const source = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
let next;
if (source.includes(START) && source.includes(END)) {
  next = source.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
} else {
  next = source ? `${source.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

if (process.argv.includes('--check')) {
  if (next !== source) {
    console.error('docs/WORD_STATUS.md is stale: run node scripts/word-status-report.mjs');
    process.exit(1);
  }
  console.log('word status doc is current');
  process.exit(0);
}

if (next !== source) {
  writeFileSync(DOC, next, 'utf8');
  console.log('docs/WORD_STATUS.md status block updated');
} else {
  console.log('docs/WORD_STATUS.md already current');
}
