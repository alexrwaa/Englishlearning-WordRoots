/**
 * Cold-start instrumentation (docs/PERF.md).
 *
 * The app parses a large, static content bundle before the first route can
 * paint. To tell *where* that time goes we keep a handful of high-resolution
 * marks around the boot sequence:
 *
 *     boot → content-ready → first-route-render
 *
 * `performance.mark` doubles as a DevTools timeline entry and as the data the
 * probe (`scripts/perf-probe.mjs`) reads back through `window.__wrPerf`.
 *
 * Overhead is negligible on purpose: marking is a single `performance.mark`
 * call plus a dictionary write, and it stays enabled in production because the
 * numbers are the only way to diagnose a slow launch inside WebView2. Every
 * call is guarded, so a browser without `performance.mark` (or a unit-test
 * environment without one) degrades to plain timestamps.
 */

export type PerfMarks = Record<string, number>;
export type PerfMeasures = Record<string, number>;

export interface PerfSnapshot {
  /** Mark name → elapsed ms since this module loaded (first mark wins). */
  marks: PerfMarks;
  /** Named durations in ms, e.g. `boot→first-route-render`. */
  measures: PerfMeasures;
  /** `performance.now()` at snapshot time, for aligning with DevTools. */
  now: number;
}

const hasPerformance =
  typeof performance !== 'undefined' && typeof performance.now === 'function';
const canUserMark =
  typeof performance !== 'undefined' &&
  typeof performance.mark === 'function' &&
  typeof performance.measure === 'function';

const t0 = hasPerformance ? performance.now() : Date.now();

const marks: PerfMarks = Object.create(null) as PerfMarks;
const measures: PerfMeasures = Object.create(null) as PerfMeasures;

function now(): number {
  return hasPerformance ? performance.now() : Date.now();
}

/**
 * Record a named instant. The first call for a name wins, so a re-render never
 * overwrites the original cold-start point with a later, flattering number.
 */
export function mark(name: string): void {
  const at = now();
  if (marks[name] === undefined) marks[name] = Math.round((at - t0) * 10) / 10;
  if (canUserMark) {
    try {
      performance.mark(`wr:${name}`);
    } catch {
      /* a mark name collision must never break boot */
    }
  }
}

/**
 * Measure `start → end` (default end = now). Returns `undefined` when the
 * start mark was never recorded — a partial trace is not an error.
 */
export function measure(name: string, start: string, end?: string): number | undefined {
  const from = marks[start];
  if (from === undefined) return undefined;
  const to = end === undefined ? (now() - t0) : marks[end];
  if (to === undefined) return undefined;
  const ms = Math.round((to - from) * 10) / 10;
  if (measures[name] === undefined) measures[name] = ms;
  if (canUserMark) {
    try {
      performance.measure(`wr:${name}`, `wr:${start}`, end === undefined ? undefined : `wr:${end}`);
    } catch {
      /* measuring is best-effort only */
    }
  }
  return ms;
}

/** Read-only view for the probe and for the settings screen. */
export function perfSnapshot(): PerfSnapshot {
  return {
    marks: { ...marks },
    measures: { ...measures },
    now: Math.round((now() - t0) * 10) / 10,
  };
}

/** `0 → first-route-render`, the number a user would call "it opened". */
export function bootToFirstRenderMs(): number | undefined {
  return measures['boot→first-route-render'];
}

interface PerfApi {
  mark: typeof mark;
  measure: typeof measure;
  snapshot: typeof perfSnapshot;
}

declare global {
  interface Window {
    /** Present in every build; read by `scripts/perf-probe.mjs`. */
    __wrPerf?: PerfApi;
  }
}

if (typeof window !== 'undefined') {
  window.__wrPerf = { mark, measure, snapshot: perfSnapshot };
}

// The first mark of the whole trace. `mark` keeps the first value, so the
// explicit `mark('boot')` in `main.tsx` is a no-op kept for readability.
mark('boot');
