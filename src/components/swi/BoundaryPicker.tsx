import { Fragment } from 'react';
import { boundaryCuts } from '../../lib/answer';

/**
 * Split a word by hand.
 *
 * The word is rendered letter by letter with a real `<button class="cut">` in
 * every gap, so the interaction is a plain toggle: Tab moves between gaps,
 * Enter/Space cuts. Screen readers get the two letters on either side in the
 * label instead of "button" × 12.
 *
 * Once judged, the gaps carry their verdict: `correct` (cut and should be),
 * `wrong` (cut and should not be), `missed` (should be and was not). That is the
 * "which cut went wrong" highlight; the wording lives in `checkBoundary`.
 */
export function BoundaryPicker({
  word,
  segments,
  cuts,
  judged,
  onToggle,
}: {
  word: string;
  segments: string[];
  cuts: number[];
  judged: boolean;
  onToggle: (cut: number) => void;
}) {
  const letters = [...word];
  const expected = new Set(boundaryCuts(segments));
  const chosen = new Set(cuts);

  const gapState = (gap: number): 'correct' | 'wrong' | 'missed' | undefined => {
    if (!judged) return undefined;
    const cut = chosen.has(gap);
    const should = expected.has(gap);
    if (cut && should) return 'correct';
    if (cut && !should) return 'wrong';
    if (!cut && should) return 'missed';
    return undefined;
  };

  return (
    <div className="cut-word" role="group" aria-label={`切分单词 ${word}`} lang="en">
      {letters.map((letter, i) => (
        <Fragment key={`${letter}-${i}`}>
          <span className="cut-letter">{letter}</span>
          {i < letters.length - 1 ? (
            <button
              type="button"
              className="cut"
              data-state={gapState(i)}
              aria-pressed={chosen.has(i)}
              aria-label={`在第 ${i + 1} 个字母 ${letters[i]} 与第 ${i + 2} 个字母 ${letters[i + 1]} 之间切分`}
              disabled={judged}
              onClick={(e) => {
                // A pointer click drops focus so Enter submits the split; a
                // keyboard "click" (detail 0) keeps focus so Tab/Enter can
                // keep walking the gaps.
                if (e.detail > 0) e.currentTarget.blur();
                onToggle(i);
              }}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
