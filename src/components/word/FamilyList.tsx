import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { allWords, stripDashes } from '../../lib/content';
import type { WordEntry } from '../../lib/types';
import { Badge, Button } from '../ui';
import { posLabel } from './tokens';

const INITIAL_VISIBLE = 8;

/** Words that share at least one morpheme with the current entry. */
export function FamilyList({ entry }: { entry: WordEntry }) {
  const [expanded, setExpanded] = useState(false);

  const family = useMemo(() => {
    const own = new Set(entry.parts.map((p) => stripDashes(p)));
    return allWords()
      .filter((w) => w.w !== entry.w)
      .map((w) => ({ word: w, shared: w.parts.filter((p) => own.has(stripDashes(p))) }))
      .filter((x) => x.shared.length > 0)
      .sort((a, b) => b.shared.length - a.shared.length || a.word.w.localeCompare(b.word.w));
  }, [entry]);

  if (family.length === 0) {
    return <p className="small faint" style={{ margin: 0 }}>词库中暂时没有与它共享词素的其他词条。</p>;
  }

  const visible = expanded ? family : family.slice(0, INITIAL_VISIBLE);

  return (
    <div>
      <div className="tiny faint" style={{ marginBottom: 2 }}>
        {family.length} 个词条与本词共享词素，共享越多越靠前。
      </div>
      {visible.map(({ word, shared }) => (
        <Link
          key={word.w}
          to={`/word/${word.w}`}
          style={{ color: 'inherit', textDecoration: 'none', display: 'block', padding: '7px 0', borderBottom: '1px solid var(--line)' }}
        >
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="word" style={{ fontSize: 16 }}>
              {word.w}
            </span>
            {word.pos ? <Badge>{posLabel(word.pos)}</Badge> : null}
            <span className="small muted">{word.glossZh}</span>
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 2 }}>
            <span className="mono tiny faint">{word.parts.join(' + ')}</span>
            <span className="tiny faint">· 共享 {shared.join(' + ')}</span>
          </div>
        </Link>
      ))}
      {family.length > INITIAL_VISIBLE ? (
        <div style={{ marginTop: 10 }}>
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? '收起' : `显示全部 ${family.length} 个`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
