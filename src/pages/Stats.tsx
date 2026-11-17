import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { labelFor, lessons } from '../lib/content';
import type { MemoryCard } from '../lib/types';
import { Button, EmptyState, Panel, SectionHead, Stat } from '../components/ui';
import TrendChart, { type TrendPoint } from '../components/stats/TrendChart';
import BarChart, { type BarDatum } from '../components/stats/BarChart';
import KindAccuracy, { type KindRow } from '../components/stats/KindAccuracy';
import WeakList, { type WeakItem } from '../components/stats/WeakList';

const KIND_LABELS: Record<string, string> = {
  mcq: '选择题',
  cloze: '语境填空',
  wordSum: '构词算式',
  matrix: '词族矩阵',
  infer: '迁移推理',
};
const KIND_ORDER = ['mcq', 'cloze', 'wordSum', 'matrix', 'infer'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Date keys for the last `n` days, oldest first, ending today (local time). */
function lastDays(n: number): string[] {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/** Readable name for a card ref: concepts and morphemes have labels, bare
 *  exercise ids (application-stage transfer cards) need a prefix to make sense. */
function cardLabel(card: MemoryCard): string {
  const raw = card.refId.startsWith('infer:') ? card.refId.slice('infer:'.length) : card.refId;
  const label = labelFor(raw);
  if (label !== raw) return label;
  return card.kind === 'inference' ? `应用推理 · ${raw}` : raw;
}

export default function Stats() {
  const { stats, cards, completedLessons } = useApp();
  const navigate = useNavigate();

  const byDay = useMemo(() => new Map(stats.daily.map((d) => [d.date, d])), [stats.daily]);
  const days30 = useMemo(() => lastDays(30), []);
  const days14 = useMemo(() => lastDays(14), []);

  const trend = useMemo<TrendPoint[]>(
    () =>
      days30.map((key) => {
        const d = byDay.get(key);
        const minutes = Math.round((d?.minutes ?? 0) * 10) / 10;
        const reviews = d?.reviews ?? 0;
        return {
          key,
          value: minutes,
          hint: `${key} · ${minutes} 分钟${reviews > 0 ? ` · 复习 ${reviews} 次` : ''}`,
        };
      }),
    [days30, byDay],
  );

  const reviewBars = useMemo<BarDatum[]>(
    () =>
      days14.map((key) => {
        const reviews = byDay.get(key)?.reviews ?? 0;
        return { key, value: reviews, hint: `${key} · 复习 ${reviews} 次` };
      }),
    [days14, byDay],
  );

  const kindRows = useMemo<KindRow[]>(() => {
    const found = new Map(stats.kinds.map((k) => [k.kind, k]));
    const known = KIND_ORDER.map((kind) => {
      const s = found.get(kind);
      return { kind, label: KIND_LABELS[kind], correct: s?.correct ?? 0, total: s?.total ?? 0 };
    });
    const extra = stats.kinds
      .filter((k) => !KIND_ORDER.includes(k.kind))
      .map((k) => ({ kind: k.kind, label: KIND_LABELS[k.kind] ?? k.kind, correct: k.correct, total: k.total }));
    return [...known, ...extra];
  }, [stats.kinds]);

  const weak = useMemo<WeakItem[]>(
    () =>
      Object.values(cards)
        .filter((c) => c.lapses >= 2)
        .sort((a, b) => b.lapses - a.lapses || a.stability - b.stability)
        .slice(0, 8)
        .map((c) => ({
          id: c.cardId,
          label: cardLabel(c),
          lapses: c.lapses,
          stability: Math.round(c.stability),
          kind: c.kind === 'inference' ? ('迁移' as const) : ('记忆' as const),
        })),
    [cards],
  );

  const hasData = stats.totals.attempts > 0 || Object.keys(cards).length > 0;
  const totalMinutes = Math.round(stats.totals.totalMinutes);
  const trendTotal = Math.round(trend.reduce((sum, p) => sum + p.value, 0));
  const trendEmpty = trend.every((p) => p.value === 0);
  const reviewsEmpty = reviewBars.every((b) => b.value === 0);

  const inferStat = stats.kinds.find((k) => k.kind === 'infer');
  const inferAnswered = inferStat?.total ?? 0;
  const inferPct = inferAnswered > 0 ? Math.round(stats.inferenceAccuracy * 100) : null;

  const head = (
    <header className="page-head">
      <div>
        <div className="eyebrow">学习统计</div>
        <h1>你的真实进度</h1>
        <p className="lede">
          所有数字都来自你的作答记录。记忆与迁移分开评分，因为它们测的是两种不同的能力，不该被平均成一个分数。
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/course')}>
        查看课程进度
      </Button>
    </header>
  );

  if (!hasData) {
    return (
      <div className="page">
        {head}
        <Panel>
          <EmptyState
            title="还没有学习数据"
            body="完成第一课后这里会出现真实数据：学习时长曲线、复习量、各题型的正确率，以及记忆与迁移两种能力的独立评分。"
            action={
              <Button variant="primary" size="lg" onClick={() => navigate('/')}>
                开始今天的学习
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      {head}

      <div className="grid grid-4">
        <Panel>
          <Stat label="连续天数" value={`${stats.streak} 天`} hint={`累计活跃 ${stats.totals.activeDays} 天`} />
        </Panel>
        <Panel>
          <Stat
            label="总学习时长"
            value={
              totalMinutes === 0
                ? '0 分钟'
                : totalMinutes < 1
                  ? '不足 1 分钟'
                  : totalMinutes < 60
                    ? `${totalMinutes} 分钟`
                    : `${(totalMinutes / 60).toFixed(1)} 小时`
            }
            hint={`累计 ${totalMinutes} 分钟`}
          />
        </Panel>
        <Panel>
          <Stat
            label="完成课程"
            value={`${completedLessons.size} / ${lessons.length}`}
            hint={completedLessons.size > 0 ? '按内置课程总数计' : '还没有完成的课程'}
          />
        </Panel>
        <Panel>
          <Stat label="已掌握词素" value={stats.morphemesMastered} hint="稳定期 ≥ 21 天" />
        </Panel>
      </div>

      <SectionHead title="近 30 天学习时长" hint="按每道题的作答时长累计，不含页面停留时间。" />
      <Panel>
        {trendEmpty ? (
          <p className="small faint" style={{ margin: 0 }}>
            近 30 天还没有作答记录，完成一次练习后这里会出现曲线。
          </p>
        ) : (
          <>
            <TrendChart points={trend} unit="分钟" ariaLabel="近 30 天每日学习时长折线图" />
            <div className="row-between" style={{ marginTop: 10 }}>
              <span className="tiny faint">横轴为日期（每 5 天标注），纵轴为当日分钟数，最大值自动取整。</span>
              <span className="tiny muted mono">合计 {trendTotal} 分钟</span>
            </div>
          </>
        )}
      </Panel>

      <SectionHead title="近 14 天复习量" hint="每天完成的间隔重复卡片数，包含课内复习与应用阶段。" />
      <Panel>
        {reviewsEmpty ? (
          <p className="small faint" style={{ margin: 0 }}>
            近 14 天还没有复习记录。复习卡到期后会出现在今日学习中。
          </p>
        ) : (
          <>
            <BarChart bars={reviewBars} unit="次" ariaLabel="近 14 天每日复习次数柱状图" />
            <div className="tiny faint" style={{ marginTop: 10 }}>
              柱高为当天的复习次数；悬停可查看具体日期。
            </div>
          </>
        )}
      </Panel>

      <SectionHead title="能力分栏" hint="记忆与迁移各算各的：能背出含义，不等于能在生词里用出来。" />
      <div className="grid grid-2">
        <Panel>
          <div className="panel-title">
            <h3>记忆</h3>
            <span className="tiny faint">能想起词素 / 规则的含义</span>
          </div>
          <div className="grid grid-2" style={{ gap: 20 }}>
            <Stat label="已掌握词素" value={stats.morphemesMastered} hint="处于复习状态且稳定期 ≥ 21 天" />
            <Stat label="已掌握规则" value={stats.rulesMastered} hint="构词规则与概念条目" />
          </div>
          <p className="small muted" style={{ margin: '14px 0 0' }}>
            记忆评分看的是词素与规则本身：看到 <span className="morph">struct</span> 能想起“建造”，
            看到一条构词规则能说出它约束什么。
          </p>
        </Panel>
        <Panel>
          <div className="panel-title">
            <h3>迁移</h3>
            <span className="tiny faint">把知识用到陌生长词上</span>
          </div>
          <Stat
            label="迁移正确率"
            value={inferPct === null ? '暂无记录' : `${inferPct}%`}
            hint={inferAnswered > 0 ? `基于 ${inferAnswered} 道应用阶段的推理题` : '完成应用阶段后开始评分'}
          />
          <p className="small muted" style={{ margin: '14px 0 0' }}>
            迁移只看应用阶段的推理题：面对没学过的长词，能否拆开词素、猜出大意并说明理由。它与记忆是两种能力，
            独立评分，不会因为背得牢就被抬高。
          </p>
        </Panel>
      </div>

      <SectionHead title="题型正确率" hint="按首次作答统计，重试不计入。" />
      <Panel>
        <KindAccuracy rows={kindRows} />
      </Panel>

      <SectionHead title="薄弱知识" hint="失误 2 次及以上的卡片，按失误次数排序，最多 8 条。" />
      <Panel>
        {weak.length === 0 ? (
          <p className="small faint" style={{ margin: 0 }}>
            还没有足够数据判断薄弱点。同一个知识点反复答错、遗忘后，会出现在这里。
          </p>
        ) : (
          <>
            <WeakList items={weak} />
            <div className="tiny faint" style={{ marginTop: 12 }}>
              点击任意一条可跳到知识库重读词素与规则；这些卡片也会在复习中优先出现。
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
