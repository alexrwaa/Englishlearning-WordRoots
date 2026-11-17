import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Modal, Panel } from '../ui';
import { checkWordSum } from '../../lib/morph';
import { getWord } from '../../lib/content';
import { useApp } from '../../lib/store';
import { PRACTICE_QUEUE_KEY } from './WordDetail';

interface AttemptState {
  word: string;
  input: string;
  correct: boolean | null;
  steps: { rule: string; before: string; after: string }[];
}

function readQueue(): string[] {
  try {
    const raw = localStorage.getItem(PRACTICE_QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeQueue(list: string[]) {
  try {
    localStorage.setItem(PRACTICE_QUEUE_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the queue is a convenience, not the record of truth */
  }
}

/**
 * Turns the matrix's "加入练习队列" words into an actual exercise: write the word
 * sum for a word the learner picked themselves. Results are recorded through the
 * normal attempt pipeline, so they show up in statistics like any other answer.
 */
export function PracticeQueue({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { recordAttempt } = useApp();
  const [queue, setQueue] = useState<string[]>(() => readQueue());
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<AttemptState[]>([]);
  const [draft, setDraft] = useState('');
  const [startedAt, setStartedAt] = useState(() => Date.now());

  // The modal stays mounted, so re-read the queue whenever it is opened.
  useEffect(() => {
    if (!open) return;
    setQueue(readQueue());
    setIndex(0);
    setDraft('');
    setAttempts([]);
    setStartedAt(Date.now());
  }, [open]);

  const currentWord = queue[index];
  const entry = useMemo(() => (currentWord ? getWord(currentWord) : undefined), [currentWord]);
  const attempt = attempts.find((a) => a.word === currentWord);

  function reset() {
    setQueue(readQueue());
    setIndex(0);
    setAttempts([]);
    setDraft('');
    setStartedAt(Date.now());
  }

  async function submit() {
    if (!entry || !currentWord) return;
    const parts = draft
      .split(/[+＋]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const result = checkWordSum(parts, entry.w);
    const correct = result.ok || parts.join('').toLowerCase() === entry.w.toLowerCase();
    setAttempts((prev) => [
      ...prev.filter((a) => a.word !== currentWord),
      { word: currentWord, input: draft, correct, steps: result.steps },
    ]);
    await recordAttempt({
      lessonId: 'matrix',
      exercise: {
        id: `matrix-${entry.w}`,
        kind: 'wordSum',
        prompt: `写出 ${entry.w} 的构词算式`,
        parts: entry.parts,
        answer: entry.w,
        explain: `${entry.parts.join(' + ')} → ${entry.w}（${entry.glossZh}）`,
        concepts: entry.parts,
      },
      correct,
      durationMs: Date.now() - startedAt,
      phase: 'practice',
      answer: draft,
    });
  }

  function next() {
    setDraft('');
    setStartedAt(Date.now());
    if (index + 1 < queue.length) setIndex(index + 1);
  }

  function drop(word: string) {
    const nextQueue = queue.filter((w) => w !== word);
    writeQueue(nextQueue);
    setQueue(nextQueue);
    setAttempts((prev) => prev.filter((a) => a.word !== word));
    if (index >= nextQueue.length) setIndex(Math.max(0, nextQueue.length - 1));
  }

  const done = attempts.length;
  const correctCount = attempts.filter((a) => a.correct).length;

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="练习队列"
      footer={
        <div className="row-between">
          <span className="tiny faint">
            来自构词实验室的 {queue.length} 个词 · 已完成 {done}
            {done > 0 ? ` · 正确 ${correctCount}` : ''}
          </span>
          <Button size="sm" variant="ghost" onClick={reset}>
            重新载入队列
          </Button>
        </div>
      }
    >
      {queue.length === 0 ? (
        <EmptyState
          title="队列里还没有词"
          body="在构词实验室里选中一个真实存在的词，点「加入练习队列」，它就会出现在这里，用来默写构词算式。"
        />
      ) : !entry ? (
        <EmptyState title="该词不在词库中" body={`${currentWord} 无法解析词素，已从队列移除。`} action={<Button onClick={() => drop(currentWord)}>移除</Button>} />
      ) : (
        <div className="col" style={{ gap: 14 }}>
          <div className="row-between">
            <div>
              <div className="eyebrow">第 {index + 1} / {queue.length} 个</div>
              <h2 className="serif" style={{ fontStyle: 'italic' }}>{entry.w}</h2>
              <div className="small muted">{entry.glossZh}</div>
            </div>
            <Badge tone="accent">{entry.parts.length} 个词素</Badge>
          </div>

          <Panel flat>
            <div className="small muted" style={{ marginBottom: 8 }}>
              不看提示，写出它的构词算式（用 <span className="mono">+</span> 连接，例如 un + help + ful）。
            </div>
            <div className="row">
              <input
                className="input"
                placeholder="输入构词算式"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && attempt?.correct !== true) void submit();
                }}
                disabled={Boolean(attempt)}
                autoFocus
              />
              {attempt ? (
                <Button variant="primary" onClick={next} disabled={index + 1 >= queue.length}>
                  下一个
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void submit()} disabled={!draft.trim()}>
                  检查
                </Button>
              )}
            </div>
          </Panel>

          {attempt ? (
            <div className={`feedback ${attempt.correct ? 'ok' : 'no'}`}>
              <div className="title">
                {attempt.correct ? '正确' : '再看一次拼写'}
              </div>
              <p>
                正确算式：<span className="mono">{entry.parts.join(' + ')} → {entry.w}</span>
              </p>
              {attempt.steps.length > 0 ? (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {attempt.steps.map((s, i) => (
                    <li key={i} className="small">
                      {s.rule}：<span className="mono">{s.before}</span> → <span className="mono">{s.after}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small">直接拼接，没有拼写调整。</p>
              )}
            </div>
          ) : (
            <div className="tiny faint">作答后才会显示答案；先自己切分一遍再对答案。</div>
          )}

          <div className="row">
            <Button size="sm" variant="ghost" onClick={() => drop(entry.w)}>
              从这个队列移除
            </Button>
            <span className="spacer" />
            {attempt ? <Badge tone={attempt.correct ? 'green' : 'red'}>{attempt.correct ? '已掌握' : '需复习'}</Badge> : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
