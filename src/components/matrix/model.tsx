/**
 * Pure derivation helpers for the Word Matrix. They keep the page component
 * free of data-shaping logic and are testable without React.
 *
 * Rule of thumb: nothing here decides whether a word exists. Attestation is
 * always decided by `buildWord()` / the lexicon; these helpers only collect
 * which prefixes and suffixes the lexicon actually attests around a base.
 */
import { getMorpheme } from '../../lib/content';
import type { WordEntry } from '../../lib/types';

export interface BaseCandidate {
  form: string;
  glossZh: string;
  /** Number of lexicon words built on this base. */
  family: number;
  /** True when the base is itself a whole word entry. */
  standalone: boolean;
  kindLabel: '词根' | '单词' | '成分';
}

export interface AffixItem {
  form: string;
  count: number;
}

export type PosFilter = 'all' | 'n' | 'v' | 'adj';

export const POS_LABEL: Record<string, string> = {
  n: '名词',
  v: '动词',
  adj: '形容词',
  adv: '副词',
  other: '其他',
};

const ORIGIN_LABEL: Record<string, string> = {
  OE: '古英语',
  ME: '中古英语',
  Lat: '拉丁语',
  Gk: '希腊语',
  Fr: '法语',
  Norse: '古诺斯语',
  It: '意大利语',
  Sp: '西班牙语',
  Ger: '德语',
  Ar: '阿拉伯语',
  unknown: '未标注',
};

export function originLabel(origin: string): string {
  return ORIGIN_LABEL[origin] ?? origin;
}

/** Drop duplicate spellings so counts reflect distinct lexicon entries. */
export function uniqueWords(words: WordEntry[]): WordEntry[] {
  const seen = new Set<string>();
  const out: WordEntry[] = [];
  for (const w of words) {
    if (!w.w || seen.has(w.w)) continue;
    seen.add(w.w);
    out.push(w);
  }
  return out;
}

function isUsableBase(form: string): boolean {
  return /^[a-z]{2,}$/.test(form);
}

/**
 * Index of the lexical core inside a word's parts: the first root/combining
 * form, otherwise the first part that is not a known affix.
 */
export function coreIndexOf(parts: string[]): number {
  const rootIdx = parts.findIndex((p) => {
    const type = getMorpheme(p)?.type;
    return type === 'root' || type === 'combining';
  });
  if (rootIdx >= 0) return rootIdx;
  const freeIdx = parts.findIndex((p) => {
    const type = getMorpheme(p)?.type;
    return type !== 'prefix' && type !== 'suffix';
  });
  return freeIdx >= 0 ? freeIdx : 0;
}

/**
 * Bases offered in the left column. A base is either a standalone word entry
 * or the core morpheme of attested derived words — never an invented string.
 */
export function buildBaseCandidates(words: WordEntry[]): BaseCandidate[] {
  const map = new Map<string, BaseCandidate>();
  for (const entry of words) {
    if (entry.parts.length === 0) continue;
    const core = entry.parts[coreIndexOf(entry.parts)];
    if (!core || !isUsableBase(core)) continue;
    const morpheme = getMorpheme(core);
    const standalone = entry.parts.length === 1;
    const gloss = morpheme?.glossZh ?? (standalone ? entry.glossZh : '');
    const existing = map.get(core);
    if (existing) {
      existing.family += 1;
      existing.standalone = existing.standalone || standalone;
      if (!existing.glossZh && gloss) existing.glossZh = gloss;
    } else {
      map.set(core, {
        form: core,
        glossZh: gloss,
        family: 1,
        standalone,
        kindLabel:
          morpheme?.type === 'root' || morpheme?.type === 'combining'
            ? '词根'
            : standalone
              ? '单词'
              : '成分',
      });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.family - a.family ||
      Number(b.standalone) - Number(a.standalone) ||
      a.form.localeCompare(b.form),
  );
}

export function filterCandidates(candidates: BaseCandidate[], query: string): BaseCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((c) => c.form.includes(q) || c.glossZh.toLowerCase().includes(q));
}

function rank(counts: Map<string, number>): AffixItem[] {
  return [...counts.entries()]
    .map(([form, count]) => ({ form, count }))
    .sort((a, b) => b.count - a.count || a.form.localeCompare(b.form));
}

function bump(map: Map<string, number>, form: string) {
  map.set(form, (map.get(form) ?? 0) + 1);
}

/**
 * Row / column inventory for a base: the parts that sit immediately before and
 * after it in attested words. This is why some rows never appear — the lexicon
 * has no word with that prefix on that base.
 */
export function affixInventory(
  base: string,
  words: WordEntry[],
): { prefixes: AffixItem[]; suffixes: AffixItem[] } {
  const prefixes = new Map<string, number>();
  const suffixes = new Map<string, number>();
  for (const entry of words) {
    const idx = entry.parts.indexOf(base);
    if (idx < 0) continue;
    const before = entry.parts[idx - 1];
    const after = entry.parts[idx + 1];
    if (before && before !== base) bump(prefixes, before);
    if (after && after !== base) bump(suffixes, after);
  }
  return { prefixes: rank(prefixes), suffixes: rank(suffixes) };
}

/** Fallback inventory used when the user types a base the lexicon does not know. */
export function globalAffixes(
  words: WordEntry[],
  limit = 5,
): { prefixes: AffixItem[]; suffixes: AffixItem[] } {
  const prefixes = new Map<string, number>();
  const suffixes = new Map<string, number>();
  for (const entry of words) {
    const idx = coreIndexOf(entry.parts);
    const before = entry.parts[idx - 1];
    const after = entry.parts[idx + 1];
    if (before) bump(prefixes, before);
    if (after) bump(suffixes, after);
  }
  return { prefixes: rank(prefixes).slice(0, limit), suffixes: rank(suffixes).slice(0, limit) };
}

/** Best-effort position of an attested word inside the matrix of `base`. */
export function locateInMatrix(entry: WordEntry, base: string): { prefix: string; suffix: string } {
  const idx = entry.parts.indexOf(base);
  if (idx < 0) return { prefix: '', suffix: '' };
  return { prefix: entry.parts[idx - 1] ?? '', suffix: entry.parts[idx + 1] ?? '' };
}

/** Words sharing at least one morpheme with `entry`, closest relatives first. */
export function familyOf(entry: WordEntry, words: WordEntry[], limit = 12): WordEntry[] {
  const own = new Set(entry.parts);
  return words
    .filter((w) => w.w !== entry.w && w.parts.some((p) => own.has(p)))
    .map((w) => ({ w, shared: w.parts.filter((p) => own.has(p)).length }))
    .sort((a, b) => b.shared - a.shared || a.w.w.localeCompare(b.w.w))
    .slice(0, limit)
    .map((x) => x.w);
}

export function truncate(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}
