import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import formsJson from '../content/lexicon/forms.json';
import morphemeJson from '../content/lexicon/morphemes.json';
import wordJson from '../content/lexicon/words.json';
import { allWords, getMorpheme, identity as liveIdentity } from './content';
import { analyze } from './derive';
import { loadIdentity, normalizeForm, type FormIndex } from './identity';
import type { Morpheme, WordEntry } from './types';

const morphemes = morphemeJson as unknown as Morpheme[];
const words = wordJson as unknown as WordEntry[];
const forms = formsJson as unknown as FormIndex;
const identity = loadIdentity(morphemes, forms);

const word = (spelling: string): WordEntry => {
  const entry = words.find((candidate) => candidate.w === spelling);
  if (!entry) throw new Error(`missing word entry: ${spelling}`);
  return entry;
};

/** The ID a word assigns to a given part spelling. */
function partId(spelling: string, part: string): string | null {
  const entry = word(spelling);
  const index = entry.parts.indexOf(part);
  expect(index, `${spelling} has no part ${part}`).toBeGreaterThanOrEqual(0);
  return entry.partIds?.[index] ?? null;
}

describe('identity index', () => {
  it('maps one spelling to every ID that owns it', () => {
    expect(identity.idsForForm('plac')).toEqual(['cx-plac', 'cx-plac-gk']);
    // Two readings of in-: negation and direction. The IDs are frozen once
    // minted (review cards point at them), so the test pins the behaviour —
    // two distinct records — rather than the suffix the migration happened to pick.
    const ins = identity.idsForForm('-in-');
    expect(ins).toHaveLength(2);
    expect(ins.every((id) => id.startsWith('px-i'))).toBe(true);
    expect(identity.idsForForm('zzz-nothing')).toEqual([]);
  });

  it('normalises positional hyphens but keeps the spelling', () => {
    expect(normalizeForm('-tion')).toBe('tion');
    expect(normalizeForm('pre-')).toBe('pre');
    expect(normalizeForm('  In  ')).toBe('in');
    expect(identity.idsForForm('-tion')).toEqual(identity.idsForForm('tion'));
  });

  it('resolves a form with exactly one owner without hints', () => {
    const resolved = identity.resolve('struct');
    expect(resolved.ambiguous).toBe(false);
    expect(resolved.id).toBe('rx-stru');
  });

  it('never picks the first candidate when a form is ambiguous', () => {
    const resolved = identity.resolve('plac');
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.id).toBeUndefined();
    expect(resolved.candidates).toEqual(['cx-plac', 'cx-plac-gk']);
  });

  it('narrows an ambiguous form only when the hint is decisive', () => {
    expect(identity.resolve('plac', { origin: 'G' }).id).toBe('cx-plac-gk');
    expect(identity.resolve('plac', { origin: 'Latin' }).id).toBe('cx-plac');
    expect(identity.resolve('in', { glossEn: 'not' }).id).toBe('px-in');
    expect(identity.resolve('in', { glossEn: 'into' }).id).toBe('px-im');
    // An unhelpful hint must not become a coin flip.
    const vague = identity.resolve('plac', { glossEn: 'unrelated-sense' });
    expect(vague.ambiguous).toBe(true);
    expect(vague.id).toBeUndefined();
  });

  it('reports unknown spellings as unresolved rather than ambiguous', () => {
    expect(identity.resolve('qqq')).toEqual({ candidates: [], ambiguous: false });
  });

  it('keeps homographs reciprocal', () => {
    expect(identity.homographsOf('cx-plac')).toContain('cx-plac-gk');
    expect(identity.homographsOf('cx-plac-gk')).toContain('cx-plac');
    const inIds = identity.idsForForm('in');
    const senseOf = (id: string) => identity.byId(id)?.glossEn ?? '';
    const notId = inIds.find((id) => /not/.test(senseOf(id)))!;
    const intoId = inIds.find((id) => /into/.test(senseOf(id)))!;
    expect(identity.homographsOf(notId)).toContain(intoId);
    expect(identity.homographsOf(intoId)).toContain(notId);
    expect(identity.homographsOf('cx-ver')).toContain('cx-ver-lat-2');
    expect(identity.homographsOf('cx-bi')).toContain('cx-bi-gk');
    // Not every neighbour is a homograph: placoid's family is its own.
    expect(identity.homographsOf('cx-plac-gk')).not.toContain('cx-plac-please');
  });

  it('walks the lexical family without mixing in homographs', () => {
    expect(identity.familyOf('rx-fer')).toContain('rx-fer');
    expect(identity.familyOf('cx-plac-gk')).toEqual(['cx-plac-gk']);
    for (const id of identity.familyOf('rx-stru')) {
      expect(identity.byId(id)?.familyId).toBe('fam-struct');
    }
  });

  it('lists the deliberate homograph spellings', () => {
    const ambiguous = identity.stats().ambiguousForms;
    expect(ambiguous).toEqual(expect.arrayContaining(['plac', 'in', 'bi', 'ver']));
  });
});

describe('homograph regressions (docs/DATA_IDENTITY.md §7)', () => {
  it('splits plac: placate is Latin "please", placoid is Greek "flat"', () => {
    expect(partId('placate', 'plac')).toBe('cx-plac');
    expect(partId('placoid', 'plac')).toBe('cx-plac-gk');
    expect(identity.byId('cx-plac')?.glossEn).toContain('please');
    expect(identity.byId('cx-plac-gk')?.glossEn).toBe('flat');
    expect(identity.byId('cx-plac-gk')?.origin).toBe('Gk');
  });

  it('splits in-: invisible is negative, inject is directional', () => {
    expect(partId('invisible', 'in')).toBe('px-in');
    expect(partId('inject', 'in')).toBe('px-im');
    expect(identity.byId('px-in')?.glossEn).toBe('not');
    expect(identity.byId('px-im')?.glossEn).toBe('into');
  });

  it('splits bi / bio: binary counts, biology is life', () => {
    expect(partId('binary', 'bin')).toBe('cx-bin');
    expect(identity.byId('cx-bin')?.glossEn).toContain('two');
    expect(partId('biology', 'bio')).toBe('cx-bio');
    expect(identity.byId('cx-bio')?.glossEn).toBe('life');
    // `bi` is ambiguous because the textbook lists it as the headword for bio-.
    const bi = identity.resolve('bi');
    expect(bi.ambiguous).toBe(true);
    expect(bi.candidates).toEqual(['cx-bi', 'cx-bi-gk']);
    expect(identity.byId('cx-bi')?.glossEn).toBe('two');
    expect(identity.byId('cx-bi-gk')?.glossEn).toBe('life');
  });

  it('splits ver: verify is "true", revere is "fear/awe"', () => {
    expect(partId('verify', 'ver')).toBe('cx-ver');
    expect(partId('revere', 'ver')).toBe('cx-ver-lat-2');
    expect(identity.byId('cx-ver')?.glossEn).toBe('true');
    expect(identity.byId('cx-ver-lat-2')?.glossEn).toBe('fear, awe');
    // verdict uses the "true" root even though its entry has no etymology note.
    expect(partId('verdict', 'ver')).toBe('cx-ver');
  });
});

describe('shipped content consistency', () => {
  it('every ID in forms.json exists, and every canonical form is indexed', () => {
    for (const [form, ids] of Object.entries(forms)) {
      expect(ids.length, `${form} has no ID`).toBeGreaterThan(0);
      for (const id of ids) {
        const morpheme = identity.byId(id);
        expect(morpheme, `${form} -> ${id}`).toBeDefined();
        // Since 0.8.0 the index also lists allomorphs, so a key is either the
        // canonical form or one of the recorded variant spellings — both are
        // legitimate ways to reach the same morpheme.
        const spellings = [morpheme?.form, ...(morpheme?.allomorphs ?? [])].map((f) => normalizeForm(f ?? ''));
        expect(spellings, `${form} -> ${id}`).toContain(form);
      }
    }
    for (const morpheme of morphemes) {
      expect(forms[normalizeForm(morpheme.form)] ?? []).toContain(morpheme.id);
    }
  });

  it('every word has partIds as long as parts', () => {
    for (const entry of words) {
      if (!entry.partIds) continue;
      expect(entry.partIds.length, entry.w).toBe(entry.parts.length);
    }
  });

  it('every ID of an exact word resolves, and exact words are non-empty', () => {
    let exact = 0;
    for (const entry of words) {
      if (entry.partResolution !== 'exact') continue;
      exact += 1;
      expect(entry.partIds, entry.w).toBeDefined();
      for (const id of entry.partIds ?? []) {
        expect(id, `${entry.w} has a gap but claims exact`).not.toBeNull();
        expect(identity.byId(id as string), `${entry.w} -> ${id}`).toBeDefined();
      }
    }
    expect(exact).toBeGreaterThan(300);
  });

  it('unresolved words never claim an ID for the part they could not resolve', () => {
    for (const entry of words) {
      if (entry.partResolution !== 'unresolved') continue;
      expect(entry.partIds?.some((id) => id === null)).toBe(true);
    }
  });

  it('lesson cards only carry morphemeIds parallel to their forms', () => {
    const withIds = liveIdentity.all().length > 0;
    expect(withIds).toBe(true);
    // The card payload lives in the week files; content.ts exposes the same data
    // the UI reads, so a card with IDs must be fully resolvable.
    const lessons = JSON.parse(
      readFileSync(join(process.cwd(), 'src/content/weeks/week01/day1.json'), 'utf-8'),
    ) as { cards: { morphemes?: string[]; morphemeIds?: string[] }[] };
    for (const card of lessons.cards) {
      if (!card.morphemeIds?.length) continue;
      expect(card.morphemeIds.length).toBe(card.morphemes?.length ?? 0);
      for (const id of card.morphemeIds) expect(liveIdentity.byId(id)).toBeDefined();
    }
  });

  it('keeps the legacy single-form lookup deterministic for homographs', () => {
    // The UI still calls getMorpheme; ambiguity must not make it flip-flop.
    // Whichever record wins, the lookup must not flip between calls.
    expect(getMorpheme('in')?.id).toBe(getMorpheme('in')?.id);
    expect(getMorpheme('im')?.id).toBe('px-im');
    expect(getMorpheme('in')?.id).toBe('px-in');
    expect(getMorpheme('plac')?.id).toBe('cx-plac');
  });

  it('analyze() reports the morpheme IDs next to the parts', () => {
    const inject = analyze('inject');
    expect(inject.ids[inject.parts.indexOf('in')]).toBe(partId('inject', 'in'));
    const invisible = analyze('invisible');
    expect(invisible.ids[invisible.parts.indexOf('in')]).toBe('px-in');
    expect(allWords().length).toBe(words.length);
  });
});

describe('migration idempotency', () => {
  it('produces identical IDs and forms.json when run twice', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const work = mkdtempSync(join(tmpdir(), 'identity-migrate-'));
    try {
      // A self-contained copy: the script resolves its root from its own path,
      // so migrating here cannot disturb the repository or other test files.
      mkdirSync(join(work, 'scripts'), { recursive: true });
      mkdirSync(join(work, 'src/lib'), { recursive: true });
      mkdirSync(join(work, 'src/content'), { recursive: true });
      cpSync(join(root, 'scripts/identity-migrate.ts'), join(work, 'scripts/identity-migrate.ts'));
      cpSync(join(root, 'src/lib/identity.ts'), join(work, 'src/lib/identity.ts'));
      cpSync(join(root, 'src/lib/types.ts'), join(work, 'src/lib/types.ts'));
      cpSync(join(root, 'src/content/lexicon'), join(work, 'src/content/lexicon'), { recursive: true });

      const migrate = () =>
        execSync(`npx tsx "${join(work, 'scripts/identity-migrate.ts')}"`, {
          cwd: root,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      const snapshot = () => ({
        ids: (
          JSON.parse(readFileSync(join(work, 'src/content/lexicon/morphemes.json'), 'utf-8')) as Morpheme[]
        )
          .map((morpheme) => morpheme.id)
          .sort(),
        forms: readFileSync(join(work, 'src/content/lexicon/forms.json'), 'utf-8'),
      });

      migrate();
      const first = snapshot();
      migrate();
      const second = snapshot();
      expect(second.ids).toEqual(first.ids);
      expect(second.forms).toBe(first.forms);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 180_000);
});
