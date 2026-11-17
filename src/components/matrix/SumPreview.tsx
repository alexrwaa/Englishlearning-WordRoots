import { getMorpheme } from '../../lib/content';

/**
 * Word-sum notation: un + help + ful → unhelpful.
 * Every morpheme is a button so the caller can open its entry.
 */
export function SumPreview({
  parts,
  result,
  onMorpheme,
}: {
  parts: string[];
  result?: string;
  onMorpheme?: (form: string) => void;
}) {
  return (
    <span className="sum">
      {parts.map((part, i) => {
        const morpheme = getMorpheme(part);
        const kind =
          morpheme?.type === 'prefix' ? 'morph-prefix' : morpheme?.type === 'suffix' ? 'morph-suffix' : '';
        return (
          <span key={`${part}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {i > 0 ? <span className="sum-arrow">+</span> : null}
            {onMorpheme ? (
              <span
                className={`morph ${kind}`}
                role="button"
                tabIndex={0}
                onClick={() => onMorpheme(part)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onMorpheme(part);
                  }
                }}
                title={morpheme ? `${morpheme.form}：${morpheme.glossZh}` : '词库中未收录该词素'}
              >
                {part}
              </span>
            ) : (
              <span className={`morph ${kind}`}>{part}</span>
            )}
          </span>
        );
      })}
      {result ? (
        <>
          <span className="sum-arrow">→</span>
          <span className="sum-result">{result}</span>
        </>
      ) : null}
    </span>
  );
}
