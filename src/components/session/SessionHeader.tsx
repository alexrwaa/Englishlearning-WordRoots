import { Badge, Button } from '../ui';
import type { Lesson } from '../../lib/types';
import type { StageInfo } from './cursor';
import { formatClock } from './format';

/**
 * Sticky session header: lesson identity, elapsed clock and the four-segment
 * pipeline. Segments already visited can be clicked; future ones are locked,
 * which enforces "回退可以，跳步不行".
 */
export function SessionHeader({
  lesson,
  stages,
  activeIndex,
  index,
  progress,
  maxReached,
  elapsedMs,
  onJump,
  onExit,
}: {
  lesson: Lesson;
  stages: StageInfo[];
  activeIndex: number;
  index: number;
  progress: number;
  maxReached: number;
  elapsedMs: number;
  onJump: (stageIndex: number) => void;
  onExit: () => void;
}) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 24px 10px' }}>
        <div className="row-between" style={{ gap: 12 }}>
          <Button size="sm" variant="ghost" onClick={onExit}>
            ← 返回首页
          </Button>

          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            <Badge tone="accent">
              第 {lesson.week} 周 · 第 {lesson.day} 天
            </Badge>
            <span
              className="small"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={lesson.title}
            >
              {lesson.title}
            </span>
          </div>

          <span className="mono small faint" aria-label="本课用时">
            {formatClock(elapsedMs)}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, stages.length)}, minmax(0, 1fr))`,
            gap: 8,
            marginTop: 10,
          }}
        >
          {stages.map((stage, i) => {
            const visited = i <= maxReached;
            const share = i < activeIndex ? 1 : i === activeIndex ? Math.min(1, Math.max(0, progress)) : 0;
            const counter =
              i < activeIndex ? '完成' : i === activeIndex ? `${index + 1} / ${stage.count}` : `${stage.count} 项`;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => onJump(i)}
                disabled={!visited || i === activeIndex}
                aria-current={i === activeIndex ? 'step' : undefined}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: visited && i !== activeIndex ? 'pointer' : 'default',
                  opacity: visited ? 1 : 0.45,
                }}
              >
                <div className="row-between" style={{ marginBottom: 5, gap: 6 }}>
                  <span
                    className="tiny"
                    style={{
                      fontWeight: i === activeIndex ? 700 : 500,
                      color: i === activeIndex ? 'var(--accent-ink)' : 'var(--ink-soft)',
                    }}
                  >
                    {stage.label}
                  </span>
                  <span className="tiny faint">{counter}</span>
                </div>
                <div className="bar" style={{ height: 4 }}>
                  <span style={{ width: `${Math.round(share * 100)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
