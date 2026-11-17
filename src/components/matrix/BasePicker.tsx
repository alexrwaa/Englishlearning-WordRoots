import { useMemo, useState } from 'react';
import { Button } from '../ui';
import { filterCandidates, truncate, type BaseCandidate } from './model';

/**
 * Left column: pick the base word/root. Candidates come only from the lexicon,
 * but a manual base is allowed so learners can test their own hypotheses.
 */
export function BasePicker({
  candidates,
  active,
  totalWords,
  onPick,
}: {
  candidates: BaseCandidate[];
  active: string;
  totalWords: number;
  onPick: (form: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const visible = useMemo(() => filterCandidates(candidates, query), [candidates, query]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const form = manual.trim().toLowerCase();
    if (!/^[a-z]{2,}$/.test(form)) {
      setError('请输入 2 个字母以上的英文词基');
      return;
    }
    setError(null);
    setManual('');
    onPick(form);
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h3>选词基</h3>
        <span className="tiny faint mono">{candidates.length} 个</span>
      </div>

      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="按拼写或中文释义搜索"
        aria-label="搜索词基"
        style={{ marginBottom: 8 }}
      />

      <div
        className="grid"
        style={{ gap: 6, maxHeight: 460, overflowY: 'auto', paddingRight: 2 }}
        role="listbox"
        aria-label="可作词基的词条"
      >
        {visible.length === 0 ? (
          <p className="small faint" style={{ margin: '8px 2px' }}>
            没有匹配的词基。可以在下方直接输入一个词基。
          </p>
        ) : (
          visible.map((c) => {
            const isActive = c.form === active;
            return (
              <button
                key={c.form}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onPick(c.form)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 9,
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--line)'}`,
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <span className="row-between" style={{ gap: 8 }}>
                  <span className="serif" style={{ fontSize: 15, fontWeight: 600 }}>
                    {c.form}
                  </span>
                  <span className="tiny faint">{c.family} 词</span>
                </span>
                <span className="row" style={{ gap: 6, marginTop: 3 }}>
                  <span className="tiny faint" style={{ flex: 'none' }}>
                    {c.kindLabel}
                  </span>
                  <span className="tiny faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncate(c.glossZh || '释义未收录', 18)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="divider" style={{ margin: '14px 0' }} />

      <form onSubmit={submitManual}>
        <label className="tiny faint" htmlFor="matrix-manual-base" style={{ display: 'block', marginBottom: 6 }}>
          手动输入一个词基
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="matrix-manual-base"
            className="input"
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              setError(null);
            }}
            placeholder="例：struct / help / port"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" size="sm" variant="primary" style={{ flex: 'none' }}>
            使用
          </Button>
        </div>
        {error ? (
          <p className="tiny" style={{ color: 'var(--red)', margin: '6px 0 0' }}>
            {error}
          </p>
        ) : (
          <p className="tiny faint" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
            词库中不存在也可以试：矩阵会照常生成，但所有组合都会标为未收录。词库共 {totalWords} 条。
          </p>
        )}
      </form>
    </div>
  );
}
