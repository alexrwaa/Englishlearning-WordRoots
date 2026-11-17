/**
 * Page smoke test: every route must render its own content without runtime
 * errors, and the lexicon-driven pages must show real words rather than an
 * empty state.
 *
 *   node scripts/ui-smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const cases = [
  { path: '/#/', must: ['今日学习', '开始今天的学习'] },
  { path: '/#/course', must: ['12 周', '词素'] },
  { path: '/#/matrix', must: ['词矩阵', '词基'] },
  { path: '/#/word', must: ['词源词典'] },
  { path: '/#/word/construction', must: ['construction', '词素拆解'] },
  { path: '/#/word/hydrogen', must: ['hydrogen', 'hydro'] },
  { path: '/#/word/token', must: ['token'] },
  { path: '/#/word/localization', must: ['localization'] },
  { path: '/#/library', must: ['知识库'] },
  { path: '/#/stats', must: ['学习统计'] },
  { path: '/#/settings', must: ['设置'] },
  { path: '/#/session/w02d3', must: ['第 2 周', '学习'] },
];

let failures = 0;
for (const c of cases) {
  await page.goto(`${base}${c.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const text = await page.locator('body').innerText();
  const missing = c.must.filter((m) => !text.includes(m));
  const emptyState = /词库尚未导入|内容正在导入|正在构建中/.test(text);
  if (missing.length || emptyState) {
    failures += 1;
    console.log(`FAIL ${c.path} missing=${JSON.stringify(missing)} empty=${emptyState}`);
  } else {
    console.log(`ok   ${c.path} (${text.length} chars)`);
  }
}

if (errors.length) {
  failures += 1;
  console.log(`\n${errors.length} runtime error(s):`);
  for (const e of [...new Set(errors)].slice(0, 10)) console.log('  ' + e);
}

await browser.close();
console.log(failures === 0 ? '\n✓ all routes render' : `\n✖ ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
