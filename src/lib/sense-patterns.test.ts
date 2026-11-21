/**
 * Disambiguation patterns must name morphemes that exist.
 *
 * `SENSE_PATTERNS` in scripts/identity-migrate.ts keys patterns by morpheme id.
 * A key like `px-in-lat-2` (renamed to `px-im` long ago) silently disables the
 * rule: the word falls through to "ambiguous" and nobody notices, because a
 * missing key throws no error. That typo alone kept 50+ in-/im- words from
 * resolving. This test reads the map's keys and checks them against the shipped
 * lexicon, which is the cheapest possible guard against the same mistake.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const MIGRATOR = 'scripts/identity-migrate.ts';

interface Morpheme {
  id: string;
}

const source = readFileSync(MIGRATOR, 'utf8');
const morphemes = JSON.parse(
  readFileSync('src/content/lexicon/morphemes.json', 'utf8'),
) as Morpheme[];
const ids = new Set(morphemes.map((m) => m.id));

/** Keys inside the `SENSE_PATTERNS` object literal (quoted id followed by a colon). */
function patternKeys(): string[] {
  const start = source.indexOf('const SENSE_PATTERNS');
  if (start < 0) throw new Error('SENSE_PATTERNS not found in the migrator');
  const braceStart = source.indexOf('{', start);
  // Walk braces so a nested object (a pattern array) cannot end the block early.
  let depth = 0;
  let end = braceStart;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(braceStart, end);
  return [...body.matchAll(/^\s*'([a-z0-9-]+)':/gm)].map((m) => m[1]);
}

describe('sense patterns', () => {
  const keys = patternKeys();

  it('finds the pattern map', () => {
    expect(keys.length).toBeGreaterThan(10);
  });

  it('references only morphemes that exist', () => {
    const missing = keys.filter((key) => !ids.has(key));
    expect(missing, `SENSE_PATTERNS keys with no morpheme: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no duplicate keys (a duplicate silently overrides the first)', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of keys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });
});
