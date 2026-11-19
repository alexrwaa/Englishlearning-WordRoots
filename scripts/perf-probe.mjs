/**
 * Cold-start probe for the web bundle.
 *
 * The Windows app's cold start is what users feel, but a large part of it is
 * the frontend bundle: eager JSON, index building, first render. This probe
 * measures the bundle side with a throwaway browser profile, so the number is
 * comparable across commits.
 *
 *   npm run build && node scripts/perf-probe.mjs [url] [distDir]
 *
 * Reports: initial-JS bytes (entry + modulepreloads), total dist size, FCP,
 * DOMContentLoaded, time until the first nav item is visible (what a user would
 * call "it opened"), the in-app trace from `window.__wrPerf`
 * (`boot → content-ready → first-route-render`), the real `#/matrix` mount time
 * (which includes the lazy lexicon chunk), and the JS heap.
 *
 * `distDir` defaults to `dist`; pass a second build's folder to compare two
 * builds without swapping the working tree.
 */
import { chromium } from 'playwright-core';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const distDir = process.argv[3] ?? 'dist';

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}

function fileKB(rel) {
  try {
    return Math.round(statSync(join(distDir, rel)).size / 1024);
  } catch {
    return 0;
  }
}

const distBytes = dirSize(distDir);
const assets = readdirSync(join(distDir, 'assets'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .map((f) => ({ f, kb: Math.round(statSync(join(distDir, 'assets', f)).size / 1024) }))
  .sort((a, b) => b.kb - a.kb);

/**
 * What the browser must download *before* the first route can paint: the entry
 * module plus every `<link rel="modulepreload">` in index.html. Lazy chunks are
 * deliberately excluded — that is the number this work is trying to shrink.
 */
const html = readFileSync(join(distDir, 'index.html'), 'utf8');
const initialScripts = new Set();
for (const m of html.matchAll(/<script[^>]+src="\.\/(assets\/[^"]+)"/g)) initialScripts.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\.\/(assets\/[^"]+)"/g)) {
  initialScripts.add(m[1]);
}
const initialJs = [...initialScripts].map((rel) => ({ f: rel.replace('assets/', ''), kb: fileKB(rel) }));
const initialJsKB = initialJs.reduce((n, x) => n + x.kb, 0);

const profile = mkdtempSync(join(tmpdir(), 'wr-perf-'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  userDataDir: profile,
});
const page = await context.newPage();

const perfOf = () =>
  page.evaluate(() => (window.__wrPerf ? window.__wrPerf.snapshot() : null));

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
const domContentLoaded = Date.now() - t0;

await page.waitForSelector('.nav-item', { timeout: 75_000 });
const firstNav = Date.now() - t0;

await page.waitForLoadState('load');
const load = Date.now() - t0;

const paints = await page.evaluate(() => {
  const out = {};
  for (const e of performance.getEntriesByType('paint')) out[e.name] = Math.round(e.startTime);
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav) {
    out.responseEnd = Math.round(nav.responseEnd);
    out.domInteractive = Math.round(nav.domInteractive);
  }
  return out;
});
const coldPerf = await perfOf();

// Second navigation in the same profile = warm start (caches + parsed modules).
const warm0 = Date.now();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.nav-item', { timeout: 75_000 });
const warm = Date.now() - warm0;
const warmPerf = await perfOf();

// Lab page: the heaviest route. `.lab-picker` only exists after the route
// module *and* the lazy lexicon chunk are ready, so this is the honest cost of
// lazy loading. `labNavMs` stops at the shell, which is not a route measurement.
const lab0 = Date.now();
await page.goto(`${new URL(url).origin}/#/matrix`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.nav-item', { timeout: 75_000 });
const labNav = Date.now() - lab0;
await page.waitForSelector('.lab-picker', { timeout: 75_000 });
const labMount = Date.now() - lab0;
const labPerf = await perfOf();

const mem = await page.evaluate(() => {
  const m = performance.memory;
  return m ? { usedHeapMB: Math.round(m.usedJSHeapSize / 1048576) } : null;
});

console.log(
  JSON.stringify(
    {
      distKB: Math.round(distBytes / 1024),
      initialJsKB,
      initialJs,
      biggestAssets: assets.slice(0, 6),
      cold: {
        firstNavMs: firstNav,
        domContentLoadedMs: domContentLoaded,
        loadMs: load,
        paints,
        perf: coldPerf,
      },
      warmFirstNavMs: warm,
      warmPerf,
      lab: { navMs: labNav, mountMs: labMount, perf: labPerf },
      /** @deprecated kept for older reports: nav-only, not the lab mount. */
      labFirstNavMs: labNav,
      memory: mem,
    },
    null,
    2,
  ),
);

await browser.close();
