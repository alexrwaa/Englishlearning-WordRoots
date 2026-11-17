import { Badge, Modal } from '../ui';
import { getMorpheme } from '../../lib/content';
import type { LangOrigin, Morpheme, TermGloss } from '../../lib/types';

const TYPE_LABEL: Record<Morpheme['type'], string> = {
  prefix: '前缀',
  root: '词根',
  suffix: '后缀',
  combining: '组合形式',
};

const ORIGIN_LABEL: Record<LangOrigin, string> = {
  OE: '古英语',
  ME: '中古英语',
  Lat: '拉丁语',
  Gk: '希腊语',
  Fr: '法语',
  Norse: '古诺斯语',
  It: '意大利语',
  Sp: '西班牙语',
  Ger: '德语',
  Ar: '阿拉伯语',
  unknown: '来源不详',
};

/** Morpheme detail sheet. `form === null` keeps the dialog closed. */
export function MorphemeModal({ form, onClose }: { form: string | null; onClose: () => void }) {
  const morpheme = form ? getMorpheme(form) : undefined;

  return (
    <Modal open={form !== null} onClose={onClose} title={morpheme ? morpheme.form : (form ?? '')}>
      {!morpheme ? (
        <div className="col" style={{ gap: 10 }}>
          <p className="muted small" style={{ margin: 0 }}>
            词典尚未收录 “{form}”。它可能是一个自由词素（如 help、kind），也可能只是本课临时出现的拼写片段。
          </p>
          <p className="tiny faint" style={{ margin: 0 }}>
            未收录不代表它不存在：词素条目由内容库维护，只有通过来源核对的条目才会进入词典。
          </p>
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <Badge tone="accent">{TYPE_LABEL[morpheme.type]}</Badge>
            <Badge>{ORIGIN_LABEL[morpheme.origin]}</Badge>
          </div>
          <div>
            <div className="serif" style={{ fontSize: 20 }}>
              {morpheme.glossZh}
            </div>
            <div className="small muted">{morpheme.glossEn}</div>
          </div>
          {morpheme.allomorphs && morpheme.allomorphs.length > 0 ? (
            <div className="small">
              变体：<span className="mono">{morpheme.allomorphs.join(' / ')}</span>
            </div>
          ) : null}
          <div className="small">
            例词：<span className="word">{morpheme.examples.join(', ')}</span>
          </div>
          {morpheme.note ? (
            <p className="small muted" style={{ margin: 0 }}>
              {morpheme.note}
            </p>
          ) : null}
          {morpheme.sources.length > 0 ? (
            <div className="tiny faint">
              来源：{morpheme.sources.map((s) => s.title).join('；')}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/** Glossary popover for a term used in a card. */
export function TermModal({ term, onClose }: { term: TermGloss | null; onClose: () => void }) {
  return (
    <Modal open={term !== null} onClose={onClose} title={term?.term ?? ''}>
      {term ? (
        <div className="col" style={{ gap: 10 }}>
          <div>
            <div className="serif" style={{ fontSize: 20 }}>
              {term.zh}
            </div>
            {term.en ? <div className="small muted">{term.en}</div> : null}
          </div>
          {term.note ? (
            <p className="small" style={{ margin: 0 }}>
              {term.note}
            </p>
          ) : (
            <p className="tiny faint" style={{ margin: 0 }}>
              本课只在上下文中使用这个术语，没有额外的定义说明。
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
