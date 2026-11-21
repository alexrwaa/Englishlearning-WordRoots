#!/usr/bin/env node
/**
 * Normalise verification records to claim level (0.11.0).
 *
 * A dictionary entry supporting "graph- descends from γράφω 'to write'" says
 * nothing about whether *psychology* borrowed it through Latin or Neo-Latin, nor
 * about today's productive structure. 0.10.0 reported one number per morpheme,
 * which let a root-sense check stand in for the whole family. This script tags
 * every evidence record with the claim it actually supports and records the
 * provenance fields a reader needs to re-fetch it.
 *
 * Claim types (the only allowed values):
 *   root-sense            classical root's own meaning
 *   classical-derivation  forms/derivations inside the classical language
 *   borrowing-path        the route from classical language into English
 *   modern-structure      present-day English morphological structure
 *   modern-sense          present-day English meaning and semantic change
 *
 *   node scripts/normalize-verification.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const REVIEWS = 'src/content/textbook/reviews.json';
const dry = process.argv.includes('--dry');

const CLAIM_TYPES = [
  'root-sense',
  'classical-derivation',
  'borrowing-path',
  'modern-structure',
  'modern-sense',
];

const reviews = JSON.parse(readFileSync(REVIEWS, 'utf8'));

/** Which claim does this record actually speak to? Default is the root's sense. */
function inferClaimType(record, entry) {
  if (record.claimType && CLAIM_TYPES.includes(record.claimType)) return record.claimType;
  const text = `${record.quote ?? ''} ${entry.verification?.claim ?? ''}`.toLowerCase();
  // A quote that talks about the English word's current parts is a structure
  // claim; one that talks about the route is a borrowing claim. Both are rare in
  // the current data, which is the point of counting them separately.
  if (/equivalent to|confix|prefix|suffix/.test(text)) return 'modern-structure';
  if (/entered english|through french|via latin|borrowed/.test(text)) return 'borrowing-path';
  return 'root-sense';
}

/** One canonical name per work: "Lewis & Short" arrived under three spellings. */
function workOf(record) {
  const raw = record.work ?? (record.source === 'G2' ? 'Lewis & Short 1879' : record.source === 'G3' ? 'LSJ 9th ed.' : 'Wiktionary');
  if (/lewis/i.test(raw)) return 'Lewis & Short 1879';
  if (/lsj|liddell/i.test(raw)) return 'LSJ 9th ed.';
  if (/wiktionary/i.test(raw)) return 'Wiktionary';
  return raw;
}

let changed = 0;
let claims = 0;

for (const entry of reviews.entries) {
  const verification = entry.verification;
  if (!verification?.records?.length) continue;

  for (const record of verification.records ?? []) {
    const type = inferClaimType(record, entry);
    const work = workOf(record);
    const next = {
      ...record,
      claimType: type,
      work,
      // Provenance the audit needs: where, when, in which timezone.
      tz: record.tz ?? 'Asia/Shanghai',
      source: record.source ?? (work === 'Wiktionary' ? 'S5' : work.includes('Lewis') ? 'G2' : 'G3'),
    };
    if (JSON.stringify(next) !== JSON.stringify(record)) {
      Object.assign(record, next);
      changed += 1;
    }
  }

  // Per-claim summary: a morpheme can be settled on one claim and open on four.
  const byType = new Map();
  for (const record of verification.records) {
    const list = byType.get(record.claimType) ?? [];
    list.push(record);
    byType.set(record.claimType, list);
  }
  verification.claims = CLAIM_TYPES.map((type) => {
    const records = byType.get(type) ?? [];
    const works = [...new Set(records.filter((r) => r.supports).map((r) => r.work))];
    return {
      type,
      status:
        records.length === 0
          ? 'no-evidence'
          : works.length >= 2
            ? 'cross-source'
            : records.some((r) => r.supports)
              ? 'single-work'
              : 'conflicting',
      works,
      records: records.length,
    };
  });
  claims += verification.claims.filter((c) => c.status !== 'no-evidence').length;
}

console.log(`records normalised: ${changed}`);
console.log(`claim assessments: ${claims} across ${reviews.entries.filter((e) => e.verification).length} entries`);

if (!dry) {
  writeFileSync(REVIEWS, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
  console.log('written');
}
