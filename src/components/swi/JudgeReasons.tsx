/**
 * "Why aren't the other two words real?" — the judge exercise's payload.
 *
 * `whyNot` is authored one line per distractor, in the order the distractors
 * appear in `choices` (the keyed answer is skipped). Showing the reasons only
 * after the learner commits keeps the exercise a test rather than a reading
 * task, but the list is also the point of the item: recognising a plausible
 * non-word needs the reason, not just the verdict.
 */
export function JudgeReasons({
  choices,
  answer,
  whyNot,
}: {
  choices: string[];
  answer: number;
  whyNot: string[];
}) {
  const distractors = choices.map((text, index) => ({ text, index })).filter((row) => row.index !== answer);
  if (distractors.length === 0) return null;

  return (
    <div className="judge-why">
      <div className="tiny faint" style={{ marginBottom: 6 }}>
        为什么另外几个不是词
      </div>
      <ul>
        {distractors.map((row, k) => (
          <li key={`${row.text}-${row.index}`}>
            <span className="judge-word" lang="en">
              {row.text}
            </span>
            <span>{whyNot[k] ?? '这道题没有给出判定依据，请反馈给课程作者。'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
