import { describe, expect, it } from 'vitest';
import { MAX_SEGMENT_MS, createPhaseTimer, type TimingEnvironment } from './timing';

/**
 * Deterministic clock + visibility harness. `advance` moves the clock without
 * changing focus; `setActive` simulates the document becoming visible/focused
 * or hidden/blurred and notifies the timer exactly like the browser would.
 */
function harness(startActive = true, maxSegmentMs?: number) {
  let clock = 0;
  let active = startActive;
  const listeners = new Set<() => void>();
  const env: TimingEnvironment = {
    now: () => clock,
    isActive: () => active,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  const timer = createPhaseTimer({ env, maxSegmentMs });
  return {
    timer,
    advance(ms: number) {
      clock += ms;
    },
    setActive(next: boolean) {
      active = next;
      for (const listener of [...listeners]) listener();
    },
    get clock() {
      return clock;
    },
  };
}

describe('phase timer', () => {
  it('counts time while the page is visible and focused', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(5_000);
    expect(h.timer.elapsed()).toBe(5_000);
  });

  it('does not count a hidden or unfocused page', () => {
    const h = harness(false);
    h.timer.start();
    h.advance(30_000);
    expect(h.timer.elapsed()).toBe(0);

    h.setActive(true);
    h.advance(3_000);
    expect(h.timer.elapsed()).toBe(3_000);
  });

  it('stops counting when focus is lost and resumes when it returns', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(2_000);
    h.setActive(false);
    h.advance(60_000);
    expect(h.timer.elapsed()).toBe(2_000);

    h.setActive(true);
    h.advance(1_000);
    expect(h.timer.elapsed()).toBe(3_000);
  });

  it('caps one uninterrupted visible stretch at 180 seconds', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(300_000);
    expect(h.timer.elapsed()).toBe(MAX_SEGMENT_MS);
    expect(MAX_SEGMENT_MS).toBe(180_000);
  });

  it('applies the cap per segment, not to the whole session', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(200_000);
    h.setActive(false);
    h.setActive(true);
    h.advance(200_000);
    expect(h.timer.elapsed()).toBe(180_000 * 2);
  });

  it('accumulates several active segments separated by blur', () => {
    const h = harness(true);
    h.timer.start();
    for (const segment of [120_000, 90_000, 45_000]) {
      h.advance(segment);
      h.setActive(false);
      h.advance(60_000); // time away must not be counted
      h.setActive(true);
    }
    expect(h.timer.elapsed()).toBe(255_000);
  });

  it('supports pause and resume without counting the paused gap', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(10_000);
    h.timer.pause();
    h.advance(20_000);
    h.timer.resume();
    h.advance(5_000);
    expect(h.timer.elapsed()).toBe(15_000);
  });

  it('take() settles and resets the counter for the next item', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(4_000);
    expect(h.timer.take()).toBe(4_000);
    expect(h.timer.elapsed()).toBe(0);

    h.advance(2_500);
    expect(h.timer.take()).toBe(2_500);
  });

  it('keeps counting across take() while the page stays active', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(3_000);
    expect(h.timer.take()).toBe(3_000);
    h.advance(2_000);
    expect(h.timer.take()).toBe(2_000);
  });

  it('returns whole milliseconds', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(1_500.4);
    expect(h.timer.take()).toBe(1_500);
    h.advance(500.6);
    expect(h.timer.take()).toBe(501);
  });

  it('ignores start() and resume() when already running', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(1_000);
    h.timer.start();
    h.advance(1_000);
    h.timer.resume();
    h.advance(1_000);
    expect(h.timer.elapsed()).toBe(3_000);
  });

  it('stops counting after dispose()', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(2_000);
    h.timer.dispose();
    h.advance(10_000);
    expect(h.timer.elapsed()).toBe(2_000);
    expect(h.timer.isRunning()).toBe(false);
  });

  it('accepts an initial duration when resuming a lesson', () => {
    let clock = 0;
    const env: TimingEnvironment = {
      now: () => clock,
      isActive: () => true,
      subscribe: () => () => {},
    };
    const timer = createPhaseTimer({ env, initialMs: 60_000 });
    timer.start();
    clock += 5_000;
    expect(timer.elapsed()).toBe(65_000);
  });

  it('honours a custom segment cap', () => {
    const h = harness(true, 10_000);
    h.timer.start();
    h.advance(25_000);
    expect(h.timer.elapsed()).toBe(10_000);
  });

  it('reset() discards the accumulated time', () => {
    const h = harness(true);
    h.timer.start();
    h.advance(8_000);
    h.timer.reset();
    h.advance(2_000);
    expect(h.timer.elapsed()).toBe(2_000);
  });
});
