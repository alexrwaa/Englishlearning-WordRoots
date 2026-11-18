/**
 * Study-time accounting.
 *
 * Wall-clock time is a bad proxy for study time: a tab left in the background
 * overnight or a question left open during lunch would be counted as learning.
 * A phase timer therefore only accumulates while the page is both visible and
 * focused, and caps each uninterrupted stretch at three minutes so that an
 * abandoned question cannot inflate the day's total.
 *
 * The timer is deliberately transport-free: it knows nothing about exercises or
 * the database, which makes it deterministic to unit-test with a fake clock and
 * a fake visibility environment.
 */

/** Longest uninterrupted stretch (ms) counted for a single visible segment. */
export const MAX_SEGMENT_MS = 180_000;

export interface TimingEnvironment {
  /** Monotonic clock in milliseconds. */
  now(): number;
  /** True only when the page is visible and the window has focus. */
  isActive(): boolean;
  /** Optional subscription to visibility/focus changes. Returns an unsubscribe. */
  subscribe?(onChange: () => void): () => void;
}

export interface PhaseTimerOptions {
  /** Time already spent before this timer was created (e.g. a resumed lesson). */
  initialMs?: number;
  /** Override the 180 s idle cap (used by the session-level clock). */
  maxSegmentMs?: number;
  /** Injectable environment for tests. */
  env?: TimingEnvironment;
}

export interface PhaseTimer {
  /** Begin counting. Idempotent. */
  start(): void;
  /** Stop counting; the current segment is committed. */
  pause(): void;
  /** Continue counting after `pause()`. Idempotent. */
  resume(): void;
  /** Total counted time so far, including the open segment. Does not mutate. */
  elapsed(): number;
  /** Commit and return the time since the previous `take()` / creation, in whole ms. */
  take(): number;
  /** Discard all counted time and restart the current segment. */
  reset(): void;
  /** Commit, stop listening to visibility changes and freeze the timer. */
  dispose(): void;
  /** True while the timer accepts active time (even if currently off-screen). */
  isRunning(): boolean;
}

function defaultEnvironment(): TimingEnvironment {
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now();

  const isActive = () => {
    if (typeof document === 'undefined') return true;
    if (document.visibilityState !== 'visible') return false;
    // `hasFocus` is not implemented by every test DOM; when it is missing we
    // treat visibility as sufficient rather than silently counting nothing.
    return typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  };

  return {
    now,
    isActive,
    subscribe(onChange) {
      if (typeof document === 'undefined') return () => {};
      const update = () => onChange();
      document.addEventListener('visibilitychange', update);
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', update);
        window.addEventListener('blur', update);
      }
      return () => {
        document.removeEventListener('visibilitychange', update);
        if (typeof window !== 'undefined') {
          window.removeEventListener('focus', update);
          window.removeEventListener('blur', update);
        }
      };
    },
  };
}

export function createPhaseTimer(options: PhaseTimerOptions = {}): PhaseTimer {
  const env = options.env ?? defaultEnvironment();
  const cap = Math.max(1, options.maxSegmentMs ?? MAX_SEGMENT_MS);

  let totalMs = Math.max(0, options.initialMs ?? 0);
  let segmentStart: number | null = null;
  let running = false;
  let disposed = false;
  let unsubscribe: (() => void) | null = null;

  const attach = () => {
    if (unsubscribe || !env.subscribe) return;
    unsubscribe = env.subscribe(() => {
      if (disposed) return;
      if (env.isActive()) openSegment();
      else commit();
    });
  };

  const openSegment = () => {
    if (!running || segmentStart !== null || !env.isActive()) return;
    attach();
    segmentStart = env.now();
  };

  const commit = () => {
    if (segmentStart === null) return;
    const delta = Math.max(0, env.now() - segmentStart);
    totalMs += Math.min(delta, cap);
    segmentStart = null;
  };

  return {
    start() {
      if (running) return;
      // A disposed timer may be revived: React StrictMode mounts, unmounts and
      // re-mounts effects, and the same instance is reused in between.
      disposed = false;
      running = true;
      attach();
      openSegment();
    },
    pause() {
      commit();
      running = false;
    },
    resume() {
      if (running) return;
      disposed = false;
      running = true;
      attach();
      openSegment();
    },
    elapsed() {
      const open = segmentStart === null ? 0 : Math.min(Math.max(0, env.now() - segmentStart), cap);
      return Math.round(totalMs + open);
    },
    take() {
      commit();
      const value = Math.round(totalMs);
      totalMs = 0;
      openSegment();
      return value;
    },
    reset() {
      totalMs = 0;
      segmentStart = running && env.isActive() ? env.now() : null;
    },
    dispose() {
      commit();
      running = false;
      disposed = true;
      unsubscribe?.();
      unsubscribe = null;
    },
    isRunning() {
      return running && !disposed;
    },
  };
}
