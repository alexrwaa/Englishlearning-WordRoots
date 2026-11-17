import { useEffect, useState } from 'react';
import { getMorpheme, stripDashes } from '../../lib/content';
import { Badge, Modal } from '../ui';
import { RichText } from '../RichText';
import { NoteEditor } from './NoteEditor';
import { ExampleWords, SourceList, TYPE_TONES, originLabel, typeLabel } from './tokens';

/**
 * Body of a morpheme dossier. Used by the modal on the word pages and inline
 * inside the knowledge library. Never invents content: an unknown form gets an
 * explicit "not collected yet" state.
 */
export function MorphemeDetail({
  form,
  onPick,
  onNavigate,
}: {
  form: string;
  onPick: (form: string) => void;
  onNavigate?: () => void;
}) {
  const m = getMorpheme(form);
  if (!m) {
    return (
      <div>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 650 }}>
            {stripDashes(form)}
          </span>
          <Badge tone="amber">词典未收录</Badge>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          词典尚未收录该词素。构词分析里的这一部分暂时没有释义、变体与来源——我们不用推测把空缺填满。
        </p>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <Badge tone={TYPE_TONES[m.type]}>{typeLabel(m.type)}</Badge>
        <Badge>{originLabel(m.origin)}</Badge>
        <span className="small" style={{ fontWeight: 600 }}>
          {m.glossZh}
        </span>
      </div>

      {m.glossEn ? (
        <div className="small muted" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
          {m.glossEn}
        </div>
      ) : null}

      {m.allomorphs && m.allomorphs.length > 0 ? (
        <div>
          <div className="tiny faint">变体形式</div>
          <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
            {m.allomorphs.map((alt) => (
              <span key={alt} className="chip" style={{ cursor: 'pointer' }} onClick={() => onPick(alt)} role="button" tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onPick(alt);
                }}
              >
                <span className="mono tiny">{alt}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {m.examples.length > 0 ? (
        <div>
          <div className="tiny faint">例词</div>
          <div style={{ marginTop: 6 }}>
            <ExampleWords forms={m.examples} onNavigate={onNavigate} />
          </div>
        </div>
      ) : null}

      {m.note ? (
        <div>
          <div className="tiny faint">说明</div>
          <RichText text={m.note} onMorpheme={(_, f) => onPick(f)} className="small" />
        </div>
      ) : null}

      <SourceList sources={m.sources} />

      <div className="divider" style={{ margin: '4px 0' }} />
      <NoteEditor targetType="morpheme" targetId={m.form} label="我的词素笔记" compact />
    </div>
  );
}

export function MorphemeModal({
  form,
  onClose,
}: {
  form: string | null;
  onClose: () => void;
}) {
  const [active, setActive] = useState(form ?? '');

  useEffect(() => {
    if (form) setActive(form);
  }, [form]);

  const m = getMorpheme(active);
  const title = m ? `${m.form} · ${typeLabel(m.type)}` : stripDashes(active);

  return (
    <Modal open={Boolean(form)} onClose={onClose} title={title}>
      <MorphemeDetail form={active} onPick={setActive} onNavigate={onClose} />
    </Modal>
  );
}
