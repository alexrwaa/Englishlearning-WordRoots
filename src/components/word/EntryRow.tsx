import { Link } from 'react-router-dom';
import type { WordEntry } from '../../lib/types';
import { Badge, Button } from '../ui';
import { domainLabel, posLabel } from './tokens';

/** One row in the dictionary list: spelling, POS, gloss, parts, bookmark. */
export function EntryRow({
  entry,
  bookmarked,
  onToggleBookmark,
}: {
  entry: WordEntry;
  bookmarked: boolean;
  onToggleBookmark: (word: string) => void;
}) {
  return (
    <div className="row-between" style={{ gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
      <Link
        to={`/word/${entry.w}`}
        style={{ color: 'inherit', textDecoration: 'none', flex: 1, minWidth: 0, display: 'block' }}
      >
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="word" style={{ fontSize: 18 }}>
            {entry.w}
          </span>
          {entry.pos ? <Badge>{posLabel(entry.pos)}</Badge> : null}
          {entry.domain ? <Badge tone="accent">{domainLabel(entry.domain)}</Badge> : null}
        </div>
        <div className="small muted" style={{ marginTop: 1 }}>
          {entry.glossZh}
        </div>
        {entry.parts.length > 0 ? (
          <div className="mono tiny faint" style={{ marginTop: 1 }}>
            {entry.parts.join(' + ')}
          </div>
        ) : null}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        aria-label={bookmarked ? `取消收藏 ${entry.w}` : `收藏 ${entry.w}`}
        aria-pressed={bookmarked}
        title={bookmarked ? '取消收藏' : '收藏'}
        style={{ color: bookmarked ? 'var(--amber)' : 'var(--ink-faint)', fontSize: 17, lineHeight: 1 }}
        onClick={() => onToggleBookmark(entry.w)}
      >
        {bookmarked ? '★' : '☆'}
      </Button>
    </div>
  );
}
