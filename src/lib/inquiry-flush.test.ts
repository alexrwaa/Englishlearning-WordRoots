/**
 * The inquiry save coordinator: single flight, coalescing, revisions, timeout
 * and retry. These tests use an injectable `save` whose settlement the test
 * controls, so every window the UI must survive is reproducible:
 * debounce, unmount, family switch, overlapping writes, failure and timeout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INQUIRY_DEBOUNCE_MS, InquiryFlusher, type InquirySaveStatus } from './inquiry-revision';

interface Payload {
  familyId: string;
  value: string;
}

function payload(familyId: string, value: string): Payload {
  return { familyId, value };
}

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface StatusEntry {
  status: InquirySaveStatus;
  current: number;
  saved: number;
}

/** Records every status change so "已保存" leakage is observable. */
function statusLog(): { entries: StatusEntry[]; onStatus: (status: InquirySaveStatus, info: { currentRevision: number; savedRevision: number }) => void } {
  const entries: StatusEntry[] = [];
  return {
    entries,
    onStatus: (status, info) => entries.push({ status, current: info.currentRevision, saved: info.savedRevision }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('InquiryFlusher', () => {
  it('1. 修改后立刻卸载：flush 把最新值写下去，不等 300ms', async () => {
    const writes: Payload[] = [];
    const flusher = new InquiryFlusher<Payload>({
      save: async (value) => {
        writes.push(value);
      },
    });

    flusher.mark(payload('A', 'v1'));
    flusher.mark(payload('A', 'v2'));
    const result = await flusher.flush('unmount'); // no timer advance

    expect(writes).toEqual([payload('A', 'v2')]);
    expect(result.pending).toBe(false);
    expect(result.savedRevision).toBe(2);
    flusher.close();
  });

  it('2. 修改后立刻切族：A 的值落到 A，不会被写进 B', async () => {
    const rows = new Map<string, Payload>();
    const save = async (value: Payload) => {
      rows.set(value.familyId, value);
    };

    const a = new InquiryFlusher<Payload>({ save });
    a.mark(payload('A', 'a-last'));
    await a.flush('switch');
    a.close();

    const b = new InquiryFlusher<Payload>({ save });
    b.mark(payload('B', 'b-first'));
    await b.flush('unmount');
    b.close();

    expect(rows.get('A')).toEqual(payload('A', 'a-last'));
    expect(rows.get('B')).toEqual(payload('B', 'b-first'));
    expect(rows.size).toBe(2);
  });

  it('3. 写未完成时再改两次：只写首尾两个值，中间态从不显示已保存', async () => {
    const gate = deferred();
    const writes: string[] = [];
    const log = statusLog();
    const flusher = new InquiryFlusher<Payload>({
      save: async (value) => {
        writes.push(value.value);
        if (writes.length === 1) await gate.promise;
      },
      onStatus: log.onStatus,
    });

    flusher.mark(payload('A', 'v1'));
    await vi.advanceTimersByTimeAsync(INQUIRY_DEBOUNCE_MS);
    expect(writes).toEqual(['v1']); // first write in flight

    flusher.mark(payload('A', 'v2'));
    flusher.mark(payload('A', 'v3'));
    expect(flusher.savedRevision).toBe(0);

    gate.resolve();
    const result = await flusher.flush('test');

    expect(writes).toEqual(['v1', 'v3']); // v2 merged away
    expect(result.pending).toBe(false);
    expect(flusher.savedRevision).toBe(flusher.currentRevision);
    expect(log.entries.filter((e) => e.status === 'saved')).toEqual([
      { status: 'saved', current: 3, saved: 3 },
    ]);
    flusher.close();
  });

  it('4. 写失败 → error，重试写入最新值后成功', async () => {
    const attempts: string[] = [];
    let fail = true;
    const flusher = new InquiryFlusher<Payload>({
      save: async (value) => {
        attempts.push(value.value);
        if (fail) throw new Error('磁盘只读');
      },
    });

    flusher.mark(payload('A', 'v1'));
    await vi.advanceTimersByTimeAsync(INQUIRY_DEBOUNCE_MS);

    expect(flusher.saveStatus).toBe('error');
    expect(flusher.saveError).toContain('磁盘只读');
    expect(flusher.hasUnsaved()).toBe(true);

    // A further edit stays unsaved and does not hammer the broken disk.
    flusher.mark(payload('A', 'v2'));
    await vi.advanceTimersByTimeAsync(INQUIRY_DEBOUNCE_MS);
    expect(attempts).toEqual(['v1']);
    expect(flusher.saveStatus).toBe('error');

    fail = false;
    const result = await flusher.retry();

    expect(attempts).toEqual(['v1', 'v2']); // newest value, not the failed one
    expect(result.pending).toBe(false);
    expect(flusher.saveStatus).toBe('saved');
    flusher.close();
  });

  it('5. 写超时后迟到 resolve：旧值不会被标成已保存', async () => {
    const late = deferred();
    const log = statusLog();
    const flusher = new InquiryFlusher<Payload>({
      save: async () => {
        await late.promise;
      },
      timeoutMs: 1000,
      onStatus: log.onStatus,
    });

    flusher.mark(payload('A', 'v1'));
    await vi.advanceTimersByTimeAsync(INQUIRY_DEBOUNCE_MS); // write starts
    await vi.advanceTimersByTimeAsync(1000); // watchdog fires

    expect(flusher.saveStatus).toBe('error');
    expect(flusher.saveError).toContain('未完成');

    late.resolve(); // the abandoned write eventually lands
    await vi.advanceTimersByTimeAsync(0);

    expect(flusher.savedRevision).toBe(0);
    expect(flusher.saveStatus).toBe('error');
    expect(log.entries.some((e) => e.status === 'saved')).toBe(false);
    flusher.close();
  });

  it('6. 连续 10 次快速修改 → 写入 ≤ 3 次，终值正确', async () => {
    const writes: string[] = [];
    const flusher = new InquiryFlusher<Payload>({
      save: async (value) => {
        writes.push(value.value);
      },
    });

    for (let i = 1; i <= 5; i += 1) flusher.mark(payload('A', `v${i}`));
    await vi.advanceTimersByTimeAsync(INQUIRY_DEBOUNCE_MS);
    for (let i = 6; i <= 10; i += 1) flusher.mark(payload('A', `v${i}`));
    await vi.advanceTimersByTimeAsync(INQUIRY_DEBOUNCE_MS);

    expect(writes.length).toBeLessThanOrEqual(3);
    expect(writes.at(-1)).toBe('v10');
    expect(flusher.savedRevision).toBe(10);
    expect(flusher.hasUnsaved()).toBe(false);
    flusher.close();
  });

  it('7. savedRevision 落后于 currentRevision 时不报告已保存', async () => {
    const gate = deferred();
    const log = statusLog();
    const flusher = new InquiryFlusher<Payload>({
      save: async () => {
        await gate.promise;
      },
      onStatus: log.onStatus,
    });

    flusher.mark(payload('A', 'v1'));
    await vi.advanceTimersByTimeAsync(INQUIRY_DEBOUNCE_MS);
    flusher.mark(payload('A', 'v2')); // revision 2 while revision 1 is in flight

    gate.resolve(); // revision 1 completes, then revision 2 is written
    await flusher.flush('test');

    const savedEntries = log.entries.filter((e) => e.status === 'saved');
    expect(savedEntries.length).toBeGreaterThan(0);
    for (const entry of savedEntries) {
      expect(entry.saved).toBe(entry.current);
    }
    expect(savedEntries.at(-1)).toEqual({ status: 'saved', current: 2, saved: 2 });
    flusher.close();
  });
});
