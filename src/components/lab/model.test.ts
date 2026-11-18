import { describe, expect, it } from 'vitest';
import { allWords } from '../../lib/content';
import { affixColumns, buildLadder, buildRows, filterRows, groupResults } from './model';

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

describe('grid rows', () => {
  it('judges every cell into one of the three states', () => {
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
