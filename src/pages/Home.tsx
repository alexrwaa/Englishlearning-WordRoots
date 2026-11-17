import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, EmptyState, Panel, Ring, SectionHead } from '../components/ui';
import { lessons, nextLesson, weekOf } from '../lib/content';
import { useApp } from '../lib/store';
import { cursorPercent, decodeCursor, stageLabel, stepNumber } from '../components/session/cursor';
import type { LessonState } from '../lib/types';

function todayPercent(state: LessonState | undefined, restDay: boolean): number {
  if (restDay) return 100;
  if (!state) return 0;
  if (state.status === 'completed') return 100;
  return cursorPercent(state.cursor);
}

function greetingFor(hour: number): string {
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

const cellStyle: CSSProperties = {
  textAlign: 'left',
  background: 'var(--panel-2)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '10px 10px 12px',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  display: 'block',
  width: '100%',
};

function WeekDayCell({
  day,
  lesson,
  status,
  current,
  onOpen,
}: {
  day: number;
  lesson: { id: string; title: string } | undefined;
  status: LessonState['status'] | undefined;
  current: boolean;
  onOpen: () => void;
}) {
  const style: CSSProperties = {
    ...cellStyle,
    borderColor: current ? 'var(--accent)' : 'var(--line)',
    background: status === 'completed' ? 'var(--green-soft)' : 'var(--panel-2)',
    cursor: lesson ? 'pointer' : 'default',
  };
  const label = lesson ? (status === 'completed' ? '已完成' : status === 'in_progress' ? '进行中' : '未开始') : '暂无';
  const inner = (
    <>
      <div className="row-between" style={{ gap: 6 }}>
        <span className="tiny" style={{ fontWeight: 650 }}>
          D{day}
        </span>
        <span className={`dot ${status === 'completed' ? 'done' : current ? 'current' : ''}`} aria-hidden />
      </div>
      <div className="tiny" style={{ marginTop: 6, lineHeight: 1.4, minHeight: 36 }}>
        {lesson ? lesson.title : '暂无内容'}
      </div>
      <div className="tiny faint" style={{ marginTop: 4 }}>
        {label}
      </div>
    </>
  );
  if (!lesson) {
    return (
      <div style={style} className="fade-in">
        {inner}
      </div>
    );
  }
  return (
    <button type="button" style={style} className="fade-in" onClick={onOpen} title={lesson.title}>
      {inner}
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { settings, stats, plan, states, completedLessons } = useApp();

  const lesson = plan.lesson;
  const lessonState = lesson ? states[lesson.id] : undefined;
  const pending = nextLesson(completedLessons);
  const weekNo = lesson?.week ?? pending?.week ?? lessons[0]?.week ?? 1;
  const week = weekOf(weekNo);
  const reviewCount = plan.reviewCards.length;
  const percent = todayPercent(lessonState, plan.restDay);

  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now);

  const lede = plan.restDay
    ? '今天的任务已经清空：没有到期复习，也没有未完成的课程。'
    : lesson
      ? `今天约 ${settings.dailyMinutes} 分钟：${reviewCount} 张复习卡，加上第 ${lesson.week} 周第 ${lesson.day} 天的新课。`
      : `今天没有新课程，但有 ${reviewCount} 张卡片到期，先把它们复习掉。`;

  if (lessons.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="还没有课程内容"
          body="课程数据尚未载入。可以先打开知识库浏览词素与词条，或在设置里检查数据目录。"
          action={<Button onClick={() => navigate('/library')}>打开知识库</Button>}
        />
      </div>
    );
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const item = week?.lessons.find((l) => l.day === i + 1);
    return {
      day: i + 1,
      lesson: item,
      state: item ? states[item.id] : undefined,
    };
  });
  const weekDone = weekDays.filter((d) => d.state?.status === 'completed').length;

  const minutes = [
    { label: '复习', value: plan.minutes.review },
    { label: '学习', value: plan.minutes.learn },
    { label: '练习', value: plan.minutes.practice },
    { label: '应用', value: plan.minutes.apply },
  ];

  const ctaText = lesson
    ? !lessonState || lessonState.status === 'not_started'
      ? '开始今天的学习'
      : lessonState.status === 'in_progress'
        ? `继续学习（第 ${Math.max(1, stepNumber(lesson, lessonState.cursor, Math.min(8, reviewCount)))} 步）`
        : '今天已完成，回看本课'
    : '';

  const lastLesson = lessons[lessons.length - 1];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1>{greeting}</h1>
          <p className="lede">{lede}</p>
        </div>
        <div className="row" style={{ gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="tiny faint">连续学习</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 640 }}>{stats.streak} 天</div>
            <div className="tiny faint">{stats.streak === 0 ? '今天算第一天' : '别断了'}</div>
          </div>
          <Ring value={percent} label={`${percent}%`} />
        </div>
      </div>

      {plan.restDay ? (
        <Panel style={{ borderColor: 'var(--green)' }}>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Badge tone="green">今日已完成</Badge>
            <span className="tiny faint">没有到期复习，也没有未完成的课程</span>
          </div>
          <h2 style={{ marginBottom: 8 }}>今天的任务已完成</h2>
          <p className="small muted" style={{ maxWidth: 560 }}>
            新词不会在今天再堆进来。你可以把时间花在回顾上：翻一遍词素表，或者去构词实验室看看还没见过的组合。
          </p>
          <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
            <Button variant="primary" onClick={() => navigate('/library')}>
              复习词素
            </Button>
            <Button onClick={() => navigate('/matrix')}>去构词实验室</Button>
          </div>
        </Panel>
      ) : lesson ? (
        <Panel>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <Badge tone="accent">
                第 {lesson.week} 周 · 第 {lesson.day} 天
              </Badge>
              <Badge>{lesson.level}</Badge>
              {lessonState?.status === 'in_progress' ? <Badge tone="amber">进行中</Badge> : null}
            </div>
            <span className="tiny faint">今日计划 {settings.dailyMinutes} 分钟</span>
          </div>

          <h2 style={{ marginBottom: 6 }}>{lesson.title}</h2>
          <p className="lede" style={{ marginBottom: 0 }}>
            {lesson.tagline}
          </p>

          <ul className="small muted" style={{ margin: '12px 0 0', paddingLeft: '1.1em' }}>
            {lesson.objectives.slice(0, 2).map((objective) => (
              <li key={objective} style={{ marginBottom: 4 }}>
                {objective}
              </li>
            ))}
          </ul>

          <div className="grid grid-4" style={{ marginTop: 16, gap: 10 }}>
            {minutes.map((block) => (
              <div key={block.label} className="panel-flat" style={{ padding: '8px 12px' }}>
                <div className="tiny faint">{block.label}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 620 }}>
                  {block.value}
                  <span className="tiny faint"> 分</span>
                </div>
              </div>
            ))}
          </div>

          <div className="row wrap" style={{ gap: 12, marginTop: 18 }}>
            <Button variant="primary" size="lg" onClick={() => navigate(`/session/${lesson.id}`)}>
              {ctaText}
            </Button>
            {lessonState?.status === 'in_progress' ? (
              <span className="tiny faint">
                上次停在{stageLabel(decodeCursor(lessonState.cursor).stage)}阶段，进度已保存
              </span>
            ) : (
              <span className="tiny faint">离线可学，进度自动保存在本机</span>
            )}
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Badge tone="amber">{reviewCount} 张待复习</Badge>
          </div>
          <h2 style={{ marginBottom: 8 }}>只剩复习了</h2>
          <p className="small muted" style={{ maxWidth: 560 }}>
            12 周的新课已经全部学完，今天到期的是记忆卡片。复习同样会计入连续天数与记忆强度。
          </p>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <Button
              variant="primary"
              onClick={() => navigate(`/session/${lastLesson.id}?review=1`)}
            >
              开始今日复习
            </Button>
            <Button onClick={() => navigate('/stats')}>查看统计</Button>
          </div>
        </Panel>
      )}

      {!plan.restDay ? (
        <Panel style={{ marginTop: 16 }}>
          <div className="panel-title">
            <h3>今天要复习的卡片</h3>
            <Badge tone={reviewCount > 0 ? 'amber' : 'default'}>{reviewCount} 张</Badge>
          </div>
          {reviewCount > 0 ? (
            <>
              <p className="small muted" style={{ marginBottom: 6 }}>
                按记忆强度从低到高排列，学习会话的第一个阶段会逐张过一遍。
              </p>
              {plan.deferredCount > 0 ? (
                <p className="small faint" style={{ margin: 0 }}>
                  另有 {plan.deferredCount} 张为避免堆积已顺延到明天——时间预算优先给最危险的卡片。
                </p>
              ) : null}
              {lesson ? (
                <div className="row" style={{ marginTop: 12 }}>
                  <Button size="sm" onClick={() => navigate(`/session/${lesson.id}`)}>
                    在今日学习中开始复习
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="small faint" style={{ margin: 0 }}>
              今天没有到期的卡片。间隔重复的判断来自你的作答记录，不是固定日程。
            </p>
          )}
        </Panel>
      ) : null}

      <SectionHead
        title={`第 ${weekNo} 周${week ? ` · ${week.theme}` : ''}`}
        hint={week ? `本周完成 ${weekDone} / 7` : '本周课程尚未载入'}
        right={
          <Button size="sm" variant="ghost" onClick={() => navigate('/course')}>
            全部课程
          </Button>
        }
      />

      <Panel>
        <div className="scroll-x">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(100px, 1fr))', gap: 10, minWidth: 740 }}>
            {weekDays.map((item) => (
              <WeekDayCell
                key={item.day}
                day={item.day}
                lesson={item.lesson}
                status={item.state?.status}
                current={Boolean(lesson && item.lesson && item.lesson.id === lesson.id)}
                onOpen={() => {
                  if (item.lesson) navigate(`/session/${item.lesson.id}`);
                }}
              />
            ))}
          </div>
        </div>
        {week ? <div className="tiny faint" style={{ marginTop: 10 }}>{week.intro}</div> : null}
      </Panel>

      <SectionHead title="继续探索" hint="两个可以直接上手的功能" />
      <div className="grid grid-2">
        <Panel>
          <div className="panel-title">
            <h3>构词实验室</h3>
            <Badge>矩阵</Badge>
          </div>
          <p className="small muted">
            选一个词基，看前缀 × 后缀的矩阵：哪些组合是词典里真实存在的词，哪些只是形态上合法、语言里却没有。
          </p>
          <Button size="sm" onClick={() => navigate('/matrix')}>
            打开构词矩阵
          </Button>
        </Panel>
        <Panel>
          <div className="panel-title">
            <h3>词源词典</h3>
            <Badge>词条</Badge>
          </div>
          <p className="small muted">
            按字母或词根搜索词条，查看词素拆分、词源时间线与同族词。遇到“现代义不等于词根直拼”的词，会单独说明。
          </p>
          <Button size="sm" onClick={() => navigate('/word')}>
            搜索词条
          </Button>
        </Panel>
      </div>
    </div>
  );
}
