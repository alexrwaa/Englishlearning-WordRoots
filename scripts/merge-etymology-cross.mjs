#!/usr/bin/env node
/**
 * Fold cross-source verification (Lewis & Short 1879) into reviews.json (0.10.0).
 *
 * The Wiktionary records in `analysis/etymology-verification/` prove that *one*
 * editorial work supports a claim. `analysis/etymology-cross/` adds a second,
 * unrelated work, which is the only thing that can lift a claim from
 * "same-work multi-entry" to "cross-source". Records are appended to the same
 * `verification.records` array so the audit can see both works at once.
 *
 *   node scripts/merge-etymology-cross.mjs --dry
 *   node scripts/merge-etymology-cross.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'analysis/etymology-cross';
const REVIEWS = 'src/content/textbook/reviews.json';
const dry = process.argv.includes('--dry');

if (!existsSync(SRC)) {
  console.log('no cross-source records yet');
  process.exit(0);
}

const reviews = JSON.parse(readFileSync(REVIEWS, 'utf8'));
const byId = new Map(reviews.entries.map((entry) => [entry.id, entry]));
const files = readdirSync(SRC).filter((f) => f.endsWith('.json'));

let appended = 0;
let skipped = 0;
const missing = [];

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
  const records = (payload.records ?? []).filter(
    (r) => r && r.url && r.quote && typeof r.supports === 'boolean' && r.line,
  );
  if (records.length === 0) {
    skipped += 1;
    continue;
  }

  const verification = (entry.verification ??= {
    claim: '',
    verdict: payload.verdict === 'supports' ? 'verified' : 'partial',
    checkedAt: records[0].fetchedAt,
    verifier: 'ety-cross',
    records: [],
  });
  const existing = new Set((verification.records ?? []).map((r) => `${r.entry}|${r.url}`));
  for (const record of records) {
    const key = `${record.headword ?? record.entry}|${record.url}`;
    if (existing.has(key)) continue;
    verification.records.push({
      word: payload.latin ?? record.headword,
      entry: record.headword ?? record.entry,
      url: record.url,
      quote: record.quote,
      etymon: payload.latin,
      supports: record.supports,
      fetchedAt: record.fetchedAt,
      work: record.work ?? 'Lewis & Short 1879',
      locator: record.line ? `line ${record.line}` : undefined,
      source: 'G2',
    });
    existing.add(key);
    appended += 1;
  }

  // The entry's sources must list the second work too, or a reader following
  // the citation trail would only find Wiktionary.
  const sources = (entry.sources ??= []);
  for (const record of records) {
    const detail = `${record.work ?? 'Lewis & Short 1879'}, s.v. ${record.headword}: ${record.url}`;
    if (!sources.some((s) => s.id === 'G2' && s.detail === detail)) {
      sources.push({ id: 'G2', detail });
    }
  }
  entry.verification = verification;
}

console.log(`cross files: ${files.length}`);
console.log(`records appended: ${appended} (skipped ${skipped})`);
if (missing.length) console.log(`no review entry for: ${missing.join(', ')}`);

if (!dry) {
  writeFileSync(REVIEWS, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
  console.log('written');
}
