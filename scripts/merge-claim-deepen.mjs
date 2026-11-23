#!/usr/bin/env node
/**
 * Fold claim-level deep evidence into reviews.json (0.11.x).
 *
 * `analysis/claim-deepen/` 里每条记录都带 claimType（borrowing-path /
 * modern-structure），是词典对一个**具体主张**的原文引用，不是「这个词根存在」
 * 的同义反复。这里把它们并进 `verification.records`，与既有 root-sense 记录
 * 共存；`normalize-verification.mjs` 随后会按 claimType 重新汇总 claims。
 *
 * 幂等键：claimType + headword + url。同一 URL 的同一主张只追加一次。
 *
 *   node scripts/merge-claim-deepen.mjs --dry
 *   node scripts/merge-claim-deepen.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'analysis/claim-deepen';
const REVIEWS = 'src/content/textbook/reviews.json';
const ALLOWED = new Set(['borrowing-path', 'modern-structure']);
const dry = process.argv.includes('--dry');

if (!existsSync(SRC)) {
  console.log('no claim-deepen records yet');
  process.exit(0);
}

const reviews = JSON.parse(readFileSync(REVIEWS, 'utf8'));
const byId = new Map(reviews.entries.map((entry) => [entry.id, entry]));
const files = readdirSync(SRC)
  .filter((f) => f.endsWith('.json'))
  .sort();

let appended = 0;
let skipped = 0;
const missing = [];
const badType = [];

for (const file of files) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
  } catch {
    skipped += 1;
    continue;
  }
  const entry = byId.get(payload.morphemeId);
  if (!entry) {
    missing.push(payload.morphemeId);
    skipped += 1;
    continue;
  }

  const verification = (entry.verification ??= {
    claim: '',
    verdict: 'partial',
    checkedAt: '2026-11-22',
    verifier: 'claim-deepen',
    records: [],
  });
  verification.records ??= [];
  const existing = new Set(
    verification.records.map((r) => `${r.claimType ?? ''}|${r.entry ?? r.word ?? ''}|${r.url ?? ''}`),
  );

  let added = 0;
  for (const claim of payload.claims ?? []) {
    if (!ALLOWED.has(claim.type)) {
      badType.push(`${payload.morphemeId}:${claim.type}`);
      continue;
    }
    for (const record of claim.records ?? []) {
      if (!record.url || !record.quote || typeof record.supports !== 'boolean') continue;
      const key = `${claim.type}|${record.headword}|${record.url}`;
      if (existing.has(key)) continue;
      verification.records.push({
        word: record.headword,
        entry: record.headword,
        url: record.url,
        quote: record.quote,
        supports: record.supports,
        direct: record.direct,
        fetchedAt: record.fetchedAt,
        work: record.work,
        locator: record.locator,
        source: record.source,
        claimType: claim.type,
        revision: record.revision,
        tz: record.tz ?? 'Asia/Shanghai',
        note: record.note,
        claim: claim.claim,
      });
      existing.add(key);
      added += 1;
      appended += 1;
    }
  }

  if (added === 0) {
    skipped += 1;
    continue;
  }

  // 引用链要能顺着 sources 走：没有 S5+URL 的条目补一条。
  const sources = (entry.sources ??= []);
  const firstRecord = payload.claims.flatMap((c) => c.records)[0];
  const detail = `Wiktionary (English), s.v. ${firstRecord.headword}: ${firstRecord.url}`;
  if (!sources.some((s) => s.id === 'S5' && /wiktionary/i.test(s.detail ?? ''))) {
    sources.push({ id: 'S5', detail });
  }
}

console.log(`claim-deepen files: ${files.length}`);
console.log(`records appended: ${appended} (files skipped/unchanged ${skipped})`);
if (missing.length) console.log(`no review entry for: ${missing.join(', ')}`);
if (badType.length) {
  console.error(`unsupported claim types: ${badType.join(', ')}`);
  process.exit(1);
}

if (!dry) {
  writeFileSync(REVIEWS, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
  console.log('written');
}
