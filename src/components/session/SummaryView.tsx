import { useMemo, useState } from 'react';
import { Badge, Bar, Button, Panel, Ring, Stat } from '../ui';
import { getMorpheme, nextLesson } from '../../lib/content';
import { useApp } from '../../lib/store';
import type { CardKind, Lesson, MemoryCard } from '../../lib/types';
import { MorphemeModal } from './RefModal';
import { formatDuration, relativeDue } from './format';

function cardIdFor(kind: CardKind, refId: string): string {
  return `${kind}:${refId}`;
}

/**
 * End-of-lesson summary. The completion state itself is persisted by the
 * session container, which owns the clock and the attempt tally.
 */
export function SummaryView({
  lesson,
  firstResults,
  elapsedMs,
  onHome,
  onNext,
}: {
  lesson: Lesson;
  firstResults: Record<string, boolean>;
  elapsedMs: number;
  onHome: () => void;
  onNext: (lessonId: string) => void;
}) {
  const { cards, completedLessons } = useApp();
  const [morphOpen, setMorphOpen] = useState<string | null>(null);

  const entries = Object.values(firstResults);
  const total = entries.length;
  const correct = entries.filter(Boolean).length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const morphemeForms = useMemo(
    () => lesson.concepts.filter((ref) => Boolean(getMorpheme(ref))),
    [lesson.concepts],
  );

  const nextDue = useMemo(() => {
    const dues = lesson.concepts
      .map((ref) => cards[cardIdFor('concept', ref)])
      .filter((card): card is MemoryCard => Boolean(card))
      .map((card) => card.due);
    return dues.length > 0 ? Math.min(...dues) : null;
  }, [cards, lesson.concepts]);

  const completed = new Set(completedLessons);
  completed.add(lesson.id);
  const upcoming = nextLesson(completed);

  return (
    <div className="page page-narrow fade-in">
      <div className="eyebrow">小结</div>
      <h1 style={{ marginBottom: 6 }}>第 {lesson.week} 周 · 第 {lesson.day} 天完成</h1>
      <p className="lede" style={{ marginBottom: 20 }}>
        {lesson.title}
      </p>

      <Panel>
        <div className="row" style={{ gap: 22, alignItems: 'center' }}>
          <Ring value={percent} label={`${percent}%`} />
          <div style={{ flex: 1 }}>
            <div className="grid grid-3">
              <Stat label="首次正确率" value={total > 0 ? `${correct} / ${total}` : '—'} hint="只统计第一次作答" />
              <Stat label="本课用时" value={formatDuration(elapsedMs)} hint={`${lesson.minutes.learn + lesson.minutes.practice + lesson.minutes.apply} 分钟计划`} />
              <Stat
                label="下次复习"
                value={nextDue === null ? '—' : relativeDue(nextDue)}
                hint={nextDue === null ? '学过的卡片还没进入排程' : '按目标保持率推算'}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <Bar value={correct} max={Math.max(1, total)} />
              <div className="tiny faint" style={{ marginTop: 6 }}>
                {total > 0
                  ? `共作答 ${total} 题，其中 ${correct} 题一次答对。`
                  : '这一课没有可计分的练习，完成阅读与应用即可。'}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <div className="panel-title">
          <h3>本课涉及的词素</h3>
          <span className="tiny faint">{morphemeForms.length} 个</span>
        </div>
        {morphemeForms.length > 0 ? (
          <div className="row wrap" style={{ gap: 8 }}>
            {morphemeForms.map((form) => {
              const morpheme = getMorpheme(form);
              return (
                <button key={form} type="button" className="chip" onClick={() => setMorphOpen(form)}>
                  <span className="mono">{morpheme?.form ?? form}</span>
                  <span className="tiny faint">{morpheme?.glossZh ?? '查看'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="small faint" style={{ margin: 0 }}>
            这一课以概念为主，没有独立的词素条目。概念卡片同样会进入复习排程。
          </p>
        )}
        <div className="tiny faint" style={{ marginTop: 12 }}>
          <Badge tone="green">记忆</Badge> 记住词素与规则，<Badge tone="accent">迁移</Badge> 把规则用到没见过的词上——两者分开计分。
        </div>
      </Panel>

      <div className="row" style={{ marginTop: 20, gap: 10 }}>
        <Button variant="primary" onClick={onHome}>
          返回首页
        </Button>
        {upcoming ? (
          <Button onClick={() => onNext(upcoming.id)}>
            学习下一课：第 {upcoming.week} 周 · 第 {upcoming.day} 天
          </Button>
        ) : (
          <span className="small faint">12 周课程已全部完成。</span>
        )}
      </div>

      <MorphemeModal form={morphOpen} onClose={() => setMorphOpen(null)} />
    </div>
  );
}
