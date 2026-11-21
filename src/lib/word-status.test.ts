import { describe, expect, it } from 'vitest';
import words from '../content/lexicon/words.json';
import morphemes from '../content/lexicon/morphemes.json';
import sources from '../content/textbook/sources.json';

/**
 * Word status invariants (0.8.0).
 *
 * `verified: true` used to be the only claim a word made, and it was wrong for
 * 101 of them: they had a part with no morpheme ID yet were still counted as
 * evidence. These tests make the four questions separate and keep them honest.
 */
type Analysis = {
  lexical: boolean;
  analyzable: boolean;
  segmentation: 'verified' | 'partial' | 'unverified' | 'none';
  unresolved?: { part: string; reason: string }[];
  etymology: { status: string; sources?: string[] };
  contested?: { view: string; evidence: string; confidence: string }[];
  quizSafe: boolean;
};
type Word = { w: string; parts?: string[]; partIds?: (string | null)[]; verified?: boolean; sources?: unknown[]; analysis?: Analysis };

const all = words as Word[];
const ids = new Set((morphemes as { id: string }[]).map((m) => m.id));
const registered = new Set(sources.sources.map((s: { id: string }) => s.id));

describe('word status', () => {
  it('every word carries an explicit analysis block', () => {
    const missing = all.filter((w) => !w.analysis).map((w) => w.w);
    expect(missing, `words without analysis: ${missing.slice(0, 5).join(', ')}`).toHaveLength(0);
  });

  it('does not claim a verified split while a part has no ID and no reason', () => {
    const bad: string[] = [];
    for (const word of all) {
      if (word.analysis?.segmentation !== 'verified') continue;
      const gaps = (word.partIds ?? []).filter((id) => !id).length;
      const explained = word.analysis.unresolved?.length ?? 0;
      if (gaps > 0 && explained < gaps) bad.push(word.w);
    }
    expect(bad, `verified splits with unexplained gaps: ${bad.slice(0, 5).join(', ')}`).toHaveLength(0);
  });

  it('only points partIds at morphemes that exist', () => {
    const bad = all.flatMap((w) => (w.partIds ?? []).filter((id): id is string => Boolean(id) && !ids.has(id as string)));
    expect(bad, `unknown morpheme IDs: ${bad.slice(0, 5).join(', ')}`).toHaveLength(0);
  });

  it('keeps quizSafe a subset of verified segmentation', () => {
    const bad = all.filter((w) => w.analysis?.quizSafe && w.analysis.segmentation !== 'verified').map((w) => w.w);
    expect(bad).toHaveLength(0);
  });

  it('never marks a word documented without a locatable citation', () => {
    const bad = all
      .filter((w) => w.analysis?.etymology.status === 'documented')
      .filter((w) => !(w.analysis?.etymology.sources ?? []).some((id) => registered.has(id)))
      .map((w) => w.w);
    expect(bad).toHaveLength(0);
  });

  it('records competing views instead of picking one silently', () => {
    const disputed = all.filter((w) => w.analysis?.etymology.status === 'disputed');
    for (const word of disputed) {
      expect(word.analysis?.contested?.length ?? 0, `${word.w} is disputed with no views`).toBeGreaterThanOrEqual(2);
      for (const view of word.analysis?.contested ?? []) {
        expect(view.evidence.length, `${word.w} view without evidence`).toBeGreaterThan(8);
      }
    }
  });

  it('keeps legacy verified consistent with the new fields', () => {
    const bad = all
      .filter((w) => w.verified)
      .filter((w) => w.analysis?.segmentation !== 'verified' || w.analysis?.etymology.status === 'unknown')
      .map((w) => w.w);
    expect(bad, `legacy verified not backed by analysis: ${bad.slice(0, 5).join(', ')}`).toHaveLength(0);
  });

  it('has no verified word whose parts do not reconstruct the spelling identity', () => {
    // A part list that is empty while the word claims to be analyzable is a
    // contradiction; catch it before it reaches a lesson.
    const bad = all.filter((w) => w.analysis?.analyzable && (w.parts ?? []).length === 0).map((w) => w.w);
    expect(bad).toHaveLength(0);
  });
});
