/**
 * End-to-end walkthrough of one daily session against the built frontend.
 *
 * Purpose: prove the learning loop actually works (cards -> exercises -> apply ->
 * summary -> persisted state), and capture screenshots of a state produced by
 * real user actions rather than seeded data.
 *
 *   node scripts/e2e-session.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const shot = (name) => `docs/screenshots/${name}.png`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
const log = [];

await page.goto(`${base}/#/session/w01d1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Walk through the session, answering whatever is on screen.
for (let step = 0; step < 90; step++) {
  const visible = async (sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible());

  if (await visible('.summary, [data-testid="summary"]')) break;

  const choices = page.locator('.choice:not([disabled])');
  if ((await choices.count()) > 0 && (await choices.first().isVisible())) {
    const n = await choices.count();
    await choices.nth(step % n).click();
    await page.waitForTimeout(150);
    log.push(`step ${step}: chose option`);
  }

  const inputs = page.locator('input.input:not([disabled]), textarea.input:not([disabled])');
  if ((await inputs.count()) > 0 && (await inputs.first().isVisible())) {
    const input = inputs.first();
    if ((await input.inputValue()) === '') {
      await input.fill('happiness');
      log.push(`step ${step}: typed answer`);
    }
    await input.press('Enter');
    await page.waitForTimeout(200);
  }

  // Advance with the primary action button (下一项 / 提交 / 继续 / 下一题).
  const primary = page.locator('button.btn-primary:not([disabled])');
  if ((await primary.count()) > 0) {
    const label = (await primary.first().innerText()).trim();
    await primary.first().click();
    log.push(`step ${step}: clicked ${label}`);
    await page.waitForTimeout(260);
  } else {
    await page.waitForTimeout(250);
  }
}

await page.waitForTimeout(800);
await page.screenshot({ path: shot('10-session-summary') });

// The summary writes progress; go back home and confirm the state changed.
await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: shot('01-home') });

const bodyText = await page.locator('body').innerText();
const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('wordroots.dev.db.v1') ?? '{}';
  const db = JSON.parse(raw);
  return {
    attempts: db.attempts?.length ?? 0,
    reviews: db.reviews?.length ?? 0,
    cards: db.cards?.length ?? 0,
    lessons: db.lessonStates?.length ?? 0,
    completed: (db.lessonStates ?? []).filter((s) => s.status === 'completed').length,
  };
});

// Reload to prove the state survives a restart of the renderer.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const afterReload = await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('wordroots.dev.db.v1') ?? '{}');
  return { attempts: db.attempts?.length ?? 0, completed: (db.lessonStates ?? []).filter((s) => s.status === 'completed').length };
});

await page.goto(`${base}/#/stats`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: shot('07-stats'), fullPage: false });

console.log(JSON.stringify({ stored, afterReload, sawProgress: /已完成|继续学习|复习/.test(bodyText) }, null, 2));
console.log(log.slice(-12).join('\n'));

await browser.close();
