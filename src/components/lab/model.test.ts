import { describe, expect, it } from 'vitest';
import { allWords } from '../../lib/content';
import {
  affixColumns,
  buildLadder,
  buildRows,
  filterRows,
  groupResults,
  ladderLevels,
  maxDepthOf,
  nodesAtDepth,
} from './model';

const DICTIONARY = new Set(allWords().map((w) => w.w));

describe('ladder', () => {
  it('grows multi-layer families past the base’s immediate affixes', () => {
    const nodes = buildLadder('nation', DICTIONARY);
    const words = nodes.map((n) => n.word);
    expect(words).toContain('national');
    expect(words).toContain('nationalize');
    expect(words).toContain('nationalization');
  });

  it('records depth and the steps that produced each row', () => {
    const nodes = buildLadder('nation', DICTIONARY);
    const deep = nodes.find((n) => n.word === 'nationalization');
    expect(deep?.depth).toBe(3);
    expect(deep?.steps.map((s) => s.add)).toEqual(['-al', '-ize', '-ation']);
  });

  it('keeps an unlisted base as a single row instead of inventing relatives', () => {
    const nodes = buildLadder('zzzz', DICTIONARY);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].known).toBe(false);
  });

  it('offers both prefixes and suffixes as columns', () => {
    const nodes = buildLadder('help', DICTIONARY);
    const columns = affixColumns(nodes, allWords());
    expect(columns.some((c) => c.kind === 'prefix')).toBe(true);
    expect(columns.some((c) => c.kind === 'suffix')).toBe(true);
  });
});

describe('grid rows', () => {  it('judges every cell into one of the three states', () => {
    const nodes = buildLadder('help', DICTIONARY);
    const columns = affixColumns(nodes, allWords());
    const rows = buildRows(nodes, columns, DICTIONARY);
    const states = new Set(rows.flatMap((r) => r.cells.map((c) => c.verdict.state)));
    expect(states.has('verified')).toBe(true);
    expect([...states].every((s) => s === 'verified' || s === 'unknown' || s === 'rule-blocked')).toBe(true);
  });

  it('dims cells instead of dropping them when filtering by suffix', () => {
    const nodes = buildLadder('help', DICTIONARY);
    const columns = affixColumns(nodes, allWords());
    const rows = buildRows(nodes, columns, DICTIONARY);
    const filtered = filterRows(rows, { query: '', pos: 'all', suffix: 'ness', family: '' });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0].cells).toHaveLength(columns.length);
    expect(filtered[0].cells.every((c) => c.matches === (c.affix.form === 'ness'))).toBe(true);
  });

  it('groups verified results by family', () => {
    const nodes = buildLadder('help', DICTIONARY);
    const columns = affixColumns(nodes, allWords());
    const groups = groupResults(buildRows(nodes, columns, DICTIONARY));
    expect(groups.length).toBeGreaterThan(0);
    const help = groups.find((g) => g.family === 'rx-help');
    expect(help?.words.some((w) => w.word === 'unhelpfulness')).toBe(true);
  });
});

describe('expansion', () => {
  it('no longer stops at 20 nodes for a large family', () => {
    const nodes = buildLadder('form', DICTIONARY);
    expect(nodes.length).toBeGreaterThan(20);
    expect(nodes.map((n) => n.depth)).toContain(3);
  });

  it('still honours an explicit ceiling when one is asked for', () => {
    const capped = buildLadder('form', DICTIONARY, 4, 12);
    expect(capped).toHaveLength(12);
  });

  it('reports one level per derivation depth and keeps depth 0 alone', () => {
    const nodes = buildLadder('nation', DICTIONARY);
    const levels = ladderLevels(nodes);
    expect(levels[0]).toEqual({ depth: 0, count: 1 });
    expect(levels.map((l) => l.depth)).toEqual([...levels.map((l) => l.depth)].sort((a, b) => a - b));
    expect(maxDepthOf(nodes)).toBe(levels.at(-1)?.depth);
  });

  it('reveals every node up to the requested depth', () => {
    const nodes = buildLadder('nation', DICTIONARY);
    const level1 = nodesAtDepth(nodes, 1);
    expect(level1.every((n) => n.depth <= 1)).toBe(true);
    expect(nodesAtDepth(nodes, 0)).toHaveLength(1);
    expect(level1.length).toBeLessThan(nodes.length);
  });
});

describe('filtering keeps cells', () => {
  const rows = () => {
    const nodes = buildLadder('help', DICTIONARY);
    const columns = affixColumns(nodes, allWords());
    return { rows: buildRows(nodes, columns, DICTIONARY), columns };
  };

  it('dims a non-matching search row instead of deleting it', () => {
    const { rows: all } = rows();
    const filtered = filterRows(all, { query: 'unhelpful', pos: 'all', suffix: '', family: '' });
    expect(filtered).toHaveLength(all.length);
    expect(filtered.filter((r) => r.matches).length).toBeLessThan(all.length);
    expect(filtered[0].cells).toHaveLength(all[0].cells.length);
  });

  it('drops rows only when onlyMatches is asked for', () => {
    const { rows: all } = rows();
    const filtered = filterRows(all, { query: 'unhelpful', pos: 'all', suffix: '', family: '', onlyMatches: true });
    expect(filtered.length).toBeLessThan(all.length);
    expect(filtered.every((r) => r.matches)).toBe(true);
  });
});
