#!/usr/bin/env node
/**
 * Review audit (0.8.0).
 *
 * The 0.7.0 review file cited S1 for all 208 entries, with a page number copied
 * from a lookup. That is not verification: a citation is only evidence if the
 * page it names actually contains the element it claims. This script checks
 * exactly that, and classifies every entry by what actually stands behind it:
 *
 *   textbook    S1–S4 (the book says so)
 *   dictionary  S5 / G1 (a dictionary entry, ideally with a located detail)
 *   rule        LEX (derived by a project rule, not a linguistic source)
 *   review      a named reviewer checked it
 *
 * L7 keeps two calibers so a definition change cannot look like progress:
 *   L7a (0.7.0)  a review record with at least one source id
 *   L7b (0.8.0)  the cited page matches the element AND two different support
 *                kinds stand behind it (e.g. textbook + dictionary)
 *
 *   node scripts/audit-reviews.mjs          # report
 *   node scripts/audit-reviews.mjs --write  # docs/REVIEW_AUDIT.md + json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REVIEWS = 'src/content/textbook/reviews.json';
const ELEMENTS = 'src/content/textbook/s1-elements.json';
const MORPHEMES = 'src/content/lexicon/morphemes.json';

const reviews = JSON.parse(readFileSync(REVIEWS, 'utf8'));
const elements = JSON.parse(readFileSync(ELEMENTS, 'utf8')).elements ?? [];
const morphemes = new Map(JSON.parse(readFileSync(MORPHEMES, 'utf8')).map((m) => [m.id, m]));

const TEXTBOOK = new Set(['S1', 'S2', 'S3', 'S4']);

const norm = (f) => String(f ?? '').trim().toLowerCase().replace(/^-+|-+$/g, '');

/** element rows keyed by every spelling they list */
const byForm = new Map();
for (const el of elements) {
  const forms = el.forms ?? [String(el.element ?? '').split('~')[0]];
  for (const form of forms) {
    const key = norm(form);
    if (!key) continue;
    if (!byForm.has(key)) byForm.set(key, []);
    byForm.get(key).push(el);
  }
}

const rows = reviews.entries.map((entry) => {
  const morpheme = morphemes.get(entry.id);
  const sources = entry.sources ?? [];
  const kinds = new Set();
  for (const s of sources) {
    if (TEXTBOOK.has(s.id)) kinds.add('textbook');
    else if (s.id === 'LEX') kinds.add('rule');
    else if (s.id === 'S5' || s.id === 'G1') kinds.add('dictionary');
  }
  if (entry.reviewer) kinds.add('review');

  // Does the cited page exist and contain this element?
  let pageCheck = 'no-citation';
  let citedPage = null;
  const detail = sources.map((s) => s.detail ?? '').join(' ');
  const pageMatch = /p\.(\d+)/.exec(detail);
  if (pageMatch) {
    citedPage = Number(pageMatch[1]);
    const rowsForForm = morpheme ? byForm.get(norm(morpheme.form)) ?? [] : [];
    const atPage = rowsForForm.filter((el) => Number(el.page) === citedPage);
    if (rowsForForm.length === 0) pageCheck = 'form-not-in-appendix';
    else if (atPage.length === 0) pageCheck = 'page-mismatch';
    else pageCheck = 'page-matches';
  } else if (sources.length > 0) {
    pageCheck = 'unlocated';
  }

  const located = sources.some((s) => (s.detail ?? '').trim().length >= 4);
  const l7a = located; // 0.7.0 caliber
  // 0.8.0: a textbook page proves the book says it; cross-verification needs a
  // second, independent kind of source (dictionary). A reviewer signature is not
  // a source, so it does not count here.
  const l7b = pageCheck === 'page-matches' && kinds.has('dictionary');

  return {
    id: entry.id,
    form: morpheme?.form ?? null,
    kinds: [...kinds],
    citedPage,
    pageCheck,
    l7a,
    l7b,
  };
});

const count = (key) => rows.filter((r) => r[key]).length;
const pageStats = rows.reduce((acc, r) => ((acc[r.pageCheck] = (acc[r.pageCheck] ?? 0) + 1), acc), {});
const kindStats = rows.reduce((acc, r) => {
  for (const k of r.kinds) acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log(`review entries: ${rows.length}`);
console.log(`page check: ${JSON.stringify(pageStats)}`);
console.log(`support kinds: ${JSON.stringify(kindStats)}`);
console.log(`L7a (0.7.0: has a located source): ${count('l7a')}`);
console.log(`L7b (0.8.0: page matches + 2 support kinds): ${count('l7b')}`);

const mismatches = rows.filter((r) => r.pageCheck === 'page-mismatch' || r.pageCheck === 'form-not-in-appendix');
if (mismatches.length) {
  console.log(`citations that do not hold up: ${mismatches.length}`);
  for (const r of mismatches.slice(0, 8)) console.log(`  ${r.id} (${r.form}) page ${r.citedPage} → ${r.pageCheck}`);
}

if (process.argv.includes('--write')) {
  const lines = [
    '# 审校证据核查（0.8.0）',
    '',
    `- 审校条目：${rows.length}`,
    `- L7a（0.7.0 口径：有一个可定位来源）：${count('l7a')}`,
    `- L7b（0.8.0 口径：引用页码真的含该成分 **且** 至少两类支撑）：${count('l7b')}`,
    '',
    '## 页码核查',
    '',
    '| 结果 | 条数 | 含义 |',
    '| --- | --- | --- |',
    `| page-matches | ${pageStats['page-matches'] ?? 0} | 引用页在教材成分表里确有该成分 |`,
    `| page-mismatch | ${pageStats['page-mismatch'] ?? 0} | 引用了页，但该成分不在那一页 |`,
    `| form-not-in-appendix | ${pageStats['form-not-in-appendix'] ?? 0} | 成分表里根本没有这个拼写 |`,
    `| unlocated | ${pageStats.unlocated ?? 0} | 有来源但没有可定位的条目/页 |`,
    `| no-citation | ${pageStats['no-citation'] ?? 0} | 没有来源 |`,
    '',
    '## 支撑类型',
    '',
    '| 类型 | 条数 | 含义 |',
    '| --- | --- | --- |',
    `| textbook | ${kindStats.textbook ?? 0} | 教材支持 |`,
    `| dictionary | ${kindStats.dictionary ?? 0} | 词典支持（S5/G1） |`,
    `| rule | ${kindStats.rule ?? 0} | 项目规则推导（LEX），不是语言学证据 |`,
    `| review | ${kindStats.review ?? 0} | 有署名校审人 |`,
    '',
    '> L7b 要求"页码对得上 + 至少两类支撑"。只引教材的条目**不算**通过交叉核验，',
    '> 这是 0.8.0 与 0.7.0 最大的口径差异，两个数字并列给出，避免统计定义变化被读成进步。',
    '',
  ];
  writeFileSync('docs/REVIEW_AUDIT.md', `${lines.join('\n')}\n`, 'utf8');
  if (existsSync('docs')) writeFileSync('docs/review-audit.json', `${JSON.stringify({ rows, pageStats, kindStats }, null, 2)}\n`, 'utf8');
  console.log('docs/REVIEW_AUDIT.md written');
}
