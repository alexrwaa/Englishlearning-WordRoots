import { Badge } from '../ui';
import { POS_LABEL } from '../matrix/model';
import { RULE_LABELS } from '../../lib/derive';
import type { AffixColumn, Cell, LadderRow } from './model';

const STATE_LABEL = {
  verified: '已收录',
  'rule-blocked': '规则不允许',
  unknown: '未收录',
} as const;

const STATE_HINT = {
  verified: '词库中存在这个词，点开可看完整派生链',
  'rule-blocked': '违反构词规则，点开查看原因',
  unknown: '拼写可成立，但词库未收录（不等于不存在）',
} as const;

/**
 * The ladder grid: rows are the base and its verified derivatives, columns are
 * the affixes that occur in this family. Every cell is one of three states, and
 * all three stay visible — an empty-looking cell is a conclusion, not a bug.
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
  if (columns.length === 0) {
    return (
      <p className="small faint" style={{ margin: 0 }}>
        词库中没有可以加在这个词基上的前缀或后缀。
      </p>
    );
  }

  return (
    <div className="scroll-x">
      <div
        className="lab-grid"
        style={{ gridTemplateColumns: `minmax(112px, auto) repeat(${columns.length}, minmax(88px, 1fr))` }}
      >
        <div className="lab-corner tiny faint">
          词基 ╲ 加成分
        </div>
        {columns.map((col) => (
          <div key={`${col.kind}-${col.form}`} className="lab-col-head">
            <span className="mono">{col.kind === 'prefix' ? `${col.form}-` : `-${col.form}`}</span>
            <span className="tiny faint">{col.kind === 'prefix' ? '前缀' : '后缀'}</span>
          </div>
        ))}

        {rows.map((row) => (
          <Row key={row.node.word} row={row} selected={selected} onSelect={onSelect} />
        ))}
      </div>

      <div className="row tiny faint" style={{ marginTop: 10, gap: 14, flexWrap: 'wrap' }}>
        <span>
          <span className="lab-legend-dot" data-state="verified" /> 已收录：词库中有这个词
        </span>
        <span>
          <span className="lab-legend-dot" data-state="unknown" /> 未收录：拼写成立，词库没有
        </span>
        <span>
          <span className="lab-legend-dot" data-state="rule-blocked" /> 规则不允许：给出原因
        </span>
        <span>
          {rows.length} 个词基层 · {columns.length} 个加成分列
        </span>
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
      <div className="lab-row-head" style={{ paddingLeft: 6 + node.depth * 10 }}>
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
        return (
          <button
            key={`${node.word}-${cell.affix.kind}-${cell.affix.form}`}
            type="button"
            className="lab-cell"
            data-state={cell.verdict.state}
            data-active={active}
            data-dim={!cell.matches}
            onClick={() => onSelect(row, cell)}
            title={`${node.word} ${cell.affix.kind === 'prefix' ? `+ ${cell.affix.form}-` : `+ -${cell.affix.form}`} → ${cell.verdict.word}\n${STATE_HINT[cell.verdict.state]}`}
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
