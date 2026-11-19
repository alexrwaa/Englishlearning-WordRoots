/**
 * Data shaping for the derivation lab. Pure functions only, so the pages stay
 * about layout and the rules stay testable.
 *
 * Nothing here decides that a word exists: the ladder only grows through
 * combinations the verified lexicon confirms.
 */
import { allWords, getWord } from '../../lib/content';
import {
  affixRole,
  analyze,
  deriveFrom,
  familyBaseForm,
  familyIdOf,
  judgeAdd,
  rootIndexOf,
  type CellVerdict,
  type DerivationStep,
  type Pos,
  type WordContext,
} from '../../lib/derive';
import type { WordEntry } from '../../lib/types';
import { globalAffixes } from '../matrix/model';

export interface LadderNode {
  word: string;
  parts: string[];
  pos?: Pos | null;
  /** Number of derivation steps from the base. */
  depth: number;
  parent: string | null;
  /** Steps from the base to this word, already spelled out by the engine. */
  steps: DerivationStep[];
  known: boolean;
  glossZh?: string;
}

export interface AffixColumn {
  form: string;
  kind: 'prefix' | 'suffix';
}

export interface Cell {
  affix: AffixColumn;
  verdict: CellVerdict;
  /** False when the active filters hide this cell (it is dimmed, not removed). */
  matches: boolean;
}

export interface LadderRow {
  node: LadderNode;
  cells: Cell[];
  /** False when the search query excludes this row (the row is dimmed, not dropped). */
  matches: boolean;
}

export interface FilterState {
  query: string;
  pos: Pos | 'all';
  suffix: string;
  family: string;
  /**
   * Hide rows whose cells all fail the cell filters. Off by default: filtering
   * is meant to dim cells, not to delete them (a dimmed cell is still a
   * conclusion; a removed one is not).
   */
  onlyMatches?: boolean;
}

/**
 * Hard ceilings for the ladder. They exist to stop a pathological base from
 * freezing the tab, not to cap ordinary families: `spect` needs 4 levels and
 * still fits well inside them.
 */
export const LADDER_MAX_DEPTH = 4;
export const LADDER_MAX_NODES = 400;

function bump(map: Map<string, number>, form: string) {
  map.set(form, (map.get(form) ?? 0) + 1);
}

function ranked(map: Map<string, number>, limit: number): string[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([form]) => form);
}

/** Prefixes and suffixes that the lexicon actually attaches to this exact form. */
function affixesAround(form: string, words: WordEntry[]): { prefixes: string[]; suffixes: string[] } {
  const prefixes = new Map<string, number>();
  const suffixes = new Map<string, number>();
  for (const entry of words) {
    const idx = entry.parts.indexOf(form);
    if (idx < 0) continue;
    const before = entry.parts[idx - 1];
    const after = entry.parts[idx + 1];
    if (before && before !== form) bump(prefixes, before);
    if (after && after !== form) bump(suffixes, after);
  }
  return { prefixes: ranked(prefixes, 8), suffixes: ranked(suffixes, 10) };
}

/**
 * Every affix used anywhere in the family's words. A ladder needs this wider
 * view: `nationalize` takes -ation, but -ation never sits directly next to
 * `nation`, so a strictly local inventory would stop the ladder at `national`.
 */
function familyAffixes(form: string, words: WordEntry[]): { prefixes: string[]; suffixes: string[] } {
  const prefixes = new Map<string, number>();
  const suffixes = new Map<string, number>();
  for (const entry of words) {
    if (!entry.parts.includes(form)) continue;
    for (const part of entry.parts) {
      if (part === form) continue;
      const role = affixRole(part);
      if (role === 'prefix') bump(prefixes, part);
      else if (role === 'suffix') bump(suffixes, part);
    }
  }
  return { prefixes: ranked(prefixes, 6), suffixes: ranked(suffixes, 8) };
}

/**
 * Column set for the whole ladder: the family inventory plus affixes seen
 * directly around any level, with the most common affixes as a fallback so a
 * root with few relatives still produces a usable grid.
 */
export function affixColumns(nodes: LadderNode[], words: WordEntry[]): AffixColumn[] {
  const prefixes = new Map<string, number>();
  const suffixes = new Map<string, number>();
  const rootWord = nodes[0]?.word ?? '';
  if (rootWord) {
    const family = familyAffixes(rootWord, words);
    for (const p of family.prefixes) bump(prefixes, p);
    for (const s of family.suffixes) bump(suffixes, s);
  }
  for (const node of nodes) {
    const around = affixesAround(node.word, words);
    for (const p of around.prefixes) bump(prefixes, p);
    for (const s of around.suffixes) bump(suffixes, s);
  }
  if (prefixes.size === 0) {
    for (const p of globalAffixes(words, 6).prefixes) bump(prefixes, p.form);
  }
  if (suffixes.size === 0) {
    for (const s of globalAffixes(words, 10).suffixes) bump(suffixes, s.form);
  }
  return [
    ...ranked(prefixes, 5).map((form) => ({ form, kind: 'prefix' as const })),
    ...ranked(suffixes, 7).map((form) => ({ form, kind: 'suffix' as const })),
  ];
}

/**
 * Breadth-first ladder: base -> one affix -> two affixes -> three affixes.
 * Only forms present in the dictionary become nodes, so the ladder is a set of
 * verified derivations rather than a spelling exercise.
 *
 * Nothing is truncated at a "nice" size any more: the caller decides how deep
 * to *show* (see `ladderLevels`), while these ceilings only guard against a
 * runaway family. They are deliberately generous, and the UI states when they
 * were hit.
 */
export function buildLadder(
  base: string,
  dictionary: Set<string>,
  maxDepth = LADDER_MAX_DEPTH,
  maxNodes = LADDER_MAX_NODES,
): LadderNode[] {
  const words = allWords();
  const root = base.trim().toLowerCase();
  if (!root) return [];

  const rootEntry = getWord(root);
  const nodes: LadderNode[] = [
    {
      word: root,
      parts: rootEntry?.parts ?? analyze(root).parts,
      pos: rootEntry?.pos ?? null,
      depth: 0,
      parent: null,
      steps: [],
      known: Boolean(rootEntry),
      glossZh: rootEntry?.glossZh,
    },
  ];
  const seen = new Set([root]);
  let frontier = [nodes[0]];

  // Grow with the whole family's affixes: multi-layer words like
  // nationalization need -ation, which never sits next to the base itself.
  const family = familyAffixes(root, words);
  const additions = [
    ...family.prefixes.map((p) => `${p}-`),
    ...family.suffixes.map((s) => `-${s}`),
  ];

  for (let depth = 1; depth <= maxDepth && nodes.length < maxNodes; depth += 1) {
    const next: LadderNode[] = [];
    for (const node of frontier) {
      for (const addition of additions) {
        if (nodes.length >= maxNodes) break;
        const derived = deriveFrom(node.word, [addition], dictionary);
        if (!derived.valid || seen.has(derived.word)) continue;
        const entry = getWord(derived.word);
        if (!entry) continue;
        seen.add(derived.word);
        const child: LadderNode = {
          word: derived.word,
          parts: entry.parts,
          pos: entry.pos ?? null,
          depth,
          parent: node.word,
          steps: [...node.steps, ...derived.steps],
          known: true,
          glossZh: entry.glossZh,
        };
        nodes.push(child);
        next.push(child);
      }
    }
    frontier = next;
  }

  return nodes;
}

/** Nodes grouped by derivation depth, ascending. The UI reveals one key at a time. */
export function ladderLevels(nodes: LadderNode[]): { depth: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const node of nodes) counts.set(node.depth, (counts.get(node.depth) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([depth, count]) => ({ depth, count }));
}

/** Nodes up to and including `depth`. Depth 0 is always the base itself. */
export function nodesAtDepth(nodes: LadderNode[], depth: number): LadderNode[] {
  return nodes.filter((node) => node.depth <= depth);
}

/** Highest depth actually present in a ladder. */
export function maxDepthOf(nodes: LadderNode[]): number {
  return nodes.reduce((max, node) => Math.max(max, node.depth), 0);
}

function matchesFilters(
  verdict: CellVerdict,
  affix: AffixColumn,
  entry: WordEntry | undefined,
  filters: FilterState,
): boolean {
  if (filters.suffix && affix.form !== filters.suffix) return false;
  if (filters.pos !== 'all') {
    if (verdict.state !== 'verified') return false;
    if (entry?.pos !== filters.pos) return false;
  }
  if (filters.family) {
    if (verdict.state !== 'verified') return false;
    const family = entry ? familyIdOf(entry.parts[rootIndexOf(entry.parts)]) : undefined;
    if (family !== filters.family) return false;
  }
  return true;
}

/** One verdict per (row, column). All three states are always built. */
export function buildRows(nodes: LadderNode[], columns: AffixColumn[], dictionary: Set<string>): LadderRow[] {
  return nodes.map((node) => {
    const context: WordContext = { word: node.word, parts: node.parts, pos: node.pos ?? null };
    return {
      node,
      matches: true,
      cells: columns.map((affix) => ({
        affix,
        verdict: judgeAdd(context, affix.kind === 'prefix' ? `${affix.form}-` : `-${affix.form}`, dictionary),
        matches: true,
      })),
    };
  });
}

/**
 * Apply search / word-class / suffix / family filters without recomputing
 * verdicts. Filtering never deletes a cell: a cell that fails keeps its full
 * verdict and only loses opacity. Rows behave the same way — a row that does
 * not match the search is dimmed, and only `onlyMatches` removes it.
 */
export function filterRows(rows: LadderRow[], filters: FilterState): LadderRow[] {
  const query = filters.query.trim().toLowerCase();
  const cellFilterActive = filters.pos !== 'all' || Boolean(filters.suffix) || Boolean(filters.family);
  const out: LadderRow[] = [];
  for (const row of rows) {
    const entry = getWord(row.node.word);
    const matches = query
      ? [row.node.word, entry?.glossZh ?? '', row.node.glossZh ?? '', row.node.parts.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(query)
      : true;
    const cells = row.cells.map((cell) => ({
      ...cell,
      matches: matchesFilters(cell.verdict, cell.affix, getWord(cell.verdict.word), filters),
    }));
    if (filters.onlyMatches && (!matches || (cellFilterActive && !cells.some((cell) => cell.matches)))) continue;
    out.push({ node: row.node, matches, cells });
  }
  return out;
}

/** How many rows the current filters highlight (search match + at least one cell). */
export function matchingRowCount(rows: LadderRow[]): number {
  return rows.filter((row) => row.matches && row.cells.some((cell) => cell.matches)).length;
}

export interface FamilyGroup {
  family: string;
  label: string;
  words: { word: string; glossZh: string }[];
}

/** Verified results grouped by word family, for the results panel. */
export function groupResults(rows: LadderRow[]): FamilyGroup[] {
  const groups = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (!row.matches) continue;
    for (const cell of row.cells) {
      if (cell.verdict.state !== 'verified' || !cell.matches) continue;
      const entry = getWord(cell.verdict.word);
      if (!entry) continue;
      const family = familyIdOf(entry.parts[rootIndexOf(entry.parts)]) ?? '未归类';
      const bucket = groups.get(family) ?? new Map<string, string>();
      bucket.set(entry.w, entry.glossZh);
      groups.set(family, bucket);
    }
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([family, words]) => ({
      family,
      label: family === '未归类' ? '未归类' : (familyBaseForm(family) ?? family),
      words: [...words.entries()]
        .map(([word, glossZh]) => ({ word, glossZh }))
        .sort((a, b) => a.word.localeCompare(b.word)),
    }));
}

export function cellKey(word: string, affix: string): string {
  return `${word}|${affix}`;
}
