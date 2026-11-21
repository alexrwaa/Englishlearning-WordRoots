#!/usr/bin/env node
/**
 * Fold cross-source verification (LSJ 9th ed.) into reviews.json (0.10.0).
 *
 * The Wiktionary records in `analysis/etymology-verification/` prove that *one*
 * editorial work supports a claim. `analysis/greek-verification/` adds a second,
 * unrelated work, which is the only thing that can lift a claim from
 * "same-work multi-entry" to "cross-source". Records are appended to the same
 * `verification.records` array so the audit can see both works at once.
 *
 *   node scripts/merge-etymology-greek.mjs --dry
 *   node scripts/merge-etymology-greek.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'analysis/greek-verification';
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
  let entry = byId.get(payload.morphemeId);
  if (!entry) {
    // A Greek morpheme may have no review record yet; create one rather than
    // dropping the evidence on the floor.
    entry = {
      id: payload.morphemeId,
      note: payload.note ?? 'Greek etymology checked against LSJ.',
      kinds: ['etymology'],
      sources: [],
      reviewer: payload.verifier ?? 'greek-verify',
      at: payload.records?.[0]?.fetchedAt,
    };
    reviews.entries.push(entry);
    byId.set(entry.id, entry);
    missing.push(entry.id);
  }
  const records = (payload.records ?? []).filter(
    (r) => r && r.url && r.quote && typeof r.supports === 'boolean' && (r.locator || r.line),
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
      work: record.work ?? 'LSJ 9th ed.',
      locator: record.locator ?? (record.line ? `line ${record.line}` : undefined),
      source: 'G3',
    });
    existing.add(key);
    appended += 1;
  }

  // The entry's sources must list the second work too, or a reader following
  // the citation trail would only find Wiktionary.
  const sources = (entry.sources ??= []);
  for (const record of records) {
    const detail = `${record.work ?? 'LSJ 9th ed.'}, s.v. ${record.headword}: ${record.url}`;
    if (!sources.some((s) => s.id === 'G3' && s.detail === detail)) {
      sources.push({ id: 'G3', detail });
    }
  }
  entry.verification = verification;
}

console.log(`cross files: ${files.length}`);
console.log(`records appended: ${appended} (skipped ${skipped})`);
if (missing.length) if (missing.length) console.log(`review entries created for: ${missing.join(', ')}`);

if (!dry) {
  writeFileSync(REVIEWS, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
  console.log('written');
}
