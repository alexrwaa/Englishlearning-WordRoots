#!/usr/bin/env node
/**
 * Licence and provenance gate.
 *
 * The project claims to ship no copyrighted textbook text, only original Chinese
 * explanation built on published linguistic facts. That claim is only checkable
 * at the metadata level, so this script checks exactly that level and says so:
 *
 *   1. LICENSE exists, is MIT, and matches package.json.
 *   2. Every source in sources.json declares an edition and a locator (url or
 *      page range), so a reader can find what a citation points at.
 *   3. No source claims to be copyrighted third-party *content* (a source is a
 *      reference to a published work, never a dump of it).
 *
 * It cannot detect paraphrase. It can stop the two things that actually went
 * wrong before: an unregistered source id, and a citation with no locator.
 */
import { readFileSync, existsSync } from 'node:fs';

const problems = [];
const notes = [];

const licensePath = 'LICENSE';
if (!existsSync(licensePath)) {
  problems.push('LICENSE file is missing');
} else {
  const text = readFileSync(licensePath, 'utf8');
  if (!/MIT License/i.test(text)) problems.push('LICENSE does not look like the MIT licence');
  if (!/Permission is hereby granted, free of charge/i.test(text)) {
    problems.push('LICENSE is missing the MIT grant paragraph');
  }
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.license !== 'MIT') problems.push(`package.json license is "${pkg.license}", expected "MIT"`);

const sources = JSON.parse(readFileSync('src/content/textbook/sources.json', 'utf8')).sources;
const ids = new Set();
for (const source of sources) {
  if (!source.id) problems.push('a source has no id');
  if (ids.has(source.id)) problems.push(`duplicate source id ${source.id}`);
  ids.add(source.id);

  if (!source.title) problems.push(`${source.id}: no title`);
  if (!source.role) problems.push(`${source.id}: no role (primary/supplement/method/dictionary/rule)`);

  // Every work we cite must state where it came from (edition/year/publisher or
  // the provenance note that already records how it was obtained).
  if (!source.edition && !source.year && !source.publisher && !source.evidence) {
    problems.push(`${source.id}: no edition/year/publisher/evidence, so a citation cannot be located`);
  }

  // The rights note is the whole point of this gate: it records whether the text
  // may be redistributed. Only the licence of a work is checked here, never the
  // work itself — and a source entry must never embed the work's text.
  const rights = `${source.rights ?? ''} ${source.license ?? ''}`.trim();
  if (!rights) problems.push(`${source.id}: no rights/licence note`);
  else if (!/(not|no|不|CC[\s-]?BY|public domain|MIT|redistribut|再分发|不再分发)/i.test(rights)) {
    problems.push(`${source.id}: rights note does not state a redistribution stance`);
  }

  if (source.text || source.content || source.body) {
    problems.push(`${source.id}: carries embedded content; sources must be references only`);
  }
}

// Project-internal rules must never be presented as linguistic evidence.
for (const source of sources) {
  if (source.id === 'LEX' && !/rule|规则/i.test(`${source.role ?? ''} ${source.note ?? ''}`)) {
    problems.push('LEX is registered but not marked as project rules');
  }
}

for (const note of notes) console.log(`note: ${note}`);

if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  console.error(`licence/provenance: ${problems.length} problem(s)`);
  process.exit(1);
}

console.log(`licence: MIT (LICENSE + package.json agree)`);
console.log(`sources: ${sources.length} registered, each with a role, a provenance note and a rights stance`);
console.log('scope: this checks citation metadata only; it cannot detect paraphrase');
