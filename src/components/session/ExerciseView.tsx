import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Panel } from '../ui';
import { checkExercise, type CheckResult, type Response } from '../../lib/answer';
import { createPhaseTimer, type PhaseTimer } from '../../lib/timing';
import type { Exercise } from '../../lib/types';
import type { KeyEvent } from './ReviewBlock';

const KIND_LABEL: Record<Exercise['kind'], string> = {
  mcq: '选择',
  cloze: '填空',
  wordSum: '构词算式',
  matrix: '词族填空',
  infer: '语境推断',
};

export interface AttemptArgs {
  correct: boolean;
  durationMs: number;
  answer: string;
  usedHint: boolean;
}

function choiceCount(ex: Exercise): number {
  return ex.kind === 'mcq' || ex.kind === 'infer' ? ex.choices.length : 0;
}

function choiceText(ex: Exercise, index: number | null): string {
  if (index === null) return '';
  return ex.kind === 'mcq' || ex.kind === 'infer' ? (ex.choices[index] ?? '') : '';
}

function placeholderFor(ex: Exercise): string {
  switch (ex.kind) {
    case 'cloze':
      return '填入缺少的词（中英文均可，视题目要求）';
    case 'wordSum':
      return '用 + 连接词素，如 un + kind + ness';
    case 'matrix':
      return '写出完整单词';
    default:
      return '输入答案';
  }
}

/** Emphasise the target word inside a passage without touching the source text. */
function highlight(text: string, word: string) {
  if (!word) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <em key={i} className="word" style={{ borderBottom: '2px solid var(--accent-soft)' }}>
        {part}
      </em>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function ExerciseView({
  exercise,
  index,
  total,
  phase,
  keyEvent,
  onAttempt,
  onAnswered,
  onNext,
}: {
  exercise: Exercise;
  index: number;
  total: number;
  phase: 'practice' | 'apply';
  keyEvent: KeyEvent;
  onAttempt: (args: AttemptArgs) => void;
  onAnswered: () => void;
  onNext: () => void;
}) {
  const timerRef = useRef<PhaseTimer | null>(null);
  if (!timerRef.current) timerRef.current = createPhaseTimer();
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // Seed with the current signal so a key press from the previous item is not
  // replayed when this component mounts.
  const lastSig = useRef(keyEvent.n);

  const isChoice = exercise.kind === 'mcq' || exercise.kind === 'infer';

  useEffect(() => {
    const timer = timerRef.current;
    timer?.start();
    return () => timer?.dispose();
  }, []);

  const buildResponse = useCallback((): Response | null => {
    if (isChoice) return selected === null ? null : { kind: 'choice', index: selected };
    return text.trim() ? { kind: 'text', value: text } : null;
  }, [isChoice, selected, text]);

  const submit = useCallback(() => {
    if (result) return;
    const response = buildResponse();
    if (!response) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    const checked = checkExercise(exercise, response);
    setResult(checked);
    if (attempts === 0) {
      onAttempt({
        correct: checked.correct,
        // Only visible, focused time counts; a question left open is capped.
        durationMs: timerRef.current?.take() ?? 0,
        answer: isChoice ? choiceText(exercise, selected) : text.trim(),
        usedHint: hintShown,
      });
    }
    setAttempts((n) => n + 1);
    onAnswered();
  }, [result, buildResponse, exercise, attempts, onAttempt, onAnswered, isChoice, selected, text, hintShown]);

  const retry = useCallback(() => {
    setResult(null);
    setSelected(null);
    setText('');
    setBlocked(false);
  }, []);

  useEffect(() => {
    if (keyEvent.n === lastSig.current) return;
    lastSig.current = keyEvent.n;
    const key = keyEvent.key;
    if (key === 'Enter') {
      submit();
      return;
    }
    if (!isChoice || result) return;
    if (/^[1-4]$/.test(key)) {
      const i = Number(key) - 1;
      if (i < choiceCount(exercise)) {
        setSelected(i);
        setBlocked(false);
      }
    }
  }, [keyEvent, submit, isChoice, result, exercise]);

  const choiceState = (i: number): string | undefined => {
    if (!result) return selected === i ? 'selected' : undefined;
    if (exercise.kind === 'mcq' || exercise.kind === 'infer') {
      if (i === exercise.answer) return 'correct';
    }
    if (selected === i) return 'wrong';
    return undefined;
  };

  return (
    <Panel className="fade-in">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <span className="eyebrow" style={{ margin: 0 }}>
          {phase === 'apply' ? '应用' : '练习'} {index + 1} / {total}
        </span>
        <div className="row" style={{ gap: 6 }}>
          <Badge>{KIND_LABEL[exercise.kind]}</Badge>
          {attempts > 1 ? <Badge tone="amber">重试中</Badge> : null}
        </div>
      </div>

      <h2 style={{ marginBottom: 12 }}>{exercise.prompt}</h2>

      {exercise.hint ? (
        hintShown ? (
          <p className="small" style={{ color: 'var(--amber)', marginBottom: 12 }}>
            提示：{exercise.hint}
          </p>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <Button size="sm" variant="ghost" onClick={() => setHintShown(true)}>
              看提示
            </Button>
          </div>
        )
      ) : null}

      {exercise.kind === 'infer' ? (
        <div className="panel-flat prose" lang="en" style={{ fontFamily: 'var(--serif)', marginBottom: 14 }}>
          <p>{highlight(exercise.passage, exercise.word)}</p>
          <div className="tiny faint" lang="zh">
            目标词：<span className="word">{exercise.word}</span>
          </div>
        </div>
      ) : null}

      {exercise.kind === 'cloze' ? (
        <p className="serif" lang="en" style={{ fontSize: '1.05em', margin: '4px 0 16px' }}>
          {exercise.sentence.split('___').map((part, i, arr) => (
            <Fragment key={i}>
              {part}
              {i < arr.length - 1 ? (
                <span
                  className="mono"
                  style={{ borderBottom: '2px solid var(--accent)', padding: '0 24px', display: 'inline-block' }}
                >
                  &nbsp;
                </span>
              ) : null}
            </Fragment>
          ))}
        </p>
      ) : null}

      {exercise.kind === 'wordSum' ? (
        <>
          <div className="sum" style={{ marginBottom: 8 }}>
            {exercise.parts.map((part, i) => (
              <Fragment key={`${part}-${i}`}>
                {i > 0 ? <span className="sum-arrow">+</span> : null}
                <span className="morph">{part}</span>
              </Fragment>
            ))}
            <span className="sum-arrow">→</span>
            <span className="sum-result">?</span>
          </div>
          <div className="tiny faint" style={{ marginBottom: 14 }}>
            请按顺序写出词素，用 + 连接（前缀 + 词根 + 后缀）；只写整词不算完成构词分析。
          </div>
        </>
      ) : null}

      {exercise.kind === 'matrix' ? (
        <>
          <div className="sum" style={{ marginBottom: 8 }}>
            {exercise.prefix ? (
              <>
                <span className="morph">{exercise.prefix}</span>
                <span className="sum-arrow">+</span>
              </>
            ) : null}
            <span className="morph">{exercise.base}</span>
            {exercise.suffix ? (
              <>
                <span className="sum-arrow">+</span>
                <span className="morph">{exercise.suffix}</span>
              </>
            ) : null}
            <span className="sum-arrow">→</span>
            <span className="sum-result">?</span>
          </div>
          <div className="tiny faint" style={{ marginBottom: 14 }}>
            写出拼好的整词；也可以用 + 写成算式（例如{' '}
            {[exercise.prefix, exercise.base, exercise.suffix].filter(Boolean).join(' + ')}）来核对顺序。
          </div>
        </>
      ) : null}

      {isChoice ? (
        <div className="col" style={{ gap: 8 }}>
          {exercise.kind === 'mcq' || exercise.kind === 'infer'
            ? exercise.choices.map((choice, i) => (
                <button
                  key={`${choice}-${i}`}
                  type="button"
                  className="choice"
                  data-state={choiceState(i)}
                  disabled={Boolean(result)}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setSelected(i);
                    setBlocked(false);
                  }}
                >
                  <span className="choice-key">{String.fromCharCode(65 + i)}</span>
                  <span>{choice}</span>
                </button>
              ))
            : null}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className="input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setBlocked(false);
            }}
            placeholder={placeholderFor(exercise)}
            autoComplete="off"
            spellCheck={false}
            disabled={Boolean(result)}
            autoFocus
          />
          <div className="row" style={{ marginTop: 10 }}>
            <Button type="submit" variant="primary" size="sm" disabled={Boolean(result)}>
              提交
            </Button>
            <span className="tiny faint">按 Enter 提交</span>
          </div>
        </form>
      )}

      {isChoice && !result ? (
        <div className="row" style={{ marginTop: 12, gap: 10 }}>
          <Button variant="primary" onClick={submit} disabled={selected === null}>
            提交答案
          </Button>
          <span className="tiny faint">按 1-4 选择，Enter 提交</span>
        </div>
      ) : null}

      {blocked ? (
        <p className="small" style={{ color: 'var(--red)', marginTop: 10 }}>
          先选择或填入答案，再提交。
        </p>
      ) : null}

      {result ? (
        <div className={`feedback ${result.correct ? 'ok' : 'no'}`} style={{ marginTop: 14 }}>
          <div className="title">{result.correct ? '答对了' : '这次不对'}</div>
          {result.feedback ? <p>{result.feedback}</p> : null}
          <p>{exercise.explain}</p>
          {exercise.kind === 'infer' ? (
            <p>
              <strong>推理路径：</strong>
              {exercise.strategy}
            </p>
          ) : null}
          <div className="row" style={{ marginTop: 10, gap: 10 }}>
            {!result.correct && attempts < 2 ? (
              <Button size="sm" onClick={retry}>
                再试一次
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={onNext}>
              {index + 1 >= total ? '进入下一步' : '下一题'}
            </Button>
          </div>
        </div>
      ) : null}

      {exercise.kind === 'infer' && !result ? (
        <div style={{ marginTop: 14 }}>
          <div className="row-between">
            <span className="tiny faint">先自己判断，再对照推理路径</span>
            <Button size="sm" variant="ghost" onClick={() => setShowStrategy((v) => !v)}>
              {showStrategy ? '收起推理路径' : '看推理路径'}
            </Button>
          </div>
          {showStrategy ? <div className="panel-flat small" style={{ marginTop: 8 }}>{exercise.strategy}</div> : null}
        </div>
      ) : null}
    </Panel>
  );
}
