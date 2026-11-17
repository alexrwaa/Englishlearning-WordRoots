import { niceMax, shortDate, tickText } from './scale';

export interface TrendPoint {
  /** Stable date key, "YYYY-MM-DD". */
  key: string;
  value: number;
  /** Tooltip text shown on hover. */
  hint: string;
}

interface Props {
  points: TrendPoint[];
  /** Unit shown at the top-left corner of the plot, e.g. "分钟". */
  unit: string;
  ariaLabel: string;
}

const W = 640;
const H = 180;
const PAD = { top: 14, right: 12, bottom: 26, left: 40 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

/**
 * 30-day line chart. Drawn by hand: the x index is mapped linearly onto the
 * plot width, the y value onto the plot height using a rounded data maximum.
 */
export default function TrendChart({ points, unit, ariaLabel }: Props) {
  const n = points.length;
  if (n === 0) return null;

  const yMax = niceMax(Math.max(...points.map((p) => p.value)));
  const xAt = (i: number) => PAD.left + (n <= 1 ? IW / 2 : (i / (n - 1)) * IW);
  const yAt = (v: number) => PAD.top + IH - (v / yMax) * IH;
  const baseY = PAD.top + IH;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${xAt(n - 1).toFixed(1)} ${baseY.toFixed(1)} L${xAt(0).toFixed(1)} ${baseY.toFixed(1)} Z`;
  const slot = n > 1 ? IW / (n - 1) : IW;

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
              x={PAD.left - 7}
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

      <text x={4} y={PAD.top - 3} fontSize={10} fill="var(--ink-faint)">
        {unit}
      </text>

      <path d={area} fill="var(--accent-soft)" fillOpacity={0.65} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => {
        const x = xAt(i);
        const y = yAt(p.value);
        const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        const showLabel = i % 5 === 0 || i === n - 1;
        return (
          <g key={p.key}>
            {/* Wide invisible hit area so the tooltip is easy to trigger. */}
            <rect
              x={x - slot / 2}
              y={PAD.top}
              width={Math.max(slot, 6)}
              height={IH}
              fill="transparent"
              style={{ cursor: 'default' }}
            >
              <title>{p.hint}</title>
            </rect>
            <circle cx={x} cy={y} r={p.value > 0 ? 2.6 : 1.8} fill="var(--accent)">
              <title>{p.hint}</title>
            </circle>
            {showLabel ? (
              <text x={x} y={H - 8} fontSize={9.5} fill="var(--ink-faint)" textAnchor={anchor}>
                {shortDate(p.key)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
