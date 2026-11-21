/**
 * Etymology & word-formation regression tests.
 *
 * These lock in the corrections for seven entries whose analyses were
 * "spelling-compatible" but morphologically false: a clipping mistaken for a
 * Latin prefix (intercom), a Latin first-person ending read as a linking vowel
 * (credo), a native compound hooked onto a homograph Greek root (laptop), and
 * one genuinely disputed etymology flattened into a single story (religion).
 *
 * The vocabulary is deliberately blunt: a test that only re-checks the split it
 * was written from proves nothing. Each case below fails on the *specific*
 * mistake that was actually made.
 *
 * Reads the shipped lexicon only; it goes green after the batch in
 * analysis/lexicon-batches/ety-fixes.json is merged into words.json.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type ContestedView = { view: string; evidence: string; confidence: string };

type Ety = {
  historical?: string;
  synchronic?: string;
  teaching?: string;
  productive?: string;
  contested?: ContestedView[];
};

type Word = {
  w: string;
  parts: string[];
  partIds?: (string | null)[];
  partResolution?: string;
  verified?: boolean;
  note?: string;
  etymology?: string;
  ety?: Ety;
  sources?: { id: string; detail?: string }[];
};

type Morpheme = { id: string; form: string; origin: string };

const readJson = <T>(relative: string): T =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf-8')) as T;

const WORDS = readJson<Word[]>('../content/lexicon/words.json');
const MORPHEMES = readJson<Morpheme[]>('../content/lexicon/morphemes.json');
const BY_WORD = new Map(WORDS.map((w) => [w.w.toLowerCase(), w]));
const MORPHEME_IDS = new Set(MORPHEMES.map((m) => m.id));

const TARGETS = ['religion', 'intercom', 'credo', 'laptop', 'captain', 'lucid', 'psyche'];

function word(spelling: string): Word {
  const hit = BY_WORD.get(spelling);
  if (!hit) throw new Error(`lexicon has no entry for "${spelling}"`);
  return hit;
}

const ids = (spelling: string): (string | null)[] => word(spelling).partIds ?? [];

describe('etymology fixes: the seven target words exist', () => {
  it.each(TARGETS)('%s is in words.json', (spelling) => {
    expect(BY_WORD.has(spelling)).toBe(true);
  });
});

describe('etymology fixes: four layers are recorded and kept apart', () => {
  it.each(TARGETS)('%s documents historical / synchronic / teaching / productive', (spelling) => {
    const ety = word(spelling).ety;
    expect(ety, `${spelling} has no ety block`).toBeTruthy();
    for (const field of ['historical', 'synchronic', 'teaching', 'productive'] as const) {
      expect(ety?.[field]?.trim().length ?? 0, `${spelling}.ety.${field} is empty`).toBeGreaterThan(10);
    }
  });

  it.each(TARGETS)('%s flags the pedagogical split as pedagogical', (spelling) => {
    // A teaching split that is not labelled as such will be read as etymology.
    expect(word(spelling).ety?.teaching ?? '').toMatch(/教学|助记| pedagogy/i);
  });

  it.each(TARGETS)('%s cites at least one locatable source', (spelling) => {
    const sources = word(spelling).sources ?? [];
    const locatable = sources.filter((s) => (s.detail?.trim().length ?? 0) >= 12);
    expect(locatable.length, `${spelling} has no source with a locatable detail`).toBeGreaterThan(0);
    // "OED / Etymonline 核对" is not a citation; it is a claim of having checked.
    for (const s of sources) expect(s.detail ?? '').not.toMatch(/^已?核对$|OED \/ Etymonline 核对/);
  });

  it('any verified word carries a non-empty etymology', () => {
    // Non-empty, not "substantial": the lexicon legitimately has terse notes
    // (alumnae: "拉丁阴性复数 -ae"). The strict length check is scoped to the
    // seven words above, where the four layers are the deliverable.
    for (const w of WORDS) {
      if (!w.verified) continue;
      const ety = w.ety as (Ety & { from?: string }) | undefined;
      const text = [ety?.historical, ety?.from, w.etymology].filter(Boolean).join(' ').trim();
      expect(text.length, `${w.w} is verified but has no etymology`).toBeGreaterThan(0);
    }
  });

  it('every partId points at a morpheme that actually exists', () => {
    for (const w of WORDS) {
      for (const id of w.partIds ?? []) {
        if (id === null) continue;
        expect(MORPHEME_IDS.has(id), `${w.w} references missing morpheme id "${id}"`).toBe(true);
      }
    }
  });
});

describe('laptop is a native compound, not a Greek root + top', () => {
  it('does not resolve its top to the Greek root cx-top (topos "place")', () => {
    expect(ids('laptop')).not.toContain('cx-top');
  });

  it('does not split off "top" as a morpheme part', () => {
    // "lap" and "top" are free English morphemes; the lexicon's root inventory
    // has no slot for them, and mapping "top" to cx-top is the exact bug.
    expect(word('laptop').parts.map((p) => p.toLowerCase())).not.toContain('top');
  });

  it('records the 1983-84 coinage and the Old English components', () => {
    const historical = word('laptop').ety?.historical ?? '';
    expect(historical).toMatch(/198[34]/);
    expect(historical).toMatch(/古英语|læppa|topp/);
  });
});

describe('intercom is a clipping, not inter- + the Latin prefix com-', () => {
  it('never resolves "com" to px-com (the con- allomorph)', () => {
    expect(ids('intercom')).not.toContain('px-com');
  });

  it('is not analysed as px-inter + px-com', () => {
    const partIds = ids('intercom');
    const looksLikePrefixPair = partIds.includes('px-inter') && partIds.includes('px-com');
    expect(looksLikePrefixPair).toBe(false);
  });

  it('names intercommunication as the direct source', () => {
    expect(word('intercom').ety?.historical ?? '').toMatch(/intercommunication/i);
  });
});

describe('credo keeps its Latin first-person ending out of the suffix table', () => {
  it('does not treat the final -o as a linking vowel (cx-o)', () => {
    expect(ids('credo')).not.toContain('cx-o');
  });

  it('describes -o as a first-person singular ending', () => {
    const text = [word('credo').ety?.historical, word('credo').ety?.synchronic, word('credo').note]
      .filter(Boolean)
      .join(' ');
    expect(text).toMatch(/第一人称|1sg|first person/i);
  });

  it('is not offered as evidence for a productive -o nominaliser', () => {
    expect(word('credo').ety?.productive ?? '').toMatch(/不能产|非能产|而非英语词缀|当后缀/);
  });
});

describe('religion keeps both etymologies instead of picking one', () => {
  it('carries at least two contested views', () => {
    expect(word('religion').ety?.contested?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('names both relegere and religare, each with evidence and confidence', () => {
    const views = word('religion').ety?.contested ?? [];
    const text = views.map((v) => v.view).join(' ');
    expect(text).toMatch(/relegere/i);
    expect(text).toMatch(/religare/i);
    for (const v of views) {
      expect(v.evidence.trim().length, `view "${v.view}" has no evidence`).toBeGreaterThan(10);
      expect(v.confidence.trim().length).toBeGreaterThan(0);
    }
  });

  it('is not marked verified while its split presupposes the disputed reading', () => {
    // re + lig + ion only works under religare; under relegere the middle part is leg-.
    expect(word('religion').verified).not.toBe(true);
  });
});

describe('captain: right root, wrong productivity claim', () => {
  it('starts from the caput root', () => {
    expect(ids('captain')[0]).toBe('rx-capit');
  });

  it('traces the borrowing through Old French to capitaneus', () => {
    expect(word('captain').ety?.historical ?? '').toMatch(/capitaneus/);
    expect(word('captain').ety?.historical ?? '').toMatch(/古法语|Old French/i);
  });

  it('marks -ain as non-productive rather than a rule', () => {
    expect(word('captain').ety?.productive ?? '').toMatch(/不能产|非能产|closed set|封闭词集/);
  });

  it('warns that capt- also descends from capere "seize"', () => {
    expect(word('captain').ety?.productive ?? '').toMatch(/capere/);
  });
});

describe('lucid: luc- + -id, with the root attribution flagged', () => {
  it('resolves luc- to the light root (lumen/lumin or a dedicated rx-luc)', () => {
    expect(['cx-lumen-lumin', 'rx-luc']).toContain(ids('lucid')[0]);
  });

  it('derives from lucere, not from lumen directly', () => {
    expect(word('lucid').ety?.historical ?? '').toMatch(/luc[eē]re|lucidus/);
  });

  it('flags that lux/luc- and lumen/lumin- are distinct Latin lexemes', () => {
    const contested = word('lucid').ety?.contested ?? [];
    const text = [contested.map((v) => `${v.view} ${v.evidence}`).join(' '), word('lucid').ety?.productive]
      .filter(Boolean)
      .join(' ');
    expect(text).toMatch(/词位|lexeme/);
    expect(text.length).toBeGreaterThan(20);
  });
});

describe('psyche: Greek loan with an ending, not a suffix', () => {
  it('resolves psych- to the mind root', () => {
    expect(ids('psyche')[0]).toBe('cx-psych');
  });

  it('leaves the Greek ending without an invented morpheme id', () => {
    const tail = ids('psyche').slice(1);
    for (const id of tail) expect(id).toBeNull();
  });

  it('derives from psukhe and explains the -e spelling', () => {
    const ety = word('psyche');
    expect(ety.ety?.historical ?? '').toMatch(/ψυχή|ps[ūu]kh[ēe]/);
    expect(`${ety.ety?.synchronic} ${ety.ety?.teaching}`).toMatch(/η|ēta|-e/);
  });
});
