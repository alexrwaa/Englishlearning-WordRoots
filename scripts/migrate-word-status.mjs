#!/usr/bin/env node
/**
 * Word status migration (0.8.0).
 *
 * `verified: true` used to mean "the split and the etymology both look right",
 * which conflated four different questions and quietly claimed more than the
 * data supported: 101 verified words had a part with no morpheme ID, and 330
 * citations were a bare "S5" with nothing locatable behind them.
 *
 * This script derives an explicit `analysis` block per word and recomputes the
 * legacy flag from it, so nothing downstream has to guess:
 *
 *   lexical       the word exists in English
 *   analyzable    a speaker can decompose it today
 *   segmentation  verified | partial | unverified | none
 *   unresolved[]  every part without an ID, and *why* (free base, orthographic,
 *                 or a record we are missing)
 *   etymology     documented | inferred | disputed | unknown, with sources
 *   contested[]   competing scholarly views, each with evidence and confidence
 *   quizSafe      safe to grade automatically (structure is verified)
 *
 * Legacy `verified` becomes: segmentation === 'verified' && etymology is not
 * 'unknown'. That lowers the count on purpose — see docs/WORD_STATUS.md.
 *
 *   node scripts/migrate-word-status.mjs            # write
 *   node scripts/migrate-word-status.mjs --dry      # report only
 *   node scripts/migrate-word-status.mjs --check    # exit 1 if any word would change
 */
import { readFileSync, writeFileSync } from 'node:fs';

const WORDS = 'src/content/lexicon/words.json';
const SOURCES = 'src/content/textbook/sources.json';

const dry = process.argv.includes('--dry');
const check = process.argv.includes('--check');

const words = JSON.parse(readFileSync(WORDS, 'utf8'));
const sourceIds = new Set(JSON.parse(readFileSync(SOURCES, 'utf8')).sources.map((s) => s.id));

/** Silent letters and linking vowels: real orthography, not missing morphemes. */
const ORTHOGRAPHIC = new Set(['e', 'o', 'i', 'u', 'y', 'a', 'ae', 'oe', 'ue']);

const wordForms = new Set(words.map((w) => w.w.toLowerCase()));

/** Normalise `sources` to objects and record whether a citation is locatable. */
function normaliseSources(raw) {
  const list = [];
  for (const item of raw ?? []) {
    const entry = typeof item === 'string' ? { id: item } : { id: item?.id, detail: item?.detail };
    if (!entry.id) continue;
    list.push({ id: entry.id, ...(entry.detail ? { detail: entry.detail } : {}) });
  }
  return list;
}

const located = (sources) => sources.some((s) => sourceIds.has(s.id) && typeof s.detail === 'string' && s.detail.trim().length >= 4);

function classifyUnresolved(parts, ids) {
  const out = [];
  parts.forEach((part, index) => {
    if (ids[index]) return;
    const bare = String(part ?? '').toLowerCase().trim();
    if (!bare) return;
    let reason = 'unresolved';
    if (ORTHOGRAPHIC.has(bare)) reason = 'orthographic';
    else if (wordForms.has(bare)) reason = 'free-base';
    out.push({ part: String(part), reason });
  });
  return out;
}

let changed = 0;
const stats = { verified: 0, quizSafe: 0, seg: { verified: 0, partial: 0, unverified: 0, none: 0 }, documented: 0, inferred: 0, unknown: 0, disputed: 0 };

for (const word of words) {
  const parts = word.parts ?? [];
  const ids = word.partIds ?? [];
  const sources = normaliseSources(word.sources);
  const unresolved = classifyUnresolved(parts, ids);

  let segmentation;
  if (parts.length === 0) segmentation = 'none';
  else if (unresolved.length === 0) segmentation = 'verified';
  else if (unresolved.every((u) => u.reason === 'orthographic' || u.reason === 'free-base')) segmentation = 'verified';
  else if (unresolved.some((u) => u.reason === 'unresolved') && ids.some(Boolean)) segmentation = 'partial';
  else segmentation = 'unverified';

  const etyText = word.ety?.historical ?? word.etymology ?? '';
  const contested = (word.ety?.contested ?? []).map((c) => ({
    view: c.view,
    evidence: c.evidence,
    confidence: c.confidence ?? 'low',
  }));
  let etyStatus;
  // 'disputed' means the sources genuinely conflict. A single minority note is
  // context, not a dispute, and calling it one would overstate the uncertainty.
  if (contested.length >= 2) etyStatus = 'disputed';
  else if (etyText && located(sources)) etyStatus = 'documented';
  else if (etyText) etyStatus = 'inferred';
  else etyStatus = 'unknown';

  const lexical = word.lexical !== false;
  const analyzable = parts.length > 0 && segmentation !== 'unverified';
  const quizSafe = lexical && analyzable && segmentation === 'verified';
  // A disputed etymology does not make the *split* unverified, but the legacy
  // flag historically claimed both, so it stays false where they disagree.
  const verified = segmentation === 'verified' && etyStatus !== 'unknown' && etyStatus !== 'disputed';

  const analysis = {
    lexical,
    analyzable,
    segmentation,
    ...(unresolved.length ? { unresolved } : {}),
    etymology: { status: etyStatus, ...(sources.length ? { sources: sources.map((s) => s.id) } : {}) },
    ...(contested.length ? { contested } : {}),
    quizSafe,
  };

  const before = JSON.stringify(word.analysis ?? null);
  const after = JSON.stringify(analysis);
  if (before !== after) changed += 1;
  word.analysis = analysis;
  if (word.verified !== verified) {
    if (!dry && !check) word.verified = verified;
    changed += 0;
  }

  if (verified) stats.verified += 1;
  if (quizSafe) stats.quizSafe += 1;
  stats.seg[segmentation] += 1;
  if (etyStatus === 'documented') stats.documented += 1;
  else if (etyStatus === 'inferred') stats.inferred += 1;
  else if (etyStatus === 'disputed') stats.disputed += 1;
  else stats.unknown += 1;
}

console.log(`words: ${words.length}`);
console.log(`segmentation: verified ${stats.seg.verified} / partial ${stats.seg.partial} / unverified ${stats.seg.unverified} / none ${stats.seg.none}`);
console.log(`etymology: documented ${stats.documented} / inferred ${stats.inferred} / disputed ${stats.disputed} / unknown ${stats.unknown}`);
console.log(`quizSafe: ${stats.quizSafe}  legacy verified: ${stats.verified}`);
console.log(`records changed: ${changed}`);

if (check) {
  if (changed > 0) {
    console.error(`status drift: ${changed} word(s) would change — run node scripts/migrate-word-status.mjs`);
    process.exit(1);
  }
  process.exit(0);
}

if (!dry) {
  writeFileSync(WORDS, `${JSON.stringify(words, null, 1)}\n`, 'utf8');
  console.log('written');
}
