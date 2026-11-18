import { Link } from 'react-router-dom';
import { RULE_LABELS, type DerivationStep } from '../../lib/derive';

/**
 * The derivation chain: base -> +affix -> rule -> result, one line per step.
 * The rule is always the engine's own id, translated, so the UI can never
 * invent an explanation the engine did not apply.
 */
export function DerivationChain({
  steps,
  familyId,
  empty = '这个词没有更早的派生步骤：它本身就是词基。',
}: {
  steps: DerivationStep[];
  familyId?: string;
  empty?: string;
}) {
  if (steps.length === 0) {
    return (
      <p className="small faint" style={{ margin: 0 }}>
        {empty}
      </p>
    );
  }

  return (
    <div>
      <ol className="lab-chain" aria-label="派生链">
        {steps.map((step, i) => (
          <li key={`${step.to}-${i}`} className="lab-chain-step">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span className="lab-chain-index mono tiny">{i + 1}</span>
              <span className="lab-chain-from">{step.from}</span>
              <span className="lab-chain-add mono">{step.add}</span>
              <span className="faint" aria-hidden>
                →
              </span>
              <span className="lab-chain-to">{step.to}</span>
            </div>
            <div className="tiny faint" style={{ marginTop: 3, paddingLeft: 22 }}>
              {step.rule ? (RULE_LABELS[step.rule as keyof typeof RULE_LABELS] ?? step.rule) : '—'}
            </div>
          </li>
        ))}
      </ol>
      {familyId ? (
        <div className="tiny" style={{ marginTop: 10 }}>
          <Link to={`/family/${familyId}`} style={{ color: 'var(--accent-ink)' }}>
            查看整个词族 →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
