import { Fragment } from 'react';
import type { BuildResult } from '../../lib/morph';
import { truncate } from './model';

export interface GridCell {
  suffix: string;
  result: BuildResult;
  /** False when the current filters hide this cell. */
  matches: boolean;
}

export interface GridRow {
  prefix: string;
  cells: GridCell[];
}

const EMPTY_HINT = '该组合在词库中未收录（形态可能合法，但英语中不存在该词）';
const FILTER_HINT = '该格被当前筛选条件隐藏';

/**
 * The matrix itself: rows = prefixes, columns = suffixes, corner = the base.
 * Unattested combinations stay visible as dotted placeholders — the empty
 * space is the conclusion, not a bug.
 */
export function MatrixGrid({
  base,
  rows,
  suffixes,
  selected,
  onSelect,
}: {
  base: string;
  rows: GridRow[];
  suffixes: string[];
  selected: { prefix: string; suffix: string } | null;
  onSelect: (prefix: string, suffix: string) => void;
}) {
  return (
    <div className="scroll-x">
      <div
        className="matrix-grid"
        style={{
          gridTemplateColumns: `minmax(76px, auto) repeat(${Math.max(suffixes.length, 1)}, minmax(104px, 1fr))`,
          minWidth: 76 + suffixes.length * 104,
        }}
      >
        <div
          className="matrix-base"
          style={{ fontSize: 17, padding: '8px 10px', display: 'grid', placeItems: 'center' }}
          title="词基"
        >
          {base}
        </div>
        {suffixes.map((suffix) => (
          <div
            key={`head-${suffix || 'none'}`}
            className="mono tiny"
            style={{ textAlign: 'center', alignSelf: 'center', color: 'var(--ink-soft)' }}
          >
            {suffix ? `-${suffix}` : '— 无后缀 —'}
          </div>
        ))}

        {rows.map((row) => (
          <Fragment key={`row-${row.prefix || 'none'}`}>
            <div
              className="mono tiny"
              style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-soft)' }}
            >
              {row.prefix ? `${row.prefix}-` : '— 无前缀 —'}
            </div>
            {row.cells.map((cell) => {
              const { result } = cell;
              const entry = result.entry;
              const active =
                selected !== null && selected.prefix === row.prefix && selected.suffix === cell.suffix;

              if (result.attested && entry) {
                return (
                  <button
                    key={`${row.prefix}-${cell.suffix}`}
                    type="button"
                    className="morph-tile"
                    data-active={active}
                    onClick={() => onSelect(row.prefix, cell.suffix)}
                    title={`${result.word}｜${entry.glossZh}`}
                    style={{
                      opacity: cell.matches ? 1 : 0.3,
                      display: 'grid',
                      gap: 2,
                      alignContent: 'center',
                      minHeight: 52,
                      padding: '6px 8px',
                    }}
                  >
                    <span className="word" style={{ fontSize: 14.5 }}>
                      {result.word}
                    </span>
                    <span
                      className="tiny"
                      style={{
                        color: active ? 'inherit' : 'var(--ink-soft)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {truncate(entry.glossZh, 10)}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={`${row.prefix}-${cell.suffix}`}
                  className="morph-tile"
                  title={cell.matches ? EMPTY_HINT : FILTER_HINT}
                  aria-label={`${row.prefix || '无前缀'} + ${base} + ${cell.suffix || '无后缀'}：未收录`}
                  style={{
                    borderStyle: 'dashed',
                    background: 'transparent',
                    cursor: 'default',
                    color: 'var(--ink-faint)',
                    display: 'grid',
                    placeItems: 'center',
                    minHeight: 52,
                    opacity: cell.matches ? 1 : 0.35,
                  }}
                >
                  ·
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="row tiny faint" style={{ marginTop: 10, gap: 14, flexWrap: 'wrap' }}>
        <span>
          <span className="mono">·</span> 虚线格 = 未收录
        </span>
        <span>{suffixes.length} 个后缀列</span>
        <span>{rows.length} 个前缀行</span>
      </div>
    </div>
  );
}
