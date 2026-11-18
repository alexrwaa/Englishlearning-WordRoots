import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Panel } from '../ui';
import { getMorpheme, getWord } from '../../lib/content';
import {
  BLOCK_LABELS,
  familyBaseForm,
  familyIdOf,
  rootIndexOf,
  type CellVerdict,
  type DerivationStep,
} from '../../lib/derive';
import { useApp } from '../../lib/store';
import type { WordEntry } from '../../lib/types';
import { POS_LABEL } from '../matrix/model';
import { PRACTICE_QUEUE_KEY } from '../matrix/WordDetail';
import { DerivationChain } from './DerivationChain';
import { StateBadge } from './LabGrid';

export interface LabSelection {
  /** The row's word (a base or a verified derivative). */
  word: string;
  affix: string;
  kind: 'prefix' | 'suffix';
  verdict: CellVerdict;
  /** Steps from the family base to the row, then the step this cell adds. */
  chain: DerivationStep[];
}

function readQueue(): string[] {
  try {
    const raw = localStorage.getItem(PRACTICE_QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const POSSIBILITIES = [
  '词库尚未收录：词条是分批补的，罕见词、专业词常常还没进来。',
  '它可能不是派生词：单纯词、借词、拟声词无法按词素切开。',
  '它可能是拼写变体：屈折形式或某词的变体，而不是新的派生词。',
];

/** Right-hand panel: what the selected cell means, and the chain that built it. */
export function LabDetail({ selection }: { selection: LabSelection | null }) {
  const { toast } = useApp();
  const [queue, setQueue] = useState<string[]>(() => readQueue());

  if (!selection) {
    return (
      <Panel style={{ height: '100%' }}>
        <h3 style={{ marginBottom: 8 }}>这一格是什么</h3>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.7 }}>
          在左边的网格里点任意一格：这里会展开「词基 → 加成分 → 规则 → 结果」的派生链，
          并说明这一格是已收录、未收录，还是被构词规则排除。
        </p>
      </Panel>
    );
  }

  const { verdict, word, affix, kind } = selection;
  const entry: WordEntry | undefined = verdict.state === 'verified' ? getWord(verdict.word) : undefined;
  const familyId = entry ? familyIdOf(entry.parts[rootIndexOf(entry.parts)]) : familyIdOf(word);
  const familyForm = familyId ? familyBaseForm(familyId) : undefined;

  function addToQueue() {
    if (!entry) return;
    if (queue.includes(entry.w)) {
      toast(`${entry.w} 已在练习队列中`, 'info');
      return;
    }
    const next = [...queue, entry.w];
    try {
      localStorage.setItem(PRACTICE_QUEUE_KEY, JSON.stringify(next));
      setQueue(next);
      toast(`已加入练习队列：${entry.w}`, 'success');
    } catch {
      toast('无法写入本地练习队列，请检查浏览器存储权限', 'warn');
    }
  }

  return (
    <Panel style={{ height: '100%' }}>
      <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <StateBadge state={verdict.state} />
        {entry?.pos ? <Badge tone="accent">{POS_LABEL[entry.pos] ?? entry.pos}</Badge> : null}
        <Badge className="mono">{kind === 'prefix' ? `${affix}-` : `-${affix}`}</Badge>
      </div>

      <div className="word" style={{ fontSize: 26, lineHeight: 1.25 }}>
        {verdict.word}
      </div>
      <div className="tiny faint mono" style={{ marginTop: 4 }}>
        {word} {kind === 'prefix' ? `+ ${affix}-` : `+ -${affix}`}
      </div>

      {entry ? (
        <>
          <p className="small muted" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>
            {entry.glossZh}
          </p>
          {entry.glossEn ? (
            <p className="tiny faint" style={{ margin: '4px 0 0' }}>
              {entry.glossEn}
            </p>
          ) : null}
        </>
      ) : verdict.state === 'rule-blocked' ? (
        <p className="small muted" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>
          这一格被构词规则排除，原因见下方。
        </p>
      ) : (
        <p className="small" style={{ margin: '10px 0 0', lineHeight: 1.7, color: 'var(--amber)' }}>
          {verdict.reason ?? '词库未收录这个词。'}
        </p>
      )}

      <div className="divider" />

      <div className="tiny faint" style={{ marginBottom: 8 }}>
        派生链
      </div>
      <DerivationChain steps={selection.chain} familyId={familyId} />

      {verdict.state === 'rule-blocked' ? (
        <>
          <div className="divider" />
          <div className="tiny faint" style={{ marginBottom: 6 }}>
            为什么这一格不成立
          </div>
          <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <Badge tone="red">{BLOCK_LABELS[verdict.rule as keyof typeof BLOCK_LABELS] ?? verdict.rule}</Badge>
          </div>
          <p className="small" style={{ margin: 0, lineHeight: 1.7 }}>
            {verdict.reason}
          </p>
          <p className="tiny faint" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>
            规则挡住的格子是信息：它说明英语的构词顺序有约束，而不是词库漏收了。
          </p>
        </>
      ) : null}

      {verdict.state === 'unknown' ? (
        <>
          <div className="divider" />
          <div className="tiny faint" style={{ marginBottom: 6 }}>
            未收录的三种可能
          </div>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {POSSIBILITIES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="tiny faint" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>
            「未收录」是一个关于词库的说法，不是一个关于英语的说法。
          </p>
        </>
      ) : null}

      {entry ? (
        <>
          <div className="divider" />
          <div className="tiny faint" style={{ marginBottom: 6 }}>
            词素拆解
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {entry.parts.map((part) => {
              const m = getMorpheme(part);
              return (
                <span key={part} className="chip" style={{ cursor: 'default' }} title={m ? m.glossZh : '词库未收录该词素'}>
                  <span className="mono">{part}</span>
                  <span className="tiny faint">{m ? m.glossZh : '未收录'}</span>
                </span>
              );
            })}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" size="sm" onClick={addToQueue}>
              加入练习队列
            </Button>
            {familyId ? (
              <Link to={`/family/${familyId}`} className="btn btn-sm">
                词族{familyForm ? `：${familyForm}` : ''}
              </Link>
            ) : null}
            <Link to={`/word/${entry.w}`} className="btn btn-sm">
              词源词典
            </Link>
          </div>
          <p className="tiny faint" style={{ margin: '8px 0 0' }}>
            队列中共 {queue.length} 个词
          </p>
        </>
      ) : (
        <>
          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link to={`/explore?word=${encodeURIComponent(verdict.word)}`} className="btn btn-sm">
              在词族探究里拆开它
            </Link>
            {familyId ? (
              <Link to={`/family/${familyId}`} className="btn btn-sm">
                看它的词族
              </Link>
            ) : null}
          </div>
        </>
      )}
    </Panel>
  );
}
