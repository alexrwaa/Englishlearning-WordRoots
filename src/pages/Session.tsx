import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Bar, Button, EmptyState } from '../components/ui';
import { CardView } from '../components/session/CardView';
import { ExerciseView, type AttemptArgs } from '../components/session/ExerciseView';
import { ReviewBlock } from '../components/session/ReviewBlock';
import { SessionHeader } from '../components/session/SessionHeader';
import { SummaryView } from '../components/session/SummaryView';
import {
  buildStages,
  decodeCursor,
  encodeCursor,
  SUMMARY_CURSOR,
  type StageInfo,
} from '../components/session/cursor';
import { errorMessage } from '../components/session/format';
import { getLesson } from '../lib/content';
import { currentRetention } from '../lib/fsrs';
import { createPhaseTimer, type PhaseTimer } from '../lib/timing';
import { useApp } from '../lib/store';
import type { Exercise, Lesson, LessonState, MemoryCard } from '../lib/types';

/**
 * The review stage spends time on cards belonging to today's lesson first.
 * If no due card matches (the usual case after a break), every due card is
 * reviewed so the backlog does not silently grow.
 */
function pickReviewCards(due: MemoryCard[], lesson: Lesson): MemoryCard[] {
  const related = due.filter((card) => lesson.concepts.includes(card.refId));
  const pool = related.length > 0 ? related : due;
  const now = Date.now();
  return [...pool].sort((a, b) => currentRetention(a, now) - currentRetention(b, now)).slice(0, 8);
}

export default function Session() {
  const { lessonId } = useParams<{ lessonId: string }>();
  return <SessionRoute key={lessonId ?? 'missing'} lessonId={lessonId ?? ''} />;
}

function SessionRoute({ lessonId }: { lessonId: string }) {
  const lesson = getLesson(lessonId);
  if (!lesson) return <MissingLesson />;
  return <SessionFlow lesson={lesson} />;
}

function MissingLesson() {
  const navigate = useNavigate();
  return (
    <div className="page page-narrow">
      <EmptyState
        title="找不到这一课"
        body="课程编号可能已经变更，或者课程内容还没有载入。"
        action={<Button onClick={() => navigate('/course')}>返回课程列表</Button>}
      />
    </div>
  );
}

function SessionFlow({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** `?review=1` runs the review block only — used when no new lesson is left. */
  const reviewOnly = searchParams.get('review') === '1';
  const { plan, states, saveLessonState, recordAttempt, gradeRef, toast } = useApp();

  const initialRef = useRef<LessonState | undefined>(states[lesson.id]);
  const [reviewCards] = useState<MemoryCard[]>(() => pickReviewCards(plan.reviewCards, lesson));
  const stages = useMemo(
    () =>
      reviewOnly
        ? reviewCards.length > 0
          ? [{ key: 'review' as const, label: '复习', count: reviewCards.length }]
          : []
        : buildStages(lesson, reviewCards.length),
    [lesson, reviewCards.length, reviewOnly],
  );

  const startPos = decodeCursor(reviewOnly ? 0 : (initialRef.current?.cursor ?? 0));
  const startStageIdx = Math.max(
    0,
    stages.findIndex((s) => s.key === (startPos.stage === 'summary' ? 'apply' : startPos.stage)),
  );
  const startIndex = Math.max(0, Math.min(startPos.index, (stages[startStageIdx]?.count ?? 1) - 1));

  const [stageIdx, setStageIdx] = useState(startStageIdx);
  const [index, setIndex] = useState(startIndex);
  const [maxReached, setMaxReached] = useState(startStageIdx);
  const [done, setDone] = useState(!reviewOnly && startPos.stage === 'summary');
  const [answered, setAnswered] = useState(false);
  const [firstResults, setFirstResults] = useState<Record<string, boolean>>({});
  const [keyEvent, setKeyEvent] = useState<{ key: string; n: number }>({ key: '', n: 0 });

  const startedAtRef = useRef(initialRef.current?.startedAt ?? Date.now());
  const completedRef = useRef(initialRef.current?.status === 'completed');
  /**
   * Only visible, focused time is study time. A session-level timer is settled
   * into `spentRef` whenever the learner changes card or exercise, so the
   * persisted `elapsedMs` is the sum of per-item segments rather than the wall
   * clock. The 180 s idle cap applies to each segment.
   */
  const spentRef = useRef(initialRef.current?.elapsedMs ?? 0);
  const timerRef = useRef<PhaseTimer | null>(null);
  if (!timerRef.current) timerRef.current = createPhaseTimer();
  const [elapsed, setElapsed] = useState(() => spentRef.current + (timerRef.current?.elapsed() ?? 0));

  const settle = useCallback(() => {
    const timer = timerRef.current;
    if (timer) spentRef.current += timer.take();
    setElapsed(spentRef.current);
  }, []);

  const stage: StageInfo = stages[stageIdx] ?? { key: 'learn', label: '学习', count: 0 };
  const needsAnswer = stage.key === 'review' || stage.key === 'practice' || stage.key === 'apply';
  const canAdvance = !needsAnswer || answered;

  const results = Object.values(firstResults);
  const score = results.length > 0 ? results.filter(Boolean).length / results.length : null;

  const scoreRef = useRef<number | null>(score);
  const cursorRef = useRef(0);
  scoreRef.current = score;
  cursorRef.current = done ? SUMMARY_CURSOR : encodeCursor(stage.key, index);

  useEffect(() => {
    const timer = timerRef.current;
    timer?.start();
    const id = setInterval(() => setElapsed(spentRef.current + (timer?.elapsed() ?? 0)), 1000);
    return () => {
      clearInterval(id);
      timer?.dispose();
    };
  }, []);

  // Bank the current item’s visible time as soon as the learner moves on.
  useEffect(() => {
    settle();
    return () => settle();
  }, [stageIdx, index, settle]);

  useEffect(() => {
    setAnswered(false);
  }, [stageIdx, index]);

  const goNext = useCallback(() => {
    if (stages.length === 0) return;
    if (needsAnswer && !answered) return;
    if (index + 1 < stage.count) {
      setIndex(index + 1);
      return;
    }
    if (stageIdx + 1 < stages.length) {
      const nextStage = stageIdx + 1;
      setStageIdx(nextStage);
      setIndex(0);
      setMaxReached((m) => Math.max(m, nextStage));
      return;
    }
    if (reviewOnly) {
      toast('今日复习已完成', 'success');
      navigate('/');
      return;
    }
    setDone(true);
  }, [needsAnswer, answered, index, stage.count, stageIdx, stages.length, reviewOnly, navigate, toast]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    if (stageIdx > 0) {
      const prev = stageIdx - 1;
      setStageIdx(prev);
      setIndex(Math.max(0, (stages[prev]?.count ?? 1) - 1));
    }
  }, [index, stageIdx, stages]);

  const jumpTo = useCallback(
    (target: number) => {
      if (target > maxReached || target === stageIdx) return;
      setStageIdx(target);
      setIndex(0);
    },
    [maxReached, stageIdx],
  );

  const markAnswered = useCallback(() => setAnswered(true), []);
  const emitKey = useCallback((key: string) => setKeyEvent((prev) => ({ key, n: prev.n + 1 })), []);

  const handleGrade = useCallback(
    (refId: string, knew: boolean, elapsedMs: number) => {
      gradeRef(refId, knew, { phase: 'review', elapsedMs }).catch((err: unknown) => {
        toast(errorMessage(err, '复习记录保存失败'), 'warn');
      });
    },
    [gradeRef, toast],
  );

  const handleAttempt = useCallback(
    (exercise: Exercise, phase: 'practice' | 'apply', args: AttemptArgs) => {
      recordAttempt({
        lessonId: lesson.id,
        exercise,
        correct: args.correct,
        durationMs: args.durationMs,
        usedHint: args.usedHint,
        phase,
        answer: args.answer,
      }).catch((err: unknown) => {
        toast(errorMessage(err, '答题记录保存失败'), 'warn');
      });
      setFirstResults((prev) => (prev[exercise.id] === undefined ? { ...prev, [exercise.id]: args.correct } : prev));
    },
    [lesson.id, recordAttempt, toast],
  );

  // Persist the position when the learner leaves the session.
  useEffect(() => {
    const startedAt = startedAtRef.current;
    return () => {
      if (completedRef.current) return;
      const cursor = cursorRef.current;
      const spent = spentRef.current + (timerRef.current?.elapsed() ?? 0);
      // StrictMode mounts and immediately unmounts once; do not create an
      // empty "in progress" record for a lesson that was never touched.
      if (cursor === 0 && spent < 4000) return;
      saveLessonState({
        lessonId: lesson.id,
        status: 'in_progress',
        startedAt,
        completedAt: null,
        elapsedMs: spent,
        score: scoreRef.current,
        cursor,
      }).catch((err: unknown) => {
        toast(errorMessage(err, '进度保存失败'), 'warn');
      });
    };
  }, [lesson.id, saveLessonState, toast]);

  useEffect(() => {
    if (!done) return;
    completedRef.current = true;
    // Re-opening a finished lesson lands straight on the summary; keep the
    // score/time already stored instead of overwriting them with empty tallies.
    if (initialRef.current?.status === 'completed' && results.length === 0) return;
    saveLessonState({
      lessonId: lesson.id,
      status: 'completed',
      startedAt: startedAtRef.current,
      completedAt: Date.now(),
      elapsedMs: spentRef.current + (timerRef.current?.elapsed() ?? 0),
      score: scoreRef.current,
      cursor: SUMMARY_CURSOR,
    }).catch((err: unknown) => {
      toast(errorMessage(err, '完成状态保存失败'), 'warn');
    });
  }, [done, results.length, lesson.id, saveLessonState, toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);
      if (typing) return;
      // A focused button already handles Enter through its native click.
      if (event.key === 'Enter' && tag === 'BUTTON') return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (canAdvance) goNext();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (needsAnswer && !answered) emitKey('Enter');
        else goNext();
        return;
      }
      if (/^[1-4]$/.test(event.key) && needsAnswer) {
        event.preventDefault();
        emitKey(event.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, canAdvance, emitKey, goNext, goPrev, needsAnswer]);

  if (done) {
    return (
      <SummaryView
        lesson={lesson}
        firstResults={firstResults}
        elapsedMs={elapsed}
        onHome={() => navigate('/')}
        onNext={(id) => navigate(`/session/${id}`)}
      />
    );
  }

  if (stages.length === 0 || stage.count === 0) {
    return (
      <div className="page page-narrow">
        <EmptyState
          title={reviewOnly ? '今天没有到期的复习' : '这一课还没有内容'}
          body={
            reviewOnly
              ? '卡片会按你的作答记录排到未来的某一天，明天再来看。'
              : '课程内容仍在编写中，可以先回课程列表看看其他课，或去词源词典继续积累。'
          }
          action={
            <Button onClick={() => navigate(reviewOnly ? '/' : '/course')}>
              {reviewOnly ? '返回首页' : '返回课程列表'}
            </Button>
          }
        />
      </div>
    );
  }

  let content: ReactNode = null;
  if (stage.key === 'review') {
    const card = reviewCards[index];
    content = card ? (
      <ReviewBlock
        key={card.cardId}
        card={card}
        index={index}
        total={stage.count}
        keyEvent={keyEvent}
        onGrade={handleGrade}
        onAnswered={markAnswered}
        onNext={goNext}
      />
    ) : null;
  } else if (stage.key === 'learn') {
    const card = lesson.cards[index];
    content = card ? <CardView key={`${lesson.id}-${index}`} card={card} /> : null;
  } else if (stage.key === 'practice') {
    const exercise = lesson.practice[index];
    content = exercise ? (
      <ExerciseView
        key={exercise.id}
        exercise={exercise}
        index={index}
        total={stage.count}
        phase="practice"
        keyEvent={keyEvent}
        onAttempt={(args) => handleAttempt(exercise, 'practice', args)}
        onAnswered={markAnswered}
        onNext={goNext}
      />
    ) : null;
  } else {
    const exercise = lesson.apply[index];
    content = exercise ? (
      <ExerciseView
        key={exercise.id}
        exercise={exercise}
        index={index}
        total={stage.count}
        phase="apply"
        keyEvent={keyEvent}
        onAttempt={(args) => handleAttempt(exercise, 'apply', args)}
        onAnswered={markAnswered}
        onNext={goNext}
      />
    ) : null;
  }

  const nextStage = stages[stageIdx + 1];
  const isFinal = stageIdx === stages.length - 1 && index === stage.count - 1;
  const nextLabel = isFinal ? '完成本课' : index + 1 < stage.count ? '下一项' : `进入${nextStage?.label ?? '小结'}`;

  return (
    <div>
      <SessionHeader
        lesson={lesson}
        stages={stages}
        activeIndex={stageIdx}
        index={index}
        progress={index / Math.max(1, stage.count)}
        maxReached={maxReached}
        elapsedMs={elapsed}
        onJump={jumpTo}
        onExit={() => navigate('/')}
      />

      <div className="page page-narrow">
        {stage.key === 'learn' ? (
          <div className="row-between" style={{ marginBottom: 14 }}>
            <span className="tiny faint">{index === 0 ? '开始阅读' : `已读完 ${index} / ${stage.count}`}</span>
            <div style={{ width: 180 }}>
              <Bar value={index} max={stage.count} />
            </div>
          </div>
        ) : null}

        {content}

        <div className="row-between" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <Button variant="ghost" onClick={goPrev} disabled={stageIdx === 0 && index === 0}>
            ← 上一项
          </Button>
          <span className="tiny faint">
            {index + 1} / {stage.count}
          </span>
          <Button variant="primary" onClick={goNext} disabled={!canAdvance}>
            {nextLabel} →
          </Button>
        </div>

        <div className="tiny faint" style={{ marginTop: 12, textAlign: 'center' }}>
          键盘：1-4 选择 · Enter 提交/下一步 · ← → 前后切换
        </div>
      </div>
    </div>
  );
}
