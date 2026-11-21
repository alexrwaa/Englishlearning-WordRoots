#!/usr/bin/env node
/**
 * Merge independent etymology verification into the review file (0.9.0).
 *
 * `analysis/etymology-verification/*.json` holds records produced by fetching a
 * dictionary entry and quoting its etymology — the URL, the entry and the quote
 * are all stored, so anyone can re-fetch and check. This script turns each into
 * a review entry whose source carries that URL, which is what makes L7b
 * (cross-verified) different from L7a (a textbook page says so).
 *
 * Existing entries are updated in place: a morpheme keeps one review record, and
 * the verification block is attached to it rather than duplicated.
 *
 *   node scripts/merge-etymology-verification.mjs --dry
 *   node scripts/merge-etymology-verification.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERIFY = 'analysis/etymology-verification';
const REVIEWS = 'src/content/textbook/reviews.json';
const dry = process.argv.includes('--dry');

if (!existsSync(VERIFY)) {
  console.log('no verification records yet');
  process.exit(0);
}

const reviews = JSON.parse(readFileSync(REVIEWS, 'utf8'));
const byId = new Map(reviews.entries.map((entry) => [entry.id, entry]));
const files = readdirSync(VERIFY).filter((f) => f.endsWith('.json'));

let added = 0;
let updated = 0;
let rejected = 0;

for (const file of files) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(join(VERIFY, file), 'utf8'));
  } catch {
    rejected += 1;
    continue;
  }
  const id = payload.morphemeId;
  const records = (payload.records ?? []).filter(
    (record) => record && record.url && record.quote && typeof record.supports === 'boolean',
  );
  if (!id || records.length === 0) {
    rejected += 1;
    continue;
  }

  // One locatable citation per distinct entry, so a reader can re-fetch each.
  const sources = records.map((record) => ({
    id: record.source ?? 'S5',
    detail: `${record.name ?? 'Wiktionary'}, s.v. ${record.entry}: ${record.url}`,
  }));
  const verification = {
    claim: payload.claim ?? '',
    verdict: payload.verdict ?? 'partial',
    checkedAt: records[0].fetchedAt,
    verifier: payload.verifier ?? 'ety-verify',
    records: records.map((record) => ({
      word: record.word,
      entry: record.entry,
      url: record.url,
      quote: record.quote,
      etymon: record.etymon,
      supports: record.supports,
      fetchedAt: record.fetchedAt,
    })),
  };

  const existing = byId.get(id);
  if (existing) {
    // Keep the textbook citation: the point of L7b is textbook *and* dictionary,
    // so replacing the S1 page reference would destroy the very evidence the
    // cross-check is supposed to stand beside.
    const merged = [...(existing.sources ?? [])];
    for (const source of sources) {
      if (!merged.some((s) => s.id === source.id && s.detail === source.detail)) merged.push(source);
    }
    existing.sources = merged;
    existing.kinds = [...new Set([...(existing.kinds ?? []), 'etymology'])];
    existing.verification = verification;
    existing.reviewer = verification.verifier;
    updated += 1;
  } else {
    const entry = {
      id,
      note: payload.note ?? `独立核验：${verification.claim}`,
      kinds: ['etymology'],
      sources,
      reviewer: verification.verifier,
      at: verification.checkedAt,
      verification,
    };
    reviews.entries.push(entry);
    byId.set(id, entry);
    added += 1;
  }
}

reviews.entries.sort((a, b) => a.id.localeCompare(b.id));

console.log(`verification files: ${files.length}`);
console.log(`review entries: ${reviews.entries.length} (added ${added}, updated ${updated}, skipped ${rejected})`);
const verified = reviews.entries.filter((entry) => entry.verification?.verdict === 'verified').length;
console.log(`independent verification: verdict=verified ${verified}`);

if (!dry) {
  writeFileSync(REVIEWS, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
  console.log('written');
}
