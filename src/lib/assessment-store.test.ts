/**
 * Storage-layer tests for assessment history.
 *
 * These run on the browser-preview path (`browserAssessmentStore` over an
 * in-memory `localStorage`), which is the same contract the SQLite backend
 * implements. Vitest's node environment has no `window`, so `IS_TAURI` is false
 * and nothing here touches IPC.
 */
import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  ITEM_BANK_VERSION,
  MIGRATED_KEY,
  STORAGE_KEY,
  browserAssessmentStore,
  buildRun,
  clearHistory,
  loadHistory,
  migrateLegacyAssessmentHistory,
  saveRun,
  scoreRun,
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

/**
 * Separate key standing in for the durable backend (SQLite on desktop). The
 * migration is only meaningful when the destination is not the legacy key.
 */
const DURABLE_KEY = 'wordroots.test.assessment.store.v1';

function durable(storage: MemoryStorage) {
  return browserAssessmentStore(storage, DURABLE_KEY);
}

function makeRun(id: string, finishedAt = 1_700_000_000_000): RunResult {
  const run = buildRun('checkpoint', finishedAt - 60_000);
  return { ...scoreRun(run, [{ itemId: run.items[0].id, choice: 0, ms: 1200 }], finishedAt), id };
}

/** Seed the pre-migration localStorage shape, including anything invalid. */
function seedLegacy(storage: MemoryStorage, entries: unknown[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, runs: entries }));
}

describe('assessment store migration', () => {
  it('imports legacy runs once and is idempotent', async () => {
    const storage = new MemoryStorage();
    const store = durable(storage);
    seedLegacy(storage, [makeRun('a', 3000), makeRun('b', 2000), makeRun('c', 1000)]);

    const first = await migrateLegacyAssessmentHistory(store, storage, Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(first).toMatchObject({ imported: 3, skipped: 0, alreadyMigrated: false, verified: true });
    expect(await store.count()).toBe(3);
    expect(storage.getItem(MIGRATED_KEY)).toBe(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)).toISOString());

    // Second call short-circuits on the marker.
    const second = await migrateLegacyAssessmentHistory(store, storage);
    expect(second.alreadyMigrated).toBe(true);
    expect(await store.count()).toBe(3);

    // Legacy data is kept as the rollback copy.
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('does not duplicate rows when the marker is lost mid-migration', async () => {
    const storage = new MemoryStorage();
    const store = durable(storage);
    seedLegacy(storage, [makeRun('a', 2000), makeRun('b', 1000)]);

    await migrateLegacyAssessmentHistory(store, storage);
    storage.removeItem(MIGRATED_KEY);
    const rerun = await migrateLegacyAssessmentHistory(store, storage);

    expect(rerun.imported).toBe(0);
    expect(rerun.verified).toBe(true);
    expect(await store.count()).toBe(2);
  });

  it('skips a corrupt record without losing the others', async () => {
    const storage = new MemoryStorage();
    const store = durable(storage);
    const legacy = [makeRun('good-1', 3000), { id: 'broken', mode: 'baseline' }, makeRun('good-2', 1000)];
    seedLegacy(storage, legacy);

    // The synchronous facade tolerates the damaged entry…
    expect(loadHistory(storage).map((run) => run.id)).toEqual(['good-1', 'good-2']);

    const result = await migrateLegacyAssessmentHistory(store, storage);
    expect(result).toMatchObject({ imported: 2, skipped: 1, verified: true });
    expect(await store.count()).toBe(2);

    // The durable read path (SQLite equivalent) also survives a damaged row.
    storage.setItem(
      DURABLE_KEY,
      JSON.stringify({ version: 1, runs: [makeRun('good-3', 5000), { id: 'bad-row' }] }),
    );
    const listed = await store.list();
    expect(listed.runs.map((run) => run.id)).toEqual(['good-3']);
    expect(listed.skipped).toBe(1);
  });

  it('writes no marker when there is nothing to migrate', async () => {
    const storage = new MemoryStorage();
    const store = durable(storage);
    storage.setItem(STORAGE_KEY, '{not json');

    const result = await migrateLegacyAssessmentHistory(store, storage);
    expect(result).toMatchObject({ imported: 0, alreadyMigrated: false });
    expect(storage.getItem(MIGRATED_KEY)).toBeNull();
  });
});

describe('assessment store persistence', () => {
  it('clears every run and reports count 0', async () => {
    const storage = new MemoryStorage();
    const store = durable(storage);
    await store.save(makeRun('a', 2000));
    await store.save(makeRun('b', 1000));
    expect(await store.count()).toBe(2);

    await store.clear();

    expect(await store.count()).toBe(0);
    expect(await store.list()).toEqual({ runs: [], skipped: 0 });
    expect(clearHistory(storage)).toEqual([]);
  });

  it('round-trips itemBankVersion', async () => {
    const storage = new MemoryStorage();
    const store = durable(storage);
    const run = { ...makeRun('banked', 5000), itemBankVersion: ITEM_BANK_VERSION };

    await store.save(run);
    const [restored] = (await store.list()).runs;

    expect(ITEM_BANK_VERSION).toBeGreaterThan(0);
    expect(restored.itemBankVersion).toBe(ITEM_BANK_VERSION);
  });

  it('keeps the newest 50 runs and upserts by id', async () => {
    const storage = new MemoryStorage();
    const store = durable(storage);
    for (let i = 0; i < HISTORY_LIMIT + 3; i += 1) {
      await store.save(makeRun(`r${i}`, 10_000 + i));
    }
    expect((await store.list()).runs).toHaveLength(HISTORY_LIMIT);

    await store.save({ ...makeRun('r60', 99_000), overall: 77 });
    const runs = (await store.list()).runs;
    expect(runs.filter((run) => run.id === 'r60')).toHaveLength(1);
    expect((await store.count())).toBeLessThanOrEqual(HISTORY_LIMIT);

    // The mirror written by the synchronous API keeps the same shape.
    saveRun(makeRun('mirror', 120_000), storage);
    expect(storage.getItem(STORAGE_KEY)).toContain('"version":1');
    expect(loadHistory(storage)[0].id).toBe('mirror');
  });
});
