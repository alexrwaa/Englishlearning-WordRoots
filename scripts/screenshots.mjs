/**
 * Capture documentation screenshots from the built frontend.
 *
 * Uses the locally installed Microsoft Edge (channel: 'msedge') so no browser
 * download is needed in CI or on a fresh machine.
 *
 *   node scripts/screenshots.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const out = process.argv[3] ?? 'docs/screenshots';
mkdirSync(out, { recursive: true });

const shots = [
  { path: '/#/', name: '01-home', h: 980 },
  { path: '/#/course', name: '02-course', h: 1080 },
  { path: '/#/matrix', name: '03-matrix', h: 1080 },
  { path: '/#/word/hydrogen', name: '04-word-etymology', h: 1080 },
  { path: '/#/library', name: '05-library', h: 980 },
  { path: '/#/session/w01d1', name: '06-session', h: 1080 },
  { path: '/#/stats', name: '07-stats', h: 980 },
  { path: '/#/settings', name: '08-settings', h: 1080 },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

for (const shot of shots) {
  await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.setViewportSize({ width: 1440, height: shot.h });
  await page.waitForTimeout(300);
  const file = `${out}/${shot.name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log('captured', file);
}

// A single dark-theme shot to document the reading theme.
await page.goto(`${base}/#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => {
  document.documentElement.dataset.theme = 'dark';
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/09-dark-theme.png` });
console.log('captured dark theme');

await browser.close();
