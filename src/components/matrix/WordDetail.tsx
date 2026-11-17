import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Modal, Panel } from '../ui';
import { getMorpheme } from '../../lib/content';
import { buildWord, explainSum, formatWordSum, type SpellingStep } from '../../lib/morph';
import { useApp } from '../../lib/store';
import type { Morpheme, WordEntry } from '../../lib/types';
import { POS_LABEL, originLabel } from './model';
import { SumPreview } from './SumPreview';

export const PRACTICE_QUEUE_KEY = 'wordroots.matrix.practice';

const TYPE_LABEL: Record<Morpheme['type'], string> = {
  prefix: '前缀',
  root: '词根',
  suffix: '后缀',
  combining: '组合形式',
};

const DOMAIN_LABEL: Record<string, string> = {
  robotics: '机器人',
  slam: '建图与定位',
  sensor: '传感器',
  cs: '计算机',
  ai: '人工智能',
  science: '科学',
  general: '通用',
};

/** Engine rules are English; show a Chinese gloss with the original in small type. */
const RULE_ZH: Record<string, string> = {
  'prefix ends with the base’s first letter; keep both letters': '前缀末字母与词基首字母相同：两个字母都保留',
  'final y becomes i before a suffix that does not start with i': '词尾 y 在非 i 开头的后缀前变成 i',
  'silent e drops before a vowel-initial suffix': '不发音的 e 在元音开头的后缀前脱落',
  'final consonant doubles to keep the short vowel': '词尾辅音双写，以保持前面的短元音',
  'suffix attached': '后缀接入，拼写不变',
  'surface spelling differs from a plain concatenation; this form must be learned as a whole':
    '表面拼写与直接拼接不同，这个形式需要整体记忆',
};

function readQueue(): string[] {
  try {
    const raw = localStorage.getItem(PRACTICE_QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // A corrupt queue must never break the page; start a fresh one on next add.
    return [];
  }
}

export interface MatrixSelection {
  prefix: string;
  suffix: string;
  entry: WordEntry;
}

export function WordDetail({
  selection,
  base,
  family,
  onPick,
}: {
  selection: MatrixSelection | null;
  base: string;
  family: WordEntry[];
  onPick: (entry: WordEntry) => void;
}) {
  const { toast } = useApp();
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>(() => readQueue());

  const entry = selection?.entry ?? null;

  const built = useMemo(
    () => (selection ? buildWord(selection.prefix, base, selection.suffix) : null),
    [selection, base],
  );
  // True when this exact matrix cell reproduces the selected spelling.
  const fromCell = Boolean(built && entry && built.entry?.w === entry.w);

  const steps = useMemo<SpellingStep[]>(() => {
    if (!selection || !entry || !built) return [];
    return fromCell ? built.steps : explainSum(entry.parts, entry.w);
  }, [selection, entry, built, fromCell]);

  const morpheme = openForm ? getMorpheme(openForm) : undefined;

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

  if (!entry || !selection) {
    return (
      <Panel style={{ height: '100%' }}>
        <h3 style={{ marginBottom: 8 }}>词条详情</h3>
        <EmptyState title="还没有选中组合" body="在中间的矩阵里点击任意一个实词格子，这里会显示构词算式、拼写变化与同族词。" />
      </Panel>
    );
  }

  const inMatrix = built?.word ?? entry.w;

  return (
    <Panel style={{ height: '100%' }}>
      <div className="row" style={{ gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        {entry.pos ? <Badge tone="accent">{POS_LABEL[entry.pos] ?? entry.pos}</Badge> : <Badge>词性未标注</Badge>}
        {entry.domain ? <Badge>{DOMAIN_LABEL[entry.domain] ?? entry.domain}</Badge> : null}
        {entry.parts.length <= 1 ? <Badge>不可再分</Badge> : null}
      </div>

      <div className="word" style={{ fontSize: 27, lineHeight: 1.25 }}>
        {entry.w}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>
        {entry.glossZh}
      </p>
      {entry.glossEn ? (
        <p className="tiny faint" style={{ margin: '4px 0 0', lineHeight: 1.6 }}>
          {entry.glossEn}
        </p>
      ) : null}

      <div className="divider" />

      <div className="tiny faint" style={{ marginBottom: 8 }}>
        构词算式
      </div>
      <div role="group" aria-label={`构词算式：${formatWordSum(entry.parts, entry.w)}`}>
        <SumPreview parts={entry.parts} result={entry.w} onMorpheme={setOpenForm} />
      </div>
      {fromCell ? (
        <p className="tiny faint" style={{ margin: '8px 0 0' }}>
          这一格由 {selection.prefix ? `${selection.prefix} + ` : ''}
          {base}
          {selection.suffix ? ` + ${selection.suffix}` : ''} 拼成（{inMatrix}）。点击词素查看释义与来源。
        </p>
      ) : (
        <p className="tiny faint" style={{ margin: '8px 0 0' }}>
          这个词由更多词素构成，不在当前矩阵的单格内；上面显示的是它自身的构词算式。
        </p>
      )}

      <div className="divider" />

      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="tiny faint">拼写变化</span>
        <span className="tiny faint">{steps.length} 步</span>
      </div>
      {steps.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          直接拼接，拼写无需调整。
        </p>
      ) : (
        <div>
          {steps.map((step, i) => (
            <div
              key={`${step.rule}-${i}`}
              style={{
                padding: '8px 0',
                borderBottom: i === steps.length - 1 ? 'none' : '1px solid var(--line)',
              }}
            >
              <div className="small">{RULE_ZH[step.rule] ?? step.rule}</div>
              {RULE_ZH[step.rule] ? (
                <div className="tiny faint" style={{ marginTop: 2 }}>
                  {step.rule}
                </div>
              ) : null}
              <div className="mono tiny" style={{ marginTop: 3, color: 'var(--ink-soft)' }}>
                {step.before} → {step.after}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="divider" />

      <Button variant="primary" block onClick={addToQueue}>
        加入练习队列
      </Button>
      <p className="tiny faint" style={{ margin: '6px 0 0', textAlign: 'center' }}>
        队列中共 {queue.length} 个词（存在本机，key: {PRACTICE_QUEUE_KEY}）
      </p>

      <div className="divider" />

      <div className="tiny faint" style={{ marginBottom: 8 }}>
        同族词（共享任一词素，最多 12 个）
      </div>
      {family.length === 0 ? (
        <p className="small faint" style={{ margin: 0 }}>
          词库中暂无共享词素的其他词条。
        </p>
      ) : (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {family.map((w) => (
            <button key={w.w} type="button" className="chip" onClick={() => onPick(w)} title={w.glossZh}>
              {w.w}
            </button>
          ))}
        </div>
      )}

      <Modal
        open={openForm !== null}
        onClose={() => setOpenForm(null)}
        title={morpheme ? `${morpheme.form}（${TYPE_LABEL[morpheme.type]}）` : openForm ?? ''}
      >
        {morpheme ? (
          <div>
            <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <Badge tone="accent">{TYPE_LABEL[morpheme.type]}</Badge>
              <Badge>{originLabel(morpheme.origin)}</Badge>
              {morpheme.allomorphs?.length ? (
                <Badge>变体 {morpheme.allomorphs.join(' / ')}</Badge>
              ) : null}
            </div>
            <p style={{ margin: '0 0 6px' }}>{morpheme.glossZh}</p>
            <p className="small muted" style={{ margin: '0 0 12px' }}>
              {morpheme.glossEn}
            </p>
            {morpheme.note ? <p className="small" style={{ margin: '0 0 12px', lineHeight: 1.7 }}>{morpheme.note}</p> : null}
            <div className="tiny faint" style={{ marginBottom: 4 }}>
              例词
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {morpheme.examples.map((ex) => (
                <span key={ex} className="word small">
                  {ex}
                </span>
              ))}
            </div>
            {morpheme.sources.length ? (
              <>
                <div className="tiny faint" style={{ marginBottom: 4 }}>
                  来源
                </div>
                <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                  {morpheme.sources.map((s) => (
                    <li key={`${s.id}-${s.title}`}>
                      {s.title}
                      {s.detail ? `｜${s.detail}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            词库中尚未收录「{openForm}」的释义与来源。矩阵仍可把它当作组合成分使用，但这一成分的意义需要另行查证。
          </p>
        )}
      </Modal>
    </Panel>
  );
}
