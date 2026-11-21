/**
 * Family dossier wiring.
 *
 * 0.8.0 shipped a family page whose dossier panel never rendered: the route
 * carries a **morpheme** id (`rx-spec`) while dossiers are filed under the
 * **family** id (`fam-spect`), and the page looked the dossier up by the route
 * id. Nothing failed, the panel was simply always empty. These tests pin the
 * join so that class of silent no-op cannot come back.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

interface Morpheme {
  id: string;
  form: string;
  allomorphs?: string[];
  familyId?: string | null;
}
interface Dossier {
  id: string;
  root: { form: string };
  members?: { w: string }[];
}
interface Word {
  w: string;
}

const DIR = 'src/content/families';
const morphemes = JSON.parse(readFileSync('src/content/lexicon/morphemes.json', 'utf8')) as Morpheme[];
const words = JSON.parse(readFileSync('src/content/lexicon/words.json', 'utf8')) as Word[];
const spellings = new Set(words.map((word) => word.w.toLowerCase()));

const dossiers = readdirSync(DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(DIR, file), 'utf8')) as Dossier);

describe('family dossiers', () => {
  it('ships the twelve researched families', () => {
    expect(dossiers.length).toBeGreaterThanOrEqual(12);
  });

  it('files every dossier under a familyId some morpheme actually points at', () => {
    const familyIds = new Set(morphemes.map((m) => m.familyId).filter(Boolean) as string[]);
    for (const dossier of dossiers) {
      expect(familyIds.has(dossier.id), `${dossier.id} has no morpheme with that familyId`).toBe(true);
    }
  });

  it('has a root morpheme in the lexicon for every dossier root', () => {
    for (const dossier of dossiers) {
      const form = dossier.root.form.toLowerCase();
      // A dossier names the root as learners see it (`duct`), while the record
      // may be filed under the base form (`duc`) with the rest as allomorphs.
      const found = morphemes.some((m) => [m.form, ...(m.allomorphs ?? [])].some((spelling) => spelling === form));
      expect(found, `${dossier.id}: no morpheme for root "${form}"`).toBe(true);
    }
  });

  it('keeps member counts honest: at least five, and each spelled in the lexicon or plainly absent', () => {
    for (const dossier of dossiers) {
      const members = dossier.members ?? [];
      expect(members.length, `${dossier.id} has ${members.length} members`).toBeGreaterThanOrEqual(5);
      for (const member of members) {
        // A member may be outside the lexicon (that is the documented 40-word
        // gap), but it must be a lowercase single word, not a phrase.
        expect(member.w).toMatch(/^[a-z][a-z-]*$/);
      }
    }
  });

  it('has no duplicate member across families', () => {
    const seen = new Map<string, string>();
    for (const dossier of dossiers) {
      for (const member of dossier.members ?? []) {
        const other = seen.get(member.w);
        expect(other, `${member.w} appears in ${dossier.id} and ${other}`).toBeUndefined();
        seen.set(member.w, dossier.id);
      }
    }
  });

  it('reports how much of the dossier vocabulary the app can actually open', () => {
    // Not an assertion about quality: this is the number the release notes quote.
    const total = dossiers.reduce((n, d) => n + (d.members?.length ?? 0), 0);
    const inLexicon = dossiers.reduce(
      (n, d) => n + (d.members ?? []).filter((m) => spellings.has(m.w)).length,
      0,
    );
    expect(inLexicon).toBeLessThanOrEqual(total);
    expect(inLexicon).toBeGreaterThan(total * 0.6);
  });
});
