import { useEffect, useRef, useState } from 'react';
import { Badge } from '../ui';
import { POS_LABEL } from '../matrix/model';
import { RULE_LABELS } from '../../lib/derive';
import { VIRTUAL_THRESHOLD, windowFor } from './VirtualStack';
import type { AffixColumn, Cell, LadderRow } from './model';

const STATE_LABEL = {
  verified: '已收录',
  'rule-blocked': '规则不允许',
  unknown: '未收录',
} as const;

const STATE_HINT = {
  verified: '词库中存在这个词，点开可看完整派生链',
  'rule-blocked': '违反构词规则，点开查看原因',
  unknown: '拼写可成立，但词库未收录（未收录 ≠ 不存在）',
} as const;

/** Row geometry. Fixed, because a windowed list cannot measure every row. */
const ROW_HEIGHT = 56;
const ROW_GAP = 6;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;
const OVERSCAN = 3;
const MAX_VIEWPORT = 560;

/**
 * The ladder grid: rows are the base and its verified derivatives, columns are
 * the affixes that occur in this family. Every cell is one of three states, and
 * all three stay visible — an empty-looking cell is a conclusion, not a bug.
 *
 * Rows are windowed once the ladder is longer than a screenful: a big family
 * would otherwise mount one button per cell (29 rows x 12 affixes = 348 nodes)
 * for content the reader has to scroll to anyway. The header stays pinned, and
 * the grid reports how many rows it actually rendered.
 */
export function LabGrid({
  rows,
  columns,
  selected,
  onSelect,
}: {
  rows: LadderRow[];
  columns: AffixColumn[];
  selected: { word: string; affix: string } | null;
  onSelect: (row: LadderRow, cell: Cell) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(MAX_VIEWPORT);

  const virtual = rows.length > VIRTUAL_THRESHOLD;
  const { start, end } = virtual
    ? windowFor(rows.length, scrollTop, viewport, ROW_STRIDE, OVERSCAN)
    : { start: 0, end: rows.length };

  useEffect(() => {
    const el = ref.current;
    if (!el || !virtual) return;
    const measure = () => setViewport(Math.min(el.clientHeight || MAX_VIEWPORT, MAX_VIEWPORT));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtual]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  if (columns.length === 0) {
    return (
      <p className="small faint" style={{ margin: 0 }}>
        词库中没有可以加在这个词基上的前缀或后缀。
      </p>
    );
  }

  const template = `minmax(120px, auto) repeat(${columns.length}, minmax(88px, 1fr))`;
  const topPad = start > 0 ? start * ROW_STRIDE - ROW_GAP : 0;
  const bottomPad = end < rows.length ? (rows.length - end) * ROW_STRIDE : 0;

  return (
    <div
      className="lab-scroll"
      ref={ref}
      data-virtual={virtual}
      data-rendered-rows={end - start}
      data-total-rows={rows.length}
      onScroll={
        virtual
          ? (e) => {
              const next = e.currentTarget.scrollTop;
              if (frame.current) return;
              frame.current = requestAnimationFrame(() => {
                frame.current = 0;
                setScrollTop(next);
              });
            }
          : undefined
      }
    >
      <div className="lab-grid" data-virtual={virtual} style={{ gridTemplateColumns: template }}>
        <div className="lab-corner tiny faint lab-head">
          词基 ╲ 加成分
        </div>
        {columns.map((col) => (
          <div key={`${col.kind}-${col.form}`} className="lab-col-head lab-head">
            <span className="mono">{col.kind === 'prefix' ? `${col.form}-` : `-${col.form}`}</span>
            <span className="tiny faint">{col.kind === 'prefix' ? '前缀' : '后缀'}</span>
          </div>
        ))}

        {topPad > 0 ? <div aria-hidden style={{ gridColumn: '1 / -1', height: topPad }} /> : null}

        {rows.slice(start, end).map((row) => (
          <Row key={row.node.word} row={row} selected={selected} onSelect={onSelect} />
        ))}

        {bottomPad > 0 ? <div aria-hidden style={{ gridColumn: '1 / -1', height: bottomPad }} /> : null}
      </div>

      <div className="row tiny faint lab-legend" style={{ marginTop: 10, gap: 14, flexWrap: 'wrap' }}>
        <span>
          <span className="lab-legend-dot" data-state="verified" /> 已收录：词库中有这个词
        </span>
        <span>
          <span className="lab-legend-dot" data-state="unknown" /> 未收录：拼写成立，词库没有（未收录 ≠ 不存在）
        </span>
        <span>
          <span className="lab-legend-dot" data-state="rule-blocked" /> 规则不允许：给出原因
        </span>
        <span>
          {rows.length} 个词基层 · {columns.length} 个加成分列
        </span>
        {virtual ? (
          <span className="lab-window-note">
            窗口化：只渲染 {end - start} / {rows.length} 行（滚动时按需挂载）
          </span>
        ) : null}
        {columns.length > 8 ? <span>← 表格可左右滚动查看全部列 →</span> : null}
      </div>
    </div>
  );
}

function Row({
  row,
  selected,
  onSelect,
}: {
  row: LadderRow;
  selected: { word: string; affix: string } | null;
  onSelect: (row: LadderRow, cell: Cell) => void;
}) {
  const { node } = row;
  return (
    <>
      <div className="lab-row-head" data-dim={!row.matches} style={{ paddingLeft: 6 + node.depth * 10 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="mono tiny faint">L{node.depth}</span>
          <span className="word" style={{ fontSize: 15 }}>
            {node.word}
          </span>
        </div>
        <div className="row" style={{ gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
          {node.pos ? <span className="tiny faint">{POS_LABEL[node.pos] ?? node.pos}</span> : null}
          {node.known ? null : <span className="tiny" style={{ color: 'var(--amber)' }}>词库未收录</span>}
          {node.steps.length > 0 ? <span className="tiny faint">{node.steps.length} 步派生</span> : null}
        </div>
      </div>

      {row.cells.map((cell) => {
        const active = selected?.word === node.word && selected.affix === cell.affix.form;
        const entry = cell.verdict.state === 'verified' ? cell.verdict.word : '';
        const dim = !cell.matches || !row.matches;
        return (
          <button
            key={`${node.word}-${cell.affix.kind}-${cell.affix.form}`}
            type="button"
            className="lab-cell"
            data-state={cell.verdict.state}
            data-active={active}
            data-dim={dim}
            onClick={() => onSelect(row, cell)}
            title={`${node.word} ${cell.affix.kind === 'prefix' ? `+ ${cell.affix.form}-` : `+ -${cell.affix.form}`} → ${cell.verdict.word}\n${STATE_LABEL[cell.verdict.state]}｜${STATE_HINT[cell.verdict.state]}`}
            aria-label={`${node.word} 加 ${cell.affix.form}：${STATE_LABEL[cell.verdict.state]}`}
          >
            {cell.verdict.state === 'verified' ? (
              <>
                <span className="lab-cell-word">{entry}</span>
                <span className="lab-cell-sub">{STATE_LABEL.verified}</span>
              </>
            ) : cell.verdict.state === 'rule-blocked' ? (
              <>
                <span className="lab-cell-mark" aria-hidden>
                  ×
                </span>
                <span className="lab-cell-sub">{STATE_LABEL['rule-blocked']}</span>
              </>
            ) : (
              <>
                <span className="lab-cell-mark" aria-hidden>
                  ·
                </span>
                <span className="lab-cell-sub">{STATE_LABEL.unknown}</span>
              </>
            )}
          </button>
        );
      })}
    </>
  );
}

/** Compact state badge shared with the detail panel. */
export function StateBadge({ state }: { state: Cell['verdict']['state'] }) {
  const tone = state === 'verified' ? 'green' : state === 'rule-blocked' ? 'red' : 'amber';
  return <Badge tone={tone}>{STATE_LABEL[state]}</Badge>;
}

/**
 * Persistent three-state key. The grid footer carries a compact version; this
 * block is the one shown above the matrix, where a reader meets the states for
 * the first time.
 */
export function StateLegend() {
  return (
    <div className="lab-state-legend">
      <div>
        <span className="lab-legend-dot" data-state="verified" />
        <strong>已收录</strong>
        <span className="tiny faint">词库里有这个词，判定来自词条本身</span>
      </div>
      <div>
        <span className="lab-legend-dot" data-state="unknown" />
        <strong>未收录</strong>
        <span className="tiny faint">拼写符合规则，但词库没有（未收录 ≠ 不存在）</span>
      </div>
      <div>
        <span className="lab-legend-dot" data-state="rule-blocked" />
        <strong>规则不允许</strong>
        <span className="tiny faint">违反构词顺序或搭配，会给出具体原因</span>
      </div>
    </div>
  );
}

/**
 * Inline echo of the selected cell, shown right under the grid so the reader
 * gets the verdict without leaving the matrix for the detail panel.
 */
export function CellSummary({
  word,
  affix,
  kind,
  verdict,
  glossZh,
}: {
  word: string;
  affix: string;
  kind: 'prefix' | 'suffix';
  verdict: Cell['verdict'];
  glossZh?: string;
}) {
  return (
    <div className="lab-summary">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <StateBadge state={verdict.state} />
        <span className="word" style={{ fontSize: 15 }}>
          {verdict.word}
        </span>
        <span className="mono tiny faint">
          {word} {kind === 'prefix' ? `+ ${affix}-` : `+ -${affix}`}
        </span>
        {verdict.state === 'verified' && glossZh ? <span className="small muted">{glossZh}</span> : null}
      </div>
      <div className="tiny faint" style={{ marginTop: 3, lineHeight: 1.6 }}>
        {verdict.state === 'verified'
          ? `词库已确认｜规则：${RULE_LABELS[verdict.rule as keyof typeof RULE_LABELS] ?? verdict.rule}`
          : verdict.reason}
      </div>
    </div>
  );
}
