import { Link } from 'react-router-dom';
import { Badge } from '../ui';

export interface WeakItem {
  /** cardId, unique per memory card. */
  id: string;
  label: string;
  lapses: number;
  /** FSRS stability in days, already rounded. */
  stability: number;
  kind: '记忆' | '迁移';
}

/**
 * Knowledge that keeps slipping: each row links to the library so the learner
 * can re-read the entry instead of only re-drilling the card.
 */
export default function WeakList({ items }: { items: WeakItem[] }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {items.map((item) => (
        <Link
          key={item.id}
          to="/library"
          title="在知识库中查看"
          className="row-between"
          style={{
            gap: 12,
            padding: '9px 12px',
            border: '1px solid var(--line)',
            borderRadius: 10,
            background: 'var(--panel-2)',
            color: 'var(--ink)',
          }}
        >
          <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge tone={item.kind === '迁移' ? 'amber' : 'default'}>{item.kind}</Badge>
            <span style={{ fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </span>
          <span className="row" style={{ gap: 8, flex: 'none' }}>
            <span className="tiny" style={{ color: 'var(--red)' }}>
              失误 {item.lapses} 次
            </span>
            <span className="tiny faint mono">稳定 {item.stability} 天</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
