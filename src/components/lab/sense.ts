/**
 * "Same spelling, different morpheme" helpers.
 *
 * `plac` is both Latin *please* and Greek *flat*; `in-` is both "not" and
 * "into". The UI must never show a bare `plac` where the sense matters, and it
 * must never guess which one a word uses — the morpheme ID in `partIds` already
 * answers that, so these helpers only turn an ID into a disambiguated label.
 */
import { identity } from '../../lib/content';
import { normalizeForm, senseKeyOf } from '../../lib/identity';
import type { Morpheme, WordEntry } from '../../lib/types';

export interface SenseChoice {
  id: string;
  form: string;
  senseKey?: string;
  glossZh: string;
  /** `plac (flat)` — the form plus the shortest distinguishing sense. */
  label: string;
}

function keyOf(m: Morpheme | undefined): string | undefined {
  if (!m) return undefined;
  return m.senseKey ?? senseKeyOf(m);
}

/** Shortest distinguishing sense for a morpheme ID. */
export function senseKeyOfId(id: string): string | undefined {
  return keyOf(identity.byId(id));
}

/** Every morpheme a spelling can stand for (more than one = homograph). */
export function senseCandidates(form: string): string[] {
  return identity.idsForForm(normalizeForm(form));
}

export function isAmbiguousForm(form: string): boolean {
  return senseCandidates(form).length > 1;
}

/** `plac (flat)` for a known ID, `plac` when a single sense owns the spelling. */
export function morphemeLabel(form: string, id?: string): string {
  const bare = form.replace(/^-+|-+$/g, '');
  const target = id ?? (senseCandidates(bare).length === 1 ? senseCandidates(bare)[0] : undefined);
  if (!target) return bare;
  const key = senseKeyOfId(target);
  if (!key) return bare;
  const homographs = identity.homographsOf(target);
  return homographs.length > 0 ? `${bare} (${key})` : bare;
}

/** `plac (flat)` / `plac (please)` chips for a spelling with two readings. */
export function senseChoices(form: string): SenseChoice[] {
  const bare = form.replace(/^-+|-+$/g, '');
  const out: SenseChoice[] = [];
  for (const id of senseCandidates(bare)) {
    const m = identity.byId(id);
    if (!m) continue;
    const senseKey = keyOf(m);
    out.push({
      id,
      form: bare,
      ...(senseKey ? { senseKey } : {}),
      glossZh: m.glossZh,
      label: senseKey ? `${bare} (${senseKey})` : bare,
    });
  }
  return out;
}

export interface PartSense {
  part: string;
  id: string | null;
  /** Disambiguated label, or the bare form when the sense is not in doubt. */
  label: string;
  ambiguous: boolean;
  senseKey?: string;
  glossZh?: string;
}

/**
 * Label each part of a word entry. A part whose ID has homographs gets its
 * sense attached; everything else stays bare so the page is not noisy.
 */
export function partSenses(entry: WordEntry): PartSense[] {
  const ids = entry.partIds ?? entry.parts.map((p) => senseCandidates(p)[0] ?? null);
  return entry.parts.map((part, i) => {
    const id = ids[i] ?? null;
    const bare = part.replace(/^-+|-+$/g, '');
    const homographs = id ? identity.homographsOf(id) : [];
    const morpheme = id ? identity.byId(id) : undefined;
    return {
      part: bare,
      id,
      label: id && homographs.length > 0 ? morphemeLabel(bare, id) : bare,
      ambiguous: homographs.length > 0,
      senseKey: keyOf(morpheme),
      glossZh: morpheme?.glossZh,
    };
  });
}

/** Other families that share this family's spelling (`plac` flat vs please). */
export function homographFamilies(familyId: string): SenseChoice[] {
  const out: SenseChoice[] = [];
  for (const id of identity.homographsOf(familyId)) {
    const m = identity.byId(id);
    if (!m) continue;
    const bare = m.form.replace(/^-+|-+$/g, '');
    const senseKey = keyOf(m);
    out.push({
      id,
      form: bare,
      ...(senseKey ? { senseKey } : {}),
      glossZh: m.glossZh,
      label: senseKey ? `${bare} (${senseKey})` : bare,
    });
  }
  return out;
}
