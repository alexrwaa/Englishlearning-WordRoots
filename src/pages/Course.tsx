import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Bar, Button, EmptyState, Panel, Ring, Stat } from '../components/ui';
import { getLesson, labelFor, lessons, weekOf } from '../lib/content';
import { useApp } from '../lib/store';
import type { Lesson } from '../lib/types';

const WEEK_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function lessonMinutes(l: Lesson): number {
  return l.minutes.review + l.minutes.learn + l.minutes.practice + l.minutes.apply;
}

function excerpt(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

export default function Course() {
  const { states, completedLessons, cards, stats } = useApp();
  const [params, setParams] = useSearchParams();
  const [openWeek, setOpenWeek] = useState<number | null>(() => {
    const raw = Number(params.get('week'));
    return Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : null;
  });
  const weekRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const toggledByUser = useRef(false);

  const total = lessons.length;
  const done = useMemo(() => lessons.filter((l) => completedLessons.has(l.id)).length, [completedLessons]);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const currentWeek = useMemo(() => {
    const next = lessons.find((l) => !completedLessons.has(l.id));
    if (next) return next.week;
    return lessons.length > 0 ? lessons[lessons.length - 1].week : 1;
  }, [completedLessons]);

  const weekParam = Number(params.get('week'));

  // Keep the URL (?week=3) in sync with the open card, and scroll to it once.
  useEffect(() => {
    if (!Number.isInteger(weekParam) || weekParam < 1 || weekParam > 12) {
      toggledByUser.current = false;
      return;
    }
    setOpenWeek(weekParam);
    if (toggledByUser.current) {
      toggledByUser.current = false;
      return;
    }
    const el = weekRefs.current[weekParam];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [weekParam]);

  function toggleWeek(no: number) {
    const next = openWeek === no ? null : no;
    toggledByUser.current = true;
    setOpenWeek(next);
    if (next === null) setParams({}, { replace: true });
    else setParams({ week: String(next) }, { replace: true });
  }

  function unmetPrereqs(l: Lesson): string[] {
    return l.prereqs.filter((ref) => {
      const prereqLesson = getLesson(ref);
      if (prereqLesson) return !completedLessons.has(prereqLesson.id);
      // A concept prerequisite counts as unmet until its memory card is introduced.
      const card = cards[`concept:${ref}`];
      return !card || card.state === 0;
    });
  }

  if (total === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">课程地图</div>
            <h1>12 周课程</h1>
            <p className="lede">课程按周组织，每周 7 天，每天四个阶段：复习、学习、练习、应用。</p>
          </div>
        </header>
        <Panel>
          <EmptyState
            title="课程内容正在导入"
            body="第 1–12 周的课程文件尚未写入。导入后这里会自动显示每周主题、7 天安排与完成进度，无需手动刷新。"
            action={
              <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
                重新检查
              </Button>
            }
          />
        </Panel>
        <Panel flat style={{ marginTop: 16 }}>
          <p className="small muted" style={{ margin: 0 }}>
            在等待内容导入时，可以先打开
            <Link to="/matrix" style={{ margin: '0 4px' }}>
              构词实验室
            </Link>
            手工验证词素组合，或用
            <Link to="/word" style={{ margin: '0 4px' }}>
              词源词典
            </Link>
            浏览已收录词条。
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">课程地图</div>
          <h1>12 周，把英语词汇拆开看</h1>
          <p className="lede">
            从词素概念出发，经前缀、后缀、拉丁词根，走到构词方式与拼写规则。已完成 {done} / {total} 课，
            目前进行到第 {currentWeek} 周。
          </p>
        </div>
        <Ring value={percent} label={`${percent}%`} />
      </header>

      <Panel>
        <div className="grid grid-3">
          <Stat label="总进度" value={`${done} / ${total}`} hint={`完成 ${percent}% 的课程`} />
          <Stat label="已掌握词素" value={stats.morphemesMastered} hint="稳定记忆 ≥ 21 天的概念卡" />
          <Stat
            label="当前周"
            value={`第 ${currentWeek} 周`}
            hint={weekOf(currentWeek)?.theme ?? '该周内容尚未导入'}
          />
        </div>
      </Panel>

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        {WEEK_SLOTS.map((no) => {
          const week = weekOf(no);
          const open = openWeek === no;
          const setRef = (el: HTMLDivElement | null) => {
            weekRefs.current[no] = el;
          };

          if (!week) {
            return (
              <div key={no} ref={setRef} style={{ scrollMarginTop: 12 }}>
                <Panel flat style={{ borderStyle: 'dashed', height: '100%' }}>
                  <div className="row-between">
                    <div className="row">
                      <span
                        className="mono tiny faint"
                        style={{
                          border: '1px solid var(--line-strong)',
                          borderRadius: 8,
                          padding: '2px 7px',
                        }}
                      >
                        W{String(no).padStart(2, '0')}
                      </span>
                      <div>
                        <h3 className="muted">第 {no} 周</h3>
                        <div className="tiny faint">主题与 7 天课程正在导入</div>
                      </div>
                    </div>
                    <Badge>待导入</Badge>
                  </div>
                </Panel>
              </div>
            );
          }

          const weekDone = week.lessons.filter((l) => completedLessons.has(l.id)).length;
          const weekTotal = week.lessons.length;
          const allDone = weekTotal > 0 && weekDone === weekTotal;
          const statusText = weekTotal === 0 ? '待导入' : allDone ? '已完成' : weekDone > 0 ? '进行中' : '未开始';
          const tone = weekTotal === 0 ? 'default' : allDone ? 'green' : weekDone > 0 ? 'accent' : 'default';
          const isCurrent = no === currentWeek && !allDone;

          return (
            <div key={no} ref={setRef} style={{ scrollMarginTop: 12 }}>
              <Panel style={{ height: '100%' }}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggleWeek(no)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleWeek(no);
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                      <span
                        className="mono"
                        style={{
                          border: '1px solid var(--line-strong)',
                          borderRadius: 8,
                          padding: '2px 7px',
                          fontSize: 12,
                          color: 'var(--ink-soft)',
                        }}
                      >
                        W{String(no).padStart(2, '0')}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ marginBottom: 4 }}>{week.theme}</h3>
                        <p className="small muted" style={{ margin: 0 }}>{excerpt(week.intro, 60)}</p>
                      </div>
                    </div>
                    <div className="row" style={{ flex: 'none', gap: 6 }}>
                      {isCurrent ? <Badge tone="accent">当前</Badge> : null}
                      <Badge tone={tone}>{statusText}</Badge>
                    </div>
                  </div>

                  <div className="row-between" style={{ marginTop: 14, gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <Bar value={weekDone} max={Math.max(weekTotal, 1)} />
                    </div>
                    <span className="tiny faint mono" style={{ flex: 'none' }}>
                      {weekTotal === 0 ? '0/0' : `${weekDone}/${weekTotal}`}
                    </span>
                    <span className="tiny faint" style={{ flex: 'none' }}>
                      {open ? '收起 ▲' : '展开 ▼'}
                    </span>
                  </div>
                </div>

                {open ? (
                  <div className="fade-in" style={{ marginTop: 14 }}>
                    <div className="divider" style={{ margin: '0 0 12px' }} />
                    {week.lessons.length === 0 ? (
                      <p className="small faint" style={{ margin: 0 }}>
                        本周的 7 天课程尚未导入。
                      </p>
                    ) : (
                      <div className="grid" style={{ gap: 8 }}>
                        {week.lessons.map((l) => {
                          const state = states[l.id];
                          const isDone = completedLessons.has(l.id) || state?.status === 'completed';
                          const inProgress = !isDone && state?.status === 'in_progress';
                          const unmet = unmetPrereqs(l);
                          return (
                            <Link
                              key={l.id}
                              to={`/session/${l.id}`}
                              className="row-between"
                              style={{
                                textDecoration: 'none',
                                color: 'inherit',
                                padding: '9px 12px',
                                border: '1px solid var(--line)',
                                borderRadius: 10,
                                background: 'var(--panel-2)',
                                gap: 10,
                              }}
                            >
                              <div className="row" style={{ minWidth: 0, gap: 10 }}>
                                <span className={`dot ${isDone ? 'done' : inProgress ? 'current' : ''}`} />
                                <span className="tiny faint mono" style={{ flex: 'none' }}>
                                  D{l.day}
                                </span>
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {l.title}
                                </span>
                                {unmet.length > 0 ? (
                                  <Badge tone="amber" className="tiny">
                                    先修未完成
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="row tiny faint" style={{ flex: 'none', gap: 8 }}>
                                <span style={{ whiteSpace: 'nowrap' }}>{lessonMinutes(l)} 分钟</span>
                                <span style={{ color: isDone ? 'var(--green)' : 'var(--accent-ink)' }}>
                                  {isDone ? '复习 →' : inProgress ? '继续 →' : '开始 →'}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    {week.lessons.some((l) => unmetPrereqs(l).length > 0) ? (
                      <p className="tiny faint" style={{ margin: '10px 0 0' }}>
                        先修提示：
                        {labelFor(
                          week.lessons.flatMap((l) => unmetPrereqs(l))[0] ?? '',
                        )}
                        。课程不锁定——成人自主学习，提示仅供参考。
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Panel>
            </div>
          );
        })}
      </div>
    </div>
  );
}
