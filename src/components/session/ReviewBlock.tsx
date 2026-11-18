import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Panel } from '../ui';
import { getConcept, getMorpheme, labelFor } from '../../lib/content';
import { currentRetention } from '../../lib/fsrs';
import { createPhaseTimer, type PhaseTimer } from '../../lib/timing';
import type { MemoryCard } from '../../lib/types';
import { MorphemeModal } from './RefModal';

export interface KeyEvent {
  key: string;
  n: number;
}

interface ReviewPrompt {
  kicker: string;
  question: string;
  answer: string;
  note?: string;
  /** Morpheme form to open in the dictionary, when the card points at one. */
  morphForm: string | null;
}

function promptFor(card: MemoryCard): ReviewPrompt {
  const morpheme = getMorpheme(card.refId);
  if (morpheme) {
    return {
      kicker: `词素 · ${morpheme.form}`,
      question: `${morpheme.form} 是什么意思？`,
      answer: `${morpheme.glossZh}${morpheme.glossEn ? `（${morpheme.glossEn}）` : ''}`,
      note: morpheme.note,
      morphForm: morpheme.form,
    };
  }
  const concept = getConcept(card.refId);
  if (concept) {
    return {
      kicker: '概念',
      question: `「${concept.zh}」的英文术语和核心定义是什么？`,
      answer: `${concept.en} — ${concept.summary}`,
      note: concept.detail,
      morphForm: null,
    };
  }
  const label = labelFor(card.refId);
  return {
    kicker: card.kind === 'inference' ? '迁移经验' : '概念',
    question: label === card.refId ? `回忆这一步在课中的推理经验` : `回忆「${label}」在课中的含义`,
    answer: '这条卡片没有可展示的词典释义：请凭记忆说出它在课中的用法，再如实自评。',
    morphForm: null,
  };
}

/**
 * One review item: a recall question with self-grading. The scheduler is
 * updated through `onGrade` (gradeRef), never by this component.
 */
export function ReviewBlock({
  card,
  index,
  total,
  keyEvent,
  onGrade,
  onAnswered,
  onNext,
}: {
  card: MemoryCard;
  index: number;
  total: number;
  keyEvent: KeyEvent;
  onGrade: (refId: string, knew: boolean, elapsedMs: number) => void;
  onAnswered: () => void;
  onNext: () => void;
}) {
  const [retention] = useState(() => currentRetention(card, Date.now()));
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<boolean | null>(null);
  const [morphOpen, setMorphOpen] = useState<string | null>(null);
  const gradedRef = useRef(false);
  const timerRef = useRef<PhaseTimer | null>(null);
  if (!timerRef.current) timerRef.current = createPhaseTimer();
  // Seed with the current signal so the last key press of the previous card is
  // not replayed when this card mounts.
  const lastSig = useRef(keyEvent.n);

  const info = useMemo(() => promptFor(card), [card]);

  useEffect(() => {
    const timer = timerRef.current;
    timer?.start();
    return () => timer?.dispose();
  }, []);

  const grade = useCallback(
    (knew: boolean) => {
      if (gradedRef.current) return;
      gradedRef.current = true;
      setGraded(knew);
      onGrade(card.refId, knew, timerRef.current?.take() ?? 0);
      onAnswered();
    },
    [card.refId, onGrade, onAnswered],
  );

  useEffect(() => {
    if (keyEvent.n === lastSig.current) return;
    lastSig.current = keyEvent.n;
    if (keyEvent.key === 'Enter') {
      setRevealed(true);
      return;
    }
    if (!revealed || graded !== null) return;
    if (keyEvent.key === '1') grade(true);
    else if (keyEvent.key === '2') grade(false);
  }, [keyEvent, revealed, graded, grade]);

  return (
    <Panel className="fade-in">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <span className="eyebrow" style={{ margin: 0 }}>
          复习 {index + 1} / {total}
        </span>
        <div className="row" style={{ gap: 6 }}>
          <Badge tone="amber">记忆强度 {Math.round(retention * 100)}%</Badge>
          {card.lapses > 0 ? <Badge tone="red">遗忘 {card.lapses} 次</Badge> : null}
        </div>
      </div>

      <div className="tiny faint">{info.kicker}</div>
      <h2 style={{ margin: '6px 0 12px' }}>{info.question}</h2>

      <textarea
        className="textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="先在脑子里说出答案，也可以写在这里（不参与评分）"
        disabled={revealed}
      />

      {!revealed ? (
        <div className="row" style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={() => setRevealed(true)}>
            显示答案
          </Button>
          <span className="tiny faint">按 Enter 显示</span>
        </div>
      ) : (
        <>
          <div className="panel-flat" style={{ marginTop: 12 }}>
            <div className="tiny faint">参考答案</div>
            <div className="serif" style={{ fontSize: 18, marginTop: 4 }}>
              {info.answer}
            </div>
            {info.note ? (
              <div className="small muted" style={{ marginTop: 6 }}>
                {info.note}
              </div>
            ) : null}
            {info.morphForm ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="chip" onClick={() => setMorphOpen(info.morphForm)}>
                  查看词素条目
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            {graded === null ? (
              <div className="row" style={{ gap: 10 }}>
                <Button variant="primary" onClick={() => grade(true)}>
                  1 · 认识
                </Button>
                <Button onClick={() => grade(false)}>2 · 不认识</Button>
                <span className="tiny faint">如实自评才会排到正确的时间</span>
              </div>
            ) : (
              <div className={`feedback ${graded ? 'ok' : 'no'}`}>
                <div className="title">{graded ? '已记为“认识”' : '已记为“不认识”'}</div>
                <p>系统会据此决定这张卡片下次出现的间隔。</p>
              </div>
            )}
          </div>

          {graded !== null ? (
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={onNext}>
                {index + 1 >= total ? '进入学习' : '下一张'}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <MorphemeModal form={morphOpen} onClose={() => setMorphOpen(null)} />
    </Panel>
  );
}
