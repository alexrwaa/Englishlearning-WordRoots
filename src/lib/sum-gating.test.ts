/**
 * Sum gating (0.12.1): a Word Sum may only be auto-graded when the reference
 * structure is a verified modern analysis with a named source.
 *
 * The bug this guards against: `layer` used to carry three different claims at
 * once — a Latin etymon (`spectator = spect + -ator`), a teaching split
 * (`oc + cup + y`), and a live modern analysis (`inspect = in- + spect`). The
 * summarize step then marked the learner wrong against whichever one happened
 * to be in the file. These tests make the distinction load-bearing.
 */
import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { FamilyDossier } from './content';
import {
  analysesOf,
  buildInquiry,
  checkSum,
  classifyMember,
  gradeSum,
  isGradable,
  spellsOut,
  type SumAnalysis,
} from './family-inquiry';

const DIR = 'src/content/families';
const dossiers = readdirSync(DIR)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as FamilyDossier);

function dossier(id: string): FamilyDossier {
  const found = dossiers.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing dossier ${id}`);
  return found;
}

const neverKnown = () => false;

const KINDS = new Set(['historical', 'synchronous', 'analogical', 'cognate', 'unverified']);

/** The summarize step rotates three rows per session, so search every pass. */
function findSum(family: FamilyDossier, word: string) {
  for (let session = 0; session < 20; session += 1) {
    const model = buildInquiry(family, neverKnown, { session });
    const found = [...model.sums, ...model.ungraded].find((entry) => entry.word === word);
    if (found) return found;
  }
  return undefined;
}

describe('analysis schema', () => {
  it('names the claim every member structure makes', () => {
    const members = dossiers.flatMap((entry) => entry.members ?? []);
    expect(members.length).toBeGreaterThan(150);
    for (const member of members) {
      expect(member.analysis, `${member.w} has no analysis`).toBeDefined();
      expect(KINDS.has(member.analysis?.kind ?? '')).toBe(true);
    }
  });

  it('requires a source for every synchronous claim, and that it exists', () => {
    for (const entry of dossiers) {
      const ids = new Set((entry.sources ?? []).map((source) => source.id));
      for (const member of entry.members ?? []) {
        if (member.analysis?.kind !== 'synchronous') continue;
        expect(member.analysis.verified, `${entry.id}/${member.w} not verified`).toBe(true);
        expect(member.analysis.source, `${entry.id}/${member.w} has no source`).toBeTruthy();
        expect(ids.has(member.analysis.source as string), `${entry.id}/${member.w} cites unknown source`).toBe(
          true,
        );
      }
    }
  });

  it('never marks a historical or analogical split as verified', () => {
    for (const entry of dossiers) {
      for (const member of entry.members ?? []) {
        const kind = member.analysis?.kind;
        if (kind === 'synchronous') continue;
        expect(member.analysis?.verified, `${entry.id}/${member.w}`).not.toBe(true);
      }
    }
  });
});

describe('the gate', () => {
  it('refuses a layer that does not spell its own word', () => {
    expect(spellsOut(['cap', '-ity'], 'capacity')).toBe(false);
    expect(spellsOut(['de-', 'spic'], 'despise')).toBe(false);
    expect(spellsOut(['in-', 'spect'], 'inspect')).toBe(true);
    // e-drop is a documented rule, so one trailing e either way is fine.
    expect(spellsOut(['create', 'ion'], 'creation')).toBe(true);
  });

  it('treats a missing analysis as unverified, not as modern', () => {
    const bare = classifyMember({ layer: ['in-', 'spect'], relation: 'derivative' });
    expect(bare.kind).toBe('unverified');
    expect(bare.verified).toBe(false);
    expect(isGradable(bare, 'inspect')).toBe(false);
  });

  it('needs all four conditions: modern, verified, sourced, spelling', () => {
    const base: SumAnalysis = { layer: ['in-', 'spect'], kind: 'synchronous', verified: true, source: 'S1' };
    expect(isGradable(base, 'inspect')).toBe(true);
    expect(isGradable({ ...base, verified: false }, 'inspect')).toBe(false);
    expect(isGradable({ ...base, source: undefined }, 'inspect')).toBe(false);
    expect(isGradable({ ...base, kind: 'historical' }, 'inspect')).toBe(false);
    expect(isGradable({ ...base, kind: 'analogical' }, 'inspect')).toBe(false);
    expect(isGradable({ ...base, layer: ['in-'] }, 'inspect')).toBe(false);
    expect(isGradable({ ...base, layer: ['cap', '-ity'] }, 'capacity')).toBe(false);
  });

  it('keeps every non-gradable structure out of the graded sums, in all 12 families', () => {
    for (const entry of dossiers) {
      const model = buildInquiry(entry, neverKnown);
      const ungradedWords = new Set(model.ungraded.map((sum) => sum.word));
      for (const sum of model.sums) {
        expect(sum.graded).toBe(true);
        expect(sum.kind).toBe('synchronous');
        expect(sum.source, `${entry.id}/${sum.word} graded without a source`).toBeTruthy();
        expect(ungradedWords.has(sum.word)).toBe(false);
        for (const accepted of sum.accepted) {
          expect(spellsOut(accepted, sum.word), `${entry.id}/${sum.word} accepts ${accepted.join('+')}`).toBe(
            true,
          );
        }
      }
      for (const sum of model.ungraded) {
        expect(sum.graded).toBe(false);
        expect(sum.note && sum.note.length).toBeGreaterThan(8);
        expect(sum.analyses.every((analysis) => !isGradable(analysis, sum.word) || sum.analyses.length > 1)).toBe(
          true,
        );
      }
    }
  });

  it('does not grade a row that mixes a live and a historical analysis', () => {
    const model = buildInquiry(dossier('fam-spect'), neverKnown);
    const spectator = model.ungraded.find((sum) => sum.word === 'spectator');
    expect(spectator).toBeDefined();
    expect(model.sums.some((sum) => sum.word === 'spectator')).toBe(false);
    expect(spectator?.note).toContain('spectate + -or');
    expect(spectator?.note).toContain('spect + -ator');
    expect(spectator?.note).toContain('不设唯一答案');
  });
});

describe('spectator / spectate', () => {
  const fam = dossier('fam-spect');
  const member = (fam.members ?? []).find((entry) => entry.w === 'spectator');
  const spectate = (fam.members ?? []).find((entry) => entry.w === 'spectate');

  it('uses the modern split, because spectate was back-formed from spectator', () => {
    expect(member?.layer).toEqual(['spectate', '-or']);
    expect(member?.analysis?.kind).toBe('synchronous');
    expect(member?.note).toContain('逆构');
  });

  it('keeps the Latin analysis, but as history and not as the answer', () => {
    const analyses = analysesOf(member!);
    const latin = analyses.find((entry) => entry.kind === 'historical');
    expect(latin?.layer).toEqual(['spect', '-ator']);
    expect(latin?.verified).toBe(false);
    expect(isGradable(latin!, 'spectator')).toBe(false);
  });

  it('describes the direction correctly in the dossier note', () => {
    // spectate is the derived member; the note must not say spect + -ator made it.
    expect(member?.note).toMatch(/spectate 是由 spectator 逆构/);
    expect(member?.note).not.toMatch(/spectate 由 spect/);
  });

  it('does not invent a new member for spectate when the file has none', () => {
    expect(spectate).toBeUndefined();
  });
});

describe('multiple live analyses', () => {
  it('accepts both documented splits instead of picking one', () => {
    const sum = findSum(dossier('fam-chron'), 'chronobiology');
    expect(sum).toBeDefined();
    const joined = sum!.accepted.map((accepted) => accepted.join('+'));
    expect(joined).toContain('chrono+bio+-logy');
    expect(joined).toContain('chrono+biology');
  });

  it('passes a learner who writes either of them', () => {
    const sum = findSum(dossier('fam-chron'), 'chronobiology')!;
    const graded = { ...sum, graded: true, accepted: [['chrono', 'bio', '-logy'], ['chrono', 'biology']] };
    expect(gradeSum('chrono + biology', graded).ok).toBe(true);
    expect(gradeSum('chrono + bio + logy', graded).ok).toBe(true);
  });

  it('treats -graphy as a suffix that biography can be split before', () => {
    const sum = findSum(dossier('fam-graph'), 'biography');
    expect(sum?.accepted.map((accepted) => accepted.join('+'))).toContain('bio+graphy');
  });
});

describe('ungraded rows', () => {
  it('returns unresolved with a reason, never "wrong"', () => {
    const model = buildInquiry(dossier('fam-fer'), neverKnown);
    const translate = model.ungraded.find((sum) => sum.word === 'translate');
    expect(translate).toBeDefined();
    const verdict = gradeSum('trans + lat', translate!);
    expect(verdict.structure).toBe('unresolved');
    expect(verdict.ok).toBe(false);
    expect(verdict.note).toContain('历史形态');
  });

  it('does not grade cognates as derivations', () => {
    const model = buildInquiry(dossier('fam-spect'), neverKnown);
    const spectrum = model.ungraded.find((sum) => sum.word === 'spectrum');
    // spectrum has no layer, so it is not a sum at all; the gate still refuses it.
    expect(spectrum).toBeUndefined();
    const member = (dossier('fam-spect').members ?? []).find((entry) => entry.w === 'spectrum');
    expect(classifyMember(member!).kind).toBe('cognate');
    expect(analysesOf(member!)).toEqual([]);
  });

  it('keeps the existing checkSum behaviour for graded rows', () => {
    const model = buildInquiry(dossier('fam-spect'), neverKnown);
    const inspect = model.sums.find((sum) => sum.word === 'inspect');
    expect(inspect).toBeDefined();
    expect(checkSum('in + spect', inspect!.accepted).ok).toBe(true);
    expect(gradeSum('in + spect', inspect!).ok).toBe(true);
    expect(gradeSum('in + spek + t', inspect!).ok).toBe(false);
  });
});

describe('the 12-family audit', () => {
  it('holds back a substantial share of structures, across the families that need it', () => {
    expect(dossiers).toHaveLength(12);
    const held = dossiers.map((entry) => buildInquiry(entry, neverKnown).ungraded.length);
    const total = held.reduce((sum, count) => sum + count, 0);
    expect(total).toBeGreaterThanOrEqual(20);
    expect(held.filter((count) => count > 0).length).toBeGreaterThanOrEqual(9);
  });

  it('holds back the specific splits that were being taught as answers', () => {
    const expected: Record<string, string[]> = {
      'fam-cap': ['capacity', 'receipt', 'occupy'],
      'fam-chron': ['chronological'],
      'fam-duct': ['aqueduct', 'educate', 'viaduct'],
      'fam-fer': ['fertile', 'translate', 'referendum'],
      'fam-graph': ['diagram', 'program'],
      'fam-mit': ['message'],
      'fam-phon': ['phonetics'],
      'fam-scrib': ['manuscript', 'transcript'],
      'fam-spect': ['expect', 'spectacle', 'despise', 'spectator'],
      'fam-struct': ['instrument', 'construe', 'structural'],
    };
    for (const [id, words] of Object.entries(expected)) {
      const ungraded = new Set(buildInquiry(dossier(id), neverKnown).ungraded.map((sum) => sum.word));
      for (const word of words) expect(ungraded.has(word), `${id}/${word}`).toBe(true);
    }
  });

  it('never grades a member whose relation is cognate', () => {
    for (const entry of dossiers) {
      const model = buildInquiry(entry, neverKnown);
      for (const sum of model.sums) {
        const member = (entry.members ?? []).find((item) => item.w === sum.word);
        expect(member?.relation, `${entry.id}/${sum.word}`).toBe('derivative');
      }
    }
  });
});
