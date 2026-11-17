import { niceMax, shortDate, tickText } from './scale';

export interface BarDatum {
  /** Stable date key, "YYYY-MM-DD". */
  key: string;
  value: number;
  /** Tooltip text shown on hover. */
  hint: string;
}

interface Props {
  bars: BarDatum[];
  unit: string;
  ariaLabel: string;
}

const W = 640;
const H = 160;
const PAD = { top: 18, right: 10, bottom: 26, left: 34 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

/** 14-day bar chart for daily review counts. */
export default function BarChart({ bars, unit, ariaLabel }: Props) {
  const n = bars.length;
  if (n === 0) return null;

  const yMax = niceMax(Math.max(...bars.map((b) => b.value)));
  const slot = IW / n;
  const barW = Math.min(26, slot * 0.6);
  const yAt = (v: number) => PAD.top + IH - (v / yMax) * IH;
  const baseY = PAD.top + IH;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {[0, 0.5, 1].map((ratio) => {
        const y = PAD.top + IH - ratio * IH;
        return (
          <g key={ratio}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray={ratio === 0 ? undefined : '3 4'}
            />
            <text
              x={PAD.left - 6}
              y={y}
              fontSize={10}
              fill="var(--ink-faint)"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {tickText(yMax * ratio)}
            </text>
          </g>
        );
      })}

      <text x={2} y={PAD.top - 6} fontSize={10} fill="var(--ink-faint)">
        {unit}
      </text>

      {bars.map((b, i) => {
        const x = PAD.left + slot * i + (slot - barW) / 2;
        const y = yAt(b.value);
        const h = Math.max(b.value > 0 ? 2 : 0, baseY - y);
        const showLabel = i % 2 === 0 || i === n - 1;
        return (
          <g key={b.key}>
            {b.value > 0 ? (
              <rect x={x} y={y} width={barW} height={h} rx={3} fill="var(--accent)">
                <title>{b.hint}</title>
              </rect>
            ) : (
              <rect x={x} y={baseY - 1.5} width={barW} height={1.5} rx={1} fill="var(--line-strong)">
                <title>{b.hint}</title>
              </rect>
            )}
            {b.value > 0 ? (
              <text x={x + barW / 2} y={y - 4} fontSize={9} fill="var(--ink-soft)" textAnchor="middle">
                {b.value}
              </text>
            ) : null}
            {showLabel ? (
              <text x={x + barW / 2} y={H - 8} fontSize={9} fill="var(--ink-faint)" textAnchor="middle">
                {shortDate(b.key)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
