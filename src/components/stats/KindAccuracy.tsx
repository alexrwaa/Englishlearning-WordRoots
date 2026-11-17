import { Bar } from '../ui';

export interface KindRow {
  kind: string;
  label: string;
  correct: number;
  total: number;
}

/** Per-exercise-type accuracy with a bar; types without attempts say so. */
export default function KindAccuracy({ rows }: { rows: KindRow[] }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      {rows.map((row, i) => {
        const pct = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
        return (
          <div
            key={row.kind}
            style={{
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--line)',
            }}
          >
            <div className="row-between" style={{ marginBottom: row.total > 0 ? 6 : 0 }}>
              <span style={{ fontSize: 14, fontWeight: 550 }}>{row.label}</span>
              {row.total > 0 ? (
                <span className="small muted mono">
                  {row.correct}/{row.total} · {pct}%
                </span>
              ) : (
                <span className="tiny faint">暂无记录</span>
              )}
            </div>
            {row.total > 0 ? <Bar value={pct} /> : null}
          </div>
        );
      })}
    </div>
  );
}
