import { Link } from 'react-router-dom';
import { getMorpheme, getWord } from '../../lib/content';
import type { LangOrigin, Morpheme, SourceRef, WordEntry } from '../../lib/types';

/** Shared label maps and small presentational pieces for the word pages. */

export const POS_LABELS: Record<NonNullable<WordEntry['pos']>, string> = {
  n: '名词',
  v: '动词',
  adj: '形容词',
  adv: '副词',
  other: '其他',
};

export function posLabel(pos: WordEntry['pos']): string {
  return pos ? POS_LABELS[pos] : '';
}

export const DOMAIN_LABELS: Record<NonNullable<WordEntry['domain']>, string> = {
  robotics: '机器人',
  slam: 'SLAM',
  sensor: '传感器',
  cs: '计算机',
  ai: '人工智能',
  science: '科学',
  general: '通用',
};

export function domainLabel(domain: WordEntry['domain']): string {
  return domain ? DOMAIN_LABELS[domain] : '';
}

export const ORIGIN_LABELS: Record<LangOrigin, string> = {
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
  unknown: '来源未知',
};

export function originLabel(origin: LangOrigin): string {
  return ORIGIN_LABELS[origin];
}

export const TYPE_LABELS: Record<Morpheme['type'], string> = {
  prefix: '前缀',
  root: '词根',
  suffix: '后缀',
  combining: '组合形式',
};

export const TYPE_TONES: Record<Morpheme['type'], 'default' | 'accent' | 'amber' | 'green'> = {
  prefix: 'amber',
  root: 'accent',
  suffix: 'green',
  combining: 'accent',
};

export function typeLabel(type: Morpheme['type']): string {
  return TYPE_LABELS[type];
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function SourceList({ sources }: { sources?: SourceRef[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div>
      <div className="tiny faint" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        来源
      </div>
      <ul className="small muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {sources.map((s) => (
          <li key={`${s.id}-${s.title}`} style={{ marginBottom: 4 }}>
            <span className="mono tiny" style={{ color: 'var(--accent-ink)' }}>
              {s.id}
            </span>{' '}
            {s.title}
            {s.detail ? <span className="faint"> · {s.detail}</span> : null}
            {s.url ? (
              <>
                {' '}
                <a href={s.url} target="_blank" rel="noreferrer" className="tiny">
                  链接
                </a>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Example words: link into the dictionary when the form is a known entry. */
export function ExampleWords({ forms, onNavigate }: { forms: string[]; onNavigate?: () => void }) {
  if (forms.length === 0) return null;
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {forms.map((form) => {
        const entry = getWord(form);
        if (entry) {
          return (
            <Link key={form} to={`/word/${entry.w}`} onClick={onNavigate} className="chip">
              <span className="word">{entry.w}</span>
              <span className="tiny faint">{entry.glossZh}</span>
            </Link>
          );
        }
        return (
          <span key={form} className="chip" style={{ cursor: 'default' }}>
            <span className="word">{form}</span>
            <span className="tiny faint">未收录</span>
          </span>
        );
      })}
    </div>
  );
}

/** Word parts rendered as chips that open the morpheme panel. */
export function PartChips({ parts, onPick }: { parts: string[]; onPick: (form: string) => void }) {
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {parts.map((part) => {
        const m = getMorpheme(part);
        return (
          <button
            key={part}
            type="button"
            className="chip"
            onClick={() => onPick(part)}
            title={m ? `${typeLabel(m.type)} · ${m.glossZh}` : '词典尚未收录该词素'}
          >
            <span className="mono" style={{ fontSize: 13 }}>
              {part}
            </span>
            <span className="tiny faint">{m ? m.glossZh : '未收录'}</span>
          </button>
        );
      })}
    </div>
  );
}
