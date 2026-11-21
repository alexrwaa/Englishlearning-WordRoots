/**
 * Learning-outcome assessment page (optional).
 *
 * This is NOT the automated test suite. `*.test.ts` checks code behaviour; this
 * page checks a person's answers and can only produce a noisy score. The copy
 * on the page says that in plain language and must stay that way: no "提升 X%"
 * claims, no implication that a score change proves the teaching worked.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Bar, Button, Panel } from '../components/ui';
import {
  DIMENSIONS,
  DIMENSION_META,
  MODE_META,
  buildRun,
  clearHistoryAsync,
  compareResults,
  confidenceNote,
  formatDuration,
  latestBaseline,
  latestRun,
  loadHistoryAsync,
  planRun,
  saveRunAsync,
  scoreRun,
  type AnswerRecord,
  type AssessmentRun,
  type Mode,
  type RunResult,
} from '../lib/assessment';
import '../styles/assessment.css';

const MODE_ORDER: Mode[] = ['baseline', 'checkpoint', 'retest'];

const DISCLAIMER =
  '这是测评工具，不是学习效果实验。分数变化不等于教学有效：没有对照组、没有随机分组，每个维度的题量也很小。要判断教学是否有效，需要对照设计与更大样本。';

const BANK_NOTE =
  '题池中带单词的题目，所用单词都不出现在任何课程里，因此这里测的是迁移，不是对课文例句的记忆。';

function modeLabel(mode: Mode): string {
  return MODE_META[mode].label;
}

function when(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function deltaText(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`;
  if (delta < 0) return delta.toFixed(1);
  return '0.0';
}

function deltaTone(delta: number): string {
  if (delta > 0) return 'is-up';
  if (delta < 0) return 'is-down';
  return 'is-flat';
}

function DifficultyDots({ value }: { value: 1 | 2 | 3 }) {
  return (
    <span className="assess-dots" aria-label={`难度 ${value} / 3`}>
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= value ? 'on' : ''} />
      ))}
    </span>
  );
}

/**
 * History is read from the durable store (SQLite on desktop), never from
 * localStorage. The three states are distinct on purpose: "failed" must never
 * look like "空历史", or a broken read would silently claim the learner has no
 * records.
 */
type HistoryLoad =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; runs: RunResult[]; skipped: number };

type WriteState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done' }
  | { status: 'failed'; message: string };

function describeError(error: unknown, prefix: string): string {
  const detail =
    error instanceof Error && error.message
      ? error.message
      : typeof error === 'string' && error
        ? error
        : '未知错误';
  return `${prefix}：${detail}`;
}

export default function Assessment() {
  const [load, setLoad] = useState<HistoryLoad>({ status: 'loading' });
  const [save, setSave] = useState<WriteState>({ status: 'idle' });
  const [clearing, setClearing] = useState<WriteState>({ status: 'idle' });
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [run, setRun] = useState<AssessmentRun | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const alive = useRef(true);

  /** The list only ever comes from the store's confirmed snapshot. */
  const history = useMemo(() => (load.status === 'ready' ? load.runs : []), [load]);

  const refresh = useCallback(async () => {
    setLoad({ status: 'loading' });
    try {
      const snapshot = await loadHistoryAsync();
      if (alive.current) setLoad({ status: 'ready', runs: snapshot.runs, skipped: snapshot.skipped });
    } catch (failure) {
      if (alive.current) setLoad({ status: 'failed', message: describeError(failure, '读取本机记录失败') });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  /** Confirmed save: the success badge only appears after the store answers. */
  const persist = useCallback(async (scored: RunResult) => {
    setSave({ status: 'working' });
    try {
      const snapshot = await saveRunAsync(scored);
      if (!alive.current) return;
      setLoad({ status: 'ready', runs: snapshot.runs, skipped: snapshot.skipped });
      setSave({ status: 'done' });
    } catch (failure) {
      if (alive.current) setSave({ status: 'failed', message: describeError(failure, '保存失败') });
    }
  }, []);

  async function wipe() {
    if (!window.confirm('清除本机的全部测评记录？此操作不可撤销。')) return;
    setClearing({ status: 'working' });
    try {
      const snapshot = await clearHistoryAsync();
      if (!alive.current) return;
      setLoad({ status: 'ready', runs: snapshot.runs, skipped: snapshot.skipped });
      setClearing({ status: 'idle' });
    } catch (failure) {
      if (alive.current) setClearing({ status: 'failed', message: describeError(failure, '清除失败') });
    }
  }

  const reference = useMemo(() => {
    if (!result) return undefined;
    const others = history.filter((entry) => entry.id !== result.id);
    if (result.mode === 'baseline') return latestRun(others, 'baseline');
    return latestBaseline(others) ?? latestRun(others, result.mode);
  }, [result, history]);

  const comparison = useMemo(() => (result ? compareResults(result, reference) : null), [result, reference]);

  function start(mode: Mode) {
    const plan = planRun(mode);
    if (plan.missing.length > 0 || plan.items.length === 0) {
      setError('题库不足，无法生成这套测评。请检查 items.json 是否完整。');
      return;
    }
    const next = buildRun(mode);
    setError(null);
    setSave({ status: 'idle' });
    setRun(next);
    setResult(null);
    setAnswers([]);
    setQuestionIndex(0);
    setPicked(null);
    setPhase('quiz');
    startedAt.current = Date.now();
  }

  function pick(choiceIndex: number) {
    if (!run || picked !== null) return;
    const item = run.items[questionIndex];
    const ms = Math.max(0, Date.now() - startedAt.current);
    setPicked(choiceIndex);
    setAnswers((prev) => [...prev, { itemId: item.id, choice: choiceIndex, ms }]);
  }

  function advance() {
    if (!run) return;
    if (questionIndex + 1 < run.items.length) {
      setQuestionIndex((index) => index + 1);
      setPicked(null);
      startedAt.current = Date.now();
      return;
    }
    const scored = scoreRun(run, answers, Date.now());
    setResult(scored);
    setPhase('result');
    // The result is shown immediately, but "已保存" waits for the store.
    void persist(scored);
  }

  function reset() {
    setPhase('intro');
    setRun(null);
    setResult(null);
    setAnswers([]);
    setQuestionIndex(0);
    setPicked(null);
    setError(null);
    setSave({ status: 'idle' });
  }

  /* --------------------------------- intro -------------------------------- */

  if (phase === 'intro') {
    const totalItems = planRun('baseline').items.length;
    return (
      <div className="page assess">
        <header className="page-head">
          <div>
            <div className="eyebrow">可选模块</div>
            <h1>学习效果测评</h1>
            <p className="lede">
              五个维度分开计分：已学词素记忆、词素边界判断、词源与现代构词、陌生词推理、语境修正词义。
              每题都要求给出理由，答完立刻看到解释。
            </p>
          </div>
          <div className="row assess-head-badges">
            <Badge tone="accent">5 个维度</Badge>
            <Badge>{totalItems} 题 / 套</Badge>
            <Badge>本地保存</Badge>
          </div>
        </header>

        <Panel className="assess-disclaimer">
          <p className="assess-disclaimer-label">诚实声明</p>
          <p className="assess-disclaimer-body">{DISCLAIMER}</p>
          <p className="tiny faint assess-disclaimer-foot">{BANK_NOTE}</p>
        </Panel>

        {error ? (
          <Panel className="assess-error">
            <p className="small" style={{ margin: 0 }}>{error}</p>
          </Panel>
        ) : null}

        <div className="assess-modes">
          {MODE_ORDER.map((mode) => {
            const last = latestRun(history, mode);
            return (
              <Panel key={mode} className="assess-mode">
                <div className="row-between assess-mode-head">
                  <h3>{modeLabel(mode)}</h3>
                  {last ? <Badge tone="green">上次 {last.overall.toFixed(1)}</Badge> : <Badge>未做过</Badge>}
                </div>
                <p className="small assess-mode-desc">{MODE_META[mode].desc}</p>
                <p className="tiny faint assess-mode-meta">约 {MODE_META[mode].minutes} 分钟 · 可中断，答案在本地</p>
                <Button variant={mode === 'baseline' ? 'primary' : 'default'} block onClick={() => start(mode)}>
                  {last ? '再做一次' : '开始'}
                </Button>
              </Panel>
            );
          })}
        </div>

        <div className="assess-columns">
          <Panel>
            <h3>它是什么，不是什么</h3>
            <ul className="assess-list">
              <li>
                <strong>是</strong>一份带解释的纸笔式测评：每维 0–100 分，难度加权，记录答题耗时。
              </li>
              <li>
                <strong>是</strong>题池与课程隔离的迁移检查：带单词的题，词都不在课文里。
              </li>
              <li>
                <strong>不是</strong>教学效果实验：没有对照组、没有随机分配，分数变化不能归因于课程。
              </li>
              <li>
                <strong>不是</strong>自动化软件测试：<code>npx vitest</code> 检查代码（计分公式、答案越界、题库结构），
                这个页面检查人的表现。前者有确定的通过/失败，后者只有带不确定性的分数。
              </li>
            </ul>
          </Panel>

          <Panel>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <h3 style={{ marginBottom: 0 }}>本机记录</h3>
              {load.status === 'ready' && load.runs.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => void wipe()} disabled={clearing.status === 'working'}>
                  {clearing.status === 'working' ? '清除中…' : '清除记录'}
                </Button>
              ) : null}
            </div>

            {load.status === 'loading' ? (
              <p className="small faint" style={{ margin: 0 }}>
                正在读取本机记录…
              </p>
            ) : null}

            {load.status === 'failed' ? (
              <div className="assess-error" style={{ paddingLeft: 10 }}>
                <p className="small" style={{ margin: '0 0 8px' }}>
                  {load.message}。读取失败不等于没有记录，这里不会用空列表冒充「还没有记录」。
                </p>
                <Button size="sm" onClick={() => void refresh()}>
                  重试读取
                </Button>
              </div>
            ) : null}

            {clearing.status === 'failed' ? (
              <div className="assess-error" style={{ paddingLeft: 10 }}>
                <p className="small" style={{ margin: '0 0 8px' }}>
                  {clearing.message}。记录仍保留在本机，可以重试。
                </p>
                <Button size="sm" onClick={() => void wipe()}>
                  重试清除
                </Button>
              </div>
            ) : null}

            {load.status === 'ready' ? (
              <>
                {load.skipped > 0 ? (
                  <p className="tiny" style={{ margin: '0 0 8px', color: 'var(--red)' }}>
                    有 {load.skipped} 条记录损坏已跳过，其余 {load.runs.length} 条正常显示。
                  </p>
                ) : null}
                {(() => {
                  // A trend is only meaningful within one item bank. Mixing
                  // baseline and retest, or two bank versions, would produce a
                  // slope that measures the test rather than the learner.
                  const byMode = new Map<string, typeof load.runs>();
                  for (const run of load.runs) {
                    const list = byMode.get(run.mode) ?? [];
                    list.push(run);
                    byMode.set(run.mode, list);
                  }
                  const lines = [...byMode.entries()]
                    .filter(([, runs]) => runs.length >= 2)
                    .map(([mode, runs]) => {
                      const sorted = [...runs].sort((a, b) => a.finishedAt - b.finishedAt);
                      const last = sorted[sorted.length - 1];
                      const prev = sorted[sorted.length - 2];
                      const sameBank = last.itemBankVersion === prev.itemBankVersion;
                      return { mode, last, prev, sameBank };
                    });
                  if (lines.length === 0) return null;
                  return (
                    <div style={{ marginTop: 10 }}>
                      <p className="small faint" style={{ marginBottom: 6 }}>
                        同一模式的趋势（只在同一题库版本内比较）
                      </p>
                      {lines.map(({ mode, last, prev, sameBank }) => (
                        <p key={mode} className="small" style={{ margin: '2px 0' }}>
                          {modeLabel(mode as Mode)}：{prev.overall.toFixed(1)} → {last.overall.toFixed(1)}
                          {sameBank ? (
                            <span className="tiny faint">
                              {' '}
                              （{last.overall - prev.overall >= 0 ? '+' : ''}
                              {(last.overall - prev.overall).toFixed(1)}）
                            </span>
                          ) : (
                            <span className="tiny faint">
                              {' '}
                              （题库版本 {prev.itemBankVersion} → {last.itemBankVersion}，分数不可直接比较）
                            </span>
                          )}
                        </p>
                      ))}
                      <p className="tiny faint" style={{ marginTop: 4 }}>
                        分数变化不等于教学有效：题不同、状态不同、样本都很小。
                      </p>
                    </div>
                  );
                })()}
                {load.runs.length === 0 ? (
                  <p className="small faint" style={{ margin: 0 }}>
                    还没有记录。完成一次基线测评后，这里会出现分数、耗时与复测对比。
                  </p>
                ) : (
                  <div className="assess-history">
                    {load.runs.slice(0, 6).map((entry) => (
                      <div key={entry.id} className="assess-history-row">
                        <span className="assess-history-mode">{modeLabel(entry.mode)}</span>
                        <span className="tiny faint">{when(entry.finishedAt)}</span>
                        <span className="assess-history-score">{entry.overall.toFixed(1)}</span>
                      </div>
                    ))}
                    {load.runs.length > 6 ? (
                      <p className="tiny faint">仅显示最近 6 次，共 {load.runs.length} 次。</p>
                    ) : null}
                  </div>
                )}
              </>
            ) : null}
          </Panel>
        </div>

        <Panel className="assess-dimension-key">
          <h3>五个维度分别问什么</h3>
          <div className="assess-key-grid">
            {DIMENSIONS.map((dimension) => (
              <div key={dimension} className="assess-key-item">
                <span className="assess-key-label">{DIMENSION_META[dimension].label}</span>
                <span className="tiny faint">{DIMENSION_META[dimension].desc}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  /* ---------------------------------- quiz -------------------------------- */

  if (phase === 'quiz' && run) {
    const item = run.items[questionIndex];
    const answered = picked !== null;
    const correct = answered && picked === item.answer;
    const progress = ((questionIndex + (answered ? 1 : 0)) / run.items.length) * 100;

    return (
      <div className="page assess">
        <header className="page-head">
          <div>
            <div className="eyebrow">{modeLabel(run.mode)} · 第 {questionIndex + 1} / {run.items.length} 题</div>
            <h1>学习效果测评</h1>
          </div>
          <div className="row assess-head-badges">
            <Badge tone="accent">{DIMENSION_META[item.dimension].label}</Badge>
            <DifficultyDots value={item.difficulty} />
            <Button size="sm" variant="ghost" onClick={reset}>
              退出
            </Button>
          </div>
        </header>

        <div className="assess-progress">
          <Bar value={progress} />
        </div>

        <Panel className="assess-question">
          {item.word ? <div className="assess-word serif">{item.word}</div> : null}
          <p className="assess-prompt">{item.prompt}</p>

          <div className="assess-choices" role="group" aria-label="选项">
            {item.choices.map((text, index) => {
              const isPicked = picked === index;
              const isKey = item.answer === index;
              const cls = [
                'assess-choice',
                answered && isKey ? 'is-correct' : '',
                answered && isPicked && !isKey ? 'is-wrong' : '',
                answered && !isPicked && !isKey ? 'is-muted' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={text}
                  type="button"
                  className={cls}
                  aria-pressed={isPicked}
                  disabled={answered}
                  onClick={() => pick(index)}
                >
                  <span className="assess-choice-key">{String.fromCharCode(65 + index)}</span>
                  <span className="assess-choice-text">{text}</span>
                  {answered && isKey ? <span className="assess-choice-mark">正确答案</span> : null}
                  {answered && isPicked && !isKey ? <span className="assess-choice-mark">你的选择</span> : null}
                </button>
              );
            })}
          </div>

          {answered ? (
            <div className={`assess-feedback ${correct ? 'is-ok' : 'is-no'}`} role="status">
              <div className="assess-feedback-head">
                <strong>{correct ? '答对了' : '再修正一步'}</strong>
                <span className="tiny faint">
                  {correct ? '这次推理成立' : `正确答案：${String.fromCharCode(65 + item.answer)}`}
                </span>
              </div>
              <p className="small" style={{ margin: 0 }}>{item.explain}</p>
            </div>
          ) : (
            <p className="tiny faint assess-hint">先自己判断，再看解释。</p>
          )}

          <div className="row-between assess-question-foot">
            <span className="tiny faint">
              难度加权：{item.difficulty === 1 ? '×1' : item.difficulty === 2 ? '×1.5' : '×2'}
            </span>
            <Button variant="primary" disabled={!answered} onClick={advance}>
              {questionIndex + 1 < run.items.length ? '下一题' : '查看结果'}
            </Button>
          </div>
        </Panel>

        <p className="tiny faint assess-foot-note">{DISCLAIMER}</p>
      </div>
    );
  }

  /* --------------------------------- result ------------------------------- */

  if (phase === 'result' && result) {
    const lowConfidence = result.dimensions.some((dimension) => dimension.confidence === 'low');
    return (
      <div className="page assess">
        <header className="page-head">
          <div>
            <div className="eyebrow">{modeLabel(result.mode)} · 完成</div>
            <h1>结果</h1>
            <p className="lede">
              每维 0–100，按难度加权（1 / 1.5 / 2）。分数只描述这一套题上的表现，不描述课程效果。
            </p>
          </div>
          <div className="row assess-head-badges">
            <Badge tone="accent">总分 {result.overall.toFixed(1)}</Badge>
            <Badge>{formatDuration(result.durationMs)}</Badge>
            <Badge tone={lowConfidence ? 'amber' : 'green'}>
              {result.overallConfidence === 'low' ? '样本过小' : result.overallConfidence === 'medium' ? '样本偏小' : '样本尚可'}
            </Badge>
          </div>
        </header>

        {save.status === 'working' ? (
          <p className="small faint" style={{ margin: '0 0 12px' }}>
            正在保存到本机数据库…
          </p>
        ) : null}
        {save.status === 'done' ? (
          <p className="small" style={{ margin: '0 0 12px', color: 'var(--accent-ink)' }}>
            已保存到本机数据库。
          </p>
        ) : null}
        {save.status === 'failed' ? (
          <Panel className="assess-error">
            <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
              <p className="small" style={{ margin: 0 }}>
                {save.message}。这次结果还没有保存，本机记录也没有新增。
              </p>
              <Button size="sm" onClick={() => void persist(result)}>
                重试保存
              </Button>
            </div>
          </Panel>
        ) : null}

        <Panel className="assess-score-card">
          <div className="assess-overall">
            <div className="assess-overall-number">{result.overall.toFixed(1)}</div>
            <div className="assess-overall-side">
              <div className="small">
                共 {result.itemCount} 题 · 已答 {result.answers.length} 题 · 答题耗时 {formatDuration(result.durationMs)}
              </div>
              <p className="tiny assess-overall-note">{confidenceNote(result.overallConfidence)}</p>
            </div>
          </div>

          <div className="assess-score-list">
            {result.dimensions.map((dimension) => {
              const delta = comparison?.dimensions.find((entry) => entry.dimension === dimension.dimension)?.delta;
              return (
                <div key={dimension.dimension} className="assess-score-row">
                  <div className="assess-score-name">
                    <span>{dimension.label}</span>
                    <span className="tiny faint">
                      {dimension.correct} / {dimension.total} 题 · {dimension.note}
                    </span>
                  </div>
                  <div className="assess-score-bar">
                    <Bar value={dimension.score} />
                  </div>
                  <div className="assess-score-value">
                    <strong>{dimension.score.toFixed(1)}</strong>
                    {delta !== undefined ? (
                      <span className={`assess-delta ${deltaTone(delta)}`}>{deltaText(delta)}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {comparison && reference ? (
            <p className="tiny faint assess-compare-note">
              对比对象：{modeLabel(reference.mode)}（{when(reference.finishedAt)}，总分 {reference.overall.toFixed(1)}）。
              总分变化 {deltaText(comparison.overall)}。这仍不是教学效果证据：两次题不同、状态不同、样本都很小。
            </p>
          ) : (
            <p className="tiny faint assess-compare-note">
              还没有可对比的基线。做完基线后，阶段检查与延迟复测会在这里显示逐维差值。
            </p>
          )}
        </Panel>

        <Panel className="assess-disclaimer">
          <p className="assess-disclaimer-label">诚实声明</p>
          <p className="assess-disclaimer-body">{DISCLAIMER}</p>
          <p className="tiny faint assess-disclaimer-foot">{BANK_NOTE}</p>
        </Panel>

        <div className="row assess-actions">
          <Button variant="primary" onClick={() => start(result.mode)}>
            再做一次{modeLabel(result.mode)}
          </Button>
          <Button onClick={reset}>回到开始</Button>
          {result.mode !== 'baseline' ? (
            <Button variant="ghost" onClick={() => start('retest')}>
              做延迟复测
            </Button>
          ) : null}
        </div>

        <Panel className="assess-review">
          <h3>逐题回顾</h3>
          <div className="assess-review-list">
            {run?.items.map((item, index) => {
              const record = result.answers.find((answer) => answer.itemId === item.id);
              const ok = record ? record.choice === item.answer : false;
              return (
                <details key={item.id} className="assess-review-item">
                  <summary>
                    <span className={`assess-dot ${ok ? 'ok' : 'no'}`} aria-hidden />
                    <span className="assess-review-index">{index + 1}</span>
                    <span className="assess-review-dim">{DIMENSION_META[item.dimension].short}</span>
                    <span className="assess-review-word">{item.word ?? '词素题'}</span>
                  </summary>
                  <div className="assess-review-body">
                    <p className="small">{item.prompt}</p>
                    <p className="small">
                      <strong>你的选择：</strong>
                      {record ? `${String.fromCharCode(65 + record.choice)}. ${item.choices[record.choice] ?? '（越界）'}` : '未作答'}
                    </p>
                    <p className="small">
                      <strong>正确答案：</strong>
                      {String.fromCharCode(65 + item.answer)}. {item.choices[item.answer]}
                    </p>
                    <p className="small faint">{item.explain}</p>
                  </div>
                </details>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  return null;
}
