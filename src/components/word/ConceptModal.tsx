import { Badge, Modal } from '../ui';
import { getConcept } from '../../lib/content';
import { RichText } from '../RichText';
import { SourceList } from './tokens';

const KIND_LABELS: Record<'concept' | 'rule' | 'method', string> = {
  concept: '概念',
  rule: '规则',
  method: '方法',
};

/** Read-only concept dossier, opened from word entries and the library. */
export function ConceptModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const c = id ? getConcept(id) : undefined;
  return (
    <Modal open={Boolean(id)} onClose={onClose} title={c ? c.zh : id ?? ''}>
      {c ? (
        <div className="col" style={{ gap: 12 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <Badge tone="accent">{KIND_LABELS[c.kind]}</Badge>
            <span className="small faint" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
              {c.en}
            </span>
          </div>
          <p className="small" style={{ margin: 0 }}>
            {c.summary}
          </p>
          {c.detail ? <RichText text={c.detail} className="small" /> : null}
          <SourceList sources={c.sources} />
        </div>
      ) : (
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <Badge tone="amber">未收录</Badge>
            <span className="mono small">{id}</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            词条标记了这个概念，但词典尚未收录它的说明。
          </p>
        </div>
      )}
    </Modal>
  );
}
