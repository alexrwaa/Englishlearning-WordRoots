/**
 * Persistence rules for assessment history: the durable store (SQLite on
 * desktop) is the only authority, localStorage is legacy input for a one-shot
 * migration.
 *
 * These run on the browser-preview path — `browserAssessmentStore` over an
 * in-memory `localStorage`, with a *separate* key standing in for SQLite. That
 * is the same four-operation contract the Rust backend implements, so the
 * ordering guarantees tested here are the ones the page relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  ITEM_BANK_VERSION,
  MIGRATED_KEY,
  STORAGE_KEY,
  browserAssessmentStore,
  buildRun,
  clearHistoryAsync,
  loadHistoryAsync,
  saveRunAsync,
  scoreRun,
  type AssessmentStore,
  type RunResult,
  type StorageLike,
} from './assessment';

class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** Stands in for the SQLite table; the legacy mirror is `STORAGE_KEY`. */
const DURABLE_KEY = 'wordroots.test.assessment.durable.v1';

function storeOf(storage: MemoryStorage): AssessmentStore {
  return browserAssessmentStore(storage, DURABLE_KEY);
}

function seedStore(storage: MemoryStorage, runs: unknown[]): void {
  storage.setItem(DURABLE_KEY, JSON.stringify({ version: 1, runs }));
}

function seedLegacy(storage: MemoryStorage, runs: unknown[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, runs }));
}

function makeRun(id: string, finishedAt = 1_700_000_000_000): RunResult {
  const run = buildRun('checkpoint', finishedAt - 60_000);
  return { ...scoreRun(run, [{ itemId: run.items[0].id, choice: 0, ms: 1200 }], finishedAt), id };
}

describe('assessment persistence: the store wins', () => {
  it('reads the whole stored history when localStorage is empty', async () => {
    const storage = new MemoryStorage();
    seedStore(storage, [makeRun('lib-1', 3000), makeRun('lib-2', 2000), makeRun('lib-3', 1000)]);

    const snapshot = await loadHistoryAsync({ store: storeOf(storage), storage });

    expect(snapshot.runs.map((run) => run.id)).toEqual(['lib-1', 'lib-2', 'lib-3']);
    expect(snapshot.skipped).toBe(0);
    // A full store is not "empty history", and nothing was copied out of it.
    expect(snapshot.runs).toHaveLength(3);
  });

  it('migrates legacy localStorage once and stays idempotent', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    seedLegacy(storage, [makeRun('old-1', 3000), makeRun('old-2', 2000)]);

    const first = await loadHistoryAsync({ store, storage });
    expect(first.runs.map((run) => run.id)).toEqual(['old-1', 'old-2']);
    expect(await store.count()).toBe(2);
    expect(storage.getItem(MIGRATED_KEY)).not.toBeNull();

    const second = await loadHistoryAsync({ store, storage });
    expect(second.runs.map((run) => run.id)).toEqual(['old-1', 'old-2']);
    expect(await store.count()).toBe(2);
  });

  it('keeps the store authoritative when both sides hold different runs', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    seedStore(storage, [makeRun('from-store', 5000)]);
    seedLegacy(storage, [makeRun('from-legacy', 9000)]);

    const snapshot = await loadHistoryAsync({ store, storage });

    // The newer legacy run is *not* merged in: that is what "库为准" means.
    expect(snapshot.runs.map((run) => run.id)).toEqual(['from-store']);
    expect(await store.count()).toBe(1);
    expect(storage.getItem(DURABLE_KEY)).toContain('from-store');
    expect(storage.getItem(DURABLE_KEY)).not.toContain('from-legacy');
  });

  it('reports damaged rows as skipped instead of hiding them', async () => {
    const storage = new MemoryStorage();
    seedStore(storage, [makeRun('ok', 2000), { id: 'broken', mode: 'baseline' }]);

    const snapshot = await loadHistoryAsync({ store: storeOf(storage), storage });

    expect(snapshot.runs.map((run) => run.id)).toEqual(['ok']);
    expect(snapshot.skipped).toBe(1);
  });
});

describe('assessment persistence: confirmed writes', () => {
  it('does not add a run when the backend refuses the save', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    seedStore(storage, [makeRun('kept', 1000)]);
    const failing: AssessmentStore = {
      ...store,
      save: async () => {
        throw new Error('磁盘已满');
      },
    };

    await expect(saveRunAsync(makeRun('lost', 9000), { store: failing, storage })).rejects.toThrow('磁盘已满');

    const after = await loadHistoryAsync({ store, storage });
    expect(after.runs.map((run) => run.id)).toEqual(['kept']);
    expect(await store.count()).toBe(1);
  });

  it('keeps the queue usable after a failed save', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    let fail = true;
    const flaky: AssessmentStore = {
      ...store,
      save: async (run) => {
        if (fail) throw new Error('IO 错误');
        await store.save(run);
      },
    };

    await expect(saveRunAsync(makeRun('retry-me', 5000), { store: flaky, storage })).rejects.toThrow('IO 错误');
    fail = false;
    const snapshot = await saveRunAsync(makeRun('retry-me', 5000), { store: flaky, storage });

    expect(snapshot.runs.map((run) => run.id)).toEqual(['retry-me']);
    expect(snapshot.skipped).toBe(0);
  });

  it('round-trips item_bank_version', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);

    await saveRunAsync(makeRun('default-version', 2000), { store, storage });
    await saveRunAsync({ ...makeRun('next-version', 3000), itemBankVersion: ITEM_BANK_VERSION + 6 }, { store, storage });

    const snapshot = await loadHistoryAsync({ store, storage });
    const byId = new Map(snapshot.runs.map((run) => [run.id, run]));

    expect(ITEM_BANK_VERSION).toBeGreaterThan(0);
    expect(byId.get('default-version')?.itemBankVersion).toBe(ITEM_BANK_VERSION);
    expect(byId.get('next-version')?.itemBankVersion).toBe(ITEM_BANK_VERSION + 6);
  });
});

describe('assessment persistence: read/write ordering', () => {
  it('does not clear a migration back into existence', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    seedLegacy(storage, [makeRun('old-1', 3000), makeRun('old-2', 2000)]);

    // Hold the first imported row so the clear is genuinely requested *during*
    // the migration, not after it.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: AssessmentStore = {
      ...store,
      save: async (run) => {
        await gate;
        await store.save(run);
      },
    };

    let resolvedRead: unknown = null;
    const reading = loadHistoryAsync({ store: slow, storage }).then((snapshot) => {
      resolvedRead = snapshot;
      return snapshot;
    });
    const clearing = clearHistoryAsync({ store: slow, storage });

    await Promise.resolve();
    // While the migration is in flight the page has no snapshot to render, so
    // it cannot flash an empty history.
    expect(resolvedRead).toBeNull();

    release();
    const [read, cleared] = await Promise.all([reading, clearing]);

    expect(read.runs.map((run) => run.id)).toEqual(['old-1', 'old-2']);
    expect(cleared.runs).toEqual([]);
    expect(await store.count()).toBe(0);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    // The next load stays empty: the closed migration cannot resurrect the
    // legacy rows it just erased.
    const later = await loadHistoryAsync({ store, storage });
    expect(later.runs).toEqual([]);
  });

  it('serialises concurrent saves without losing either run', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);

    await Promise.all([
      saveRunAsync(makeRun('a', 2000), { store, storage }),
      saveRunAsync(makeRun('b', 3000), { store, storage }),
    ]);

    const snapshot = await loadHistoryAsync({ store, storage });
    expect(snapshot.runs.map((run) => run.id)).toEqual(['b', 'a']);
  });
});
