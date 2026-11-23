/**
 * Persistence rules for family-inquiry progress: SQLite (`inquiry_progress` on
 * desktop) is the only authority; localStorage is a one-shot migration source.
 *
 * These run on the browser-preview path — `browserInquiryStore` over an
 * in-memory `localStorage`, with a *separate* key standing in for the table.
 * That is the same contract the Rust backend implements, so the ordering and
 * failure semantics tested here are the ones the panel relies on.
 */
import { describe, expect, it } from 'vitest';
import { buildExport, serializeBackup, toSnapshot, validateBackup } from './backup';
import {
  DURABLE_KEY,
  MIGRATED_KEY,
  STORAGE_KEY,
  beginFamilyView,
  browserInquiryStore,
  canAutosave,
  findProgress,
  loadInquiryAsync,
  markFamilyLoaded,
  migrateLegacyInquiry,
  saveInquiryAsync,
  type InquiryRecord,
  type InquiryStore,
  type InquiryWrite,
  type StorageLike,
} from './inquiry-store';

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

function storeOf(storage: MemoryStorage): InquiryStore {
  return browserInquiryStore(storage, DURABLE_KEY);
}

function seedStore(storage: MemoryStorage, items: unknown[]): void {
  storage.setItem(DURABLE_KEY, JSON.stringify({ version: 1, items }));
}

/** The pre-SQLite shape: a family-id → progress map, no picks/sums. */
function seedLegacy(storage: MemoryStorage, map: Record<string, unknown>): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function makeRecord(familyId: string, overrides: Partial<InquiryRecord> = {}): InquiryRecord {
  return {
    familyId,
    schemaVersion: 1,
    step: 2,
    done: ['observe', 'discover'],
    hypothesis: '表示「看」',
    picks: { discover: 'suspect', verify: { inspect: true } },
    sums: { inspect: 'in + spect' },
    hints: 1,
    elapsedMs: 42_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function write(familyId: string, overrides: Partial<InquiryWrite> = {}): InquiryWrite {
  return {
    familyId,
    step: overrides.step ?? 2,
    done: overrides.done ?? ['observe', 'discover'],
    hypothesis: overrides.hypothesis ?? '表示「看」',
    picks: overrides.picks ?? { discover: 'suspect', verify: { inspect: true } },
    sums: overrides.sums ?? { inspect: 'in + spect' },
    hints: overrides.hints ?? 1,
    elapsedMs: overrides.elapsedMs ?? 42_000,
    updatedAt: overrides.updatedAt ?? 1_700_000_000_000,
  };
}

describe('inquiry persistence: the store wins', () => {
  it('reads the stored record when localStorage holds no legacy copy', async () => {
    const storage = new MemoryStorage();
    seedStore(storage, [makeRecord('fam-spect', { step: 4 })]);

    const snapshot = await loadInquiryAsync({ store: storeOf(storage), storage });

    expect(snapshot.items.map((item) => item.familyId)).toEqual(['fam-spect']);
    expect(snapshot.items[0].step).toBe(4);
    expect(snapshot.skipped).toBe(0);
    expect(storage.getItem(MIGRATED_KEY)).not.toBeNull();
  });

  it('migrates a legacy map once and stays idempotent', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    seedLegacy(storage, {
      'fam-spect': { step: 3, done: ['observe', 'discover', 'hypothesize'], hypothesis: '看', updatedAt: 1000 },
      'fam-port': { step: 1, done: ['observe'], hypothesis: '', updatedAt: 2000 },
    });

    const first = await loadInquiryAsync({ store, storage });
    expect(first.items.map((item) => item.familyId).sort()).toEqual(['fam-port', 'fam-spect']);
    // The old build never stored these: empty defaults, not invented values.
    const spect = findProgress(first, 'fam-spect');
    expect(spect?.picks).toEqual({});
    expect(spect?.sums).toEqual({});
    expect(spect?.hints).toBe(0);
    expect(storage.getItem(MIGRATED_KEY)).not.toBeNull();

    const second = await loadInquiryAsync({ store, storage });
    expect(second.items).toHaveLength(2);
    expect(await store.count()).toBe(2);
  });

  it('keeps the store authoritative when both sides hold a record', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    seedStore(storage, [makeRecord('fam-spect', { step: 5, hypothesis: '库里的' })]);
    seedLegacy(storage, {
      'fam-spect': { step: 1, done: [], hypothesis: '旧的', updatedAt: 9999 },
      'fam-extra': { step: 1, done: [], hypothesis: '', updatedAt: 9999 },
    });

    const result = await migrateLegacyInquiry(store, storage);
    expect(result.libraryWins).toBe(true);
    expect(result.imported).toBe(0);

    const snapshot = await loadInquiryAsync({ store, storage });
    // Not merged: the stale legacy family does not appear and the store's
    // newer step is untouched.
    expect(snapshot.items.map((item) => item.familyId)).toEqual(['fam-spect']);
    expect(snapshot.items[0].step).toBe(5);
    expect(snapshot.items[0].hypothesis).toBe('库里的');
  });

  it('reports a damaged row as skipped instead of hiding it', async () => {
    const storage = new MemoryStorage();
    seedStore(storage, [makeRecord('fam-good'), { familyId: 'fam-broken', step: 'nope', done: [] }]);

    const snapshot = await loadInquiryAsync({ store: storeOf(storage), storage });

    expect(snapshot.items.map((item) => item.familyId)).toEqual(['fam-good']);
    expect(snapshot.skipped).toBe(1);
  });

  it('refuses to read a record written by a newer build', async () => {
    const storage = new MemoryStorage();
    seedStore(storage, [makeRecord('fam-future', { schemaVersion: 99 })]);

    await expect(loadInquiryAsync({ store: storeOf(storage), storage })).rejects.toThrow(
      /newer|更新版本/i,
    );
    // Nothing was deleted just because it could not be understood.
    expect(storage.getItem(DURABLE_KEY)).toContain('fam-future');
  });

  it('counts a damaged legacy entry but still imports the good ones', async () => {
    const storage = new MemoryStorage();
    seedLegacy(storage, {
      'fam-ok': { step: 2, done: ['observe'], hypothesis: '', updatedAt: 1000 },
      'fam-bad': { done: [] },
    });

    const result = await migrateLegacyInquiry(storeOf(storage), storage);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    // Every *readable* record made it across, so the migration is closed: a
    // second run must not copy the same family again.
    expect(storage.getItem(MIGRATED_KEY)).not.toBeNull();
    const again = await migrateLegacyInquiry(storeOf(storage), storage);
    expect(again.alreadyMigrated).toBe(true);
    expect(await storeOf(storage).count()).toBe(1);
  });
});

describe('inquiry persistence: confirmed writes', () => {
  it('rejects and adds nothing when the backend refuses the save', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    seedStore(storage, [makeRecord('fam-kept', { step: 1 })]);
    const failing: InquiryStore = {
      ...store,
      save: async () => {
        throw new Error('磁盘已满');
      },
    };

    await expect(
      saveInquiryAsync(write('fam-lost', { step: 4 }), { store: failing, storage }),
    ).rejects.toThrow('磁盘已满');

    const after = await loadInquiryAsync({ store, storage });
    expect(after.items.map((item) => item.familyId)).toEqual(['fam-kept']);
    expect(after.items[0].step).toBe(1);
    expect(await store.count()).toBe(1);
  });

  it('keeps the queue usable after a failed save, so a retry succeeds', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);
    let fail = true;
    const flaky: InquiryStore = {
      ...store,
      save: async (record) => {
        if (fail) throw new Error('IO 错误');
        await store.save(record);
      },
    };

    await expect(saveInquiryAsync(write('fam-spect'), { store: flaky, storage })).rejects.toThrow('IO 错误');
    fail = false;

    const snapshot = await saveInquiryAsync(write('fam-spect'), { store: flaky, storage });
    expect(snapshot.items.map((item) => item.familyId)).toEqual(['fam-spect']);
  });

  it('round-trips picks, sums, hints and elapsed time', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);

    await saveInquiryAsync(write('fam-spect', { hints: 2, elapsedMs: 90_000 }), { store, storage });
    const snapshot = await loadInquiryAsync({ store, storage });
    const saved = findProgress(snapshot, 'fam-spect');

    expect(saved?.picks).toEqual({ discover: 'suspect', verify: { inspect: true } });
    expect(saved?.sums).toEqual({ inspect: 'in + spect' });
    expect(saved?.hints).toBe(2);
    expect(saved?.elapsedMs).toBe(90_000);
  });
});

describe('inquiry persistence: families stay apart and writes serialise', () => {
  it('stores two families without one replacing the other', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);

    await saveInquiryAsync(write('fam-spect', { step: 2, updatedAt: 2000 }), { store, storage });
    await saveInquiryAsync(write('fam-port', { step: 5, updatedAt: 3000 }), { store, storage });

    const snapshot = await loadInquiryAsync({ store, storage });
    expect(snapshot.items.map((item) => item.familyId)).toEqual(['fam-port', 'fam-spect']);
    expect(findProgress(snapshot, 'fam-spect')?.step).toBe(2);
    expect(findProgress(snapshot, 'fam-port')?.step).toBe(5);
  });

  it('serialises concurrent saves without losing either family', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);

    await Promise.all([
      saveInquiryAsync(write('fam-a', { updatedAt: 1000 }), { store, storage }),
      saveInquiryAsync(write('fam-b', { updatedAt: 2000 }), { store, storage }),
    ]);

    const snapshot = await loadInquiryAsync({ store, storage });
    expect(snapshot.items.map((item) => item.familyId).sort()).toEqual(['fam-a', 'fam-b']);
    expect(await store.count()).toBe(2);
  });

  it('upserts the same family instead of duplicating it', async () => {
    const storage = new MemoryStorage();
    const store = storeOf(storage);

    await saveInquiryAsync(write('fam-spect', { step: 1 }), { store, storage });
    await saveInquiryAsync(write('fam-spect', { step: 5 }), { store, storage });

    const snapshot = await loadInquiryAsync({ store, storage });
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].step).toBe(5);
  });
});

describe('inquiry persistence: backup coverage', () => {
  function emptyBackup(inquiryProgress?: unknown[]) {
    return buildExport({
      settings: null,
      lessonStates: [],
      cards: [],
      reviews: [],
      attempts: [],
      notes: [],
      bookmarks: [],
      ...(inquiryProgress ? { inquiryProgress } : {}),
    });
  }

  it('carries progress through a canonical backup round trip, counts included', () => {
    const record = makeRecord('fam-spect');
    const parsed = validateBackup(JSON.parse(serializeBackup(emptyBackup([record]))));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.file.counts.inquiryProgress).toBe(1);
    expect(parsed.file.inquiryProgress).toEqual([record]);
    // Rust reads this on restore; the row must be present and camel-safe.
    const snapshot = toSnapshot(parsed.file);
    expect(snapshot.inquiry_progress).toHaveLength(1);
  });

  it('keeps an older backup (no such collection) importable', () => {
    const parsed = validateBackup(JSON.parse(serializeBackup(emptyBackup())));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.file.inquiryProgress).toBeUndefined();
    // An empty array tells Rust "the file has no rows", so the table is kept.
    expect(toSnapshot(parsed.file).inquiry_progress).toEqual([]);
  });
});

describe('inquiry view: loaded belongs to one family', () => {
  it('does not arm autosave for a family that has not finished loading', () => {
    // The old component kept `loaded: boolean`; after A loaded it stayed true,
    // so a fast switch to B let A's step be written over B.
    let view = beginFamilyView('fam-spect');
    view = markFamilyLoaded(view, 'fam-spect');
    expect(canAutosave(view)).toBe(true);

    view = beginFamilyView('fam-port'); // B starts loading
    expect(canAutosave(view)).toBe(false);

    // A read that was already in flight for A must not arm B.
    view = markFamilyLoaded(view, 'fam-spect');
    expect(canAutosave(view)).toBe(false);
    expect(view.loadedFor).toBeNull();

    view = markFamilyLoaded(view, 'fam-port');
    expect(canAutosave(view)).toBe(true);
  });

  it('never autosaves before any family is selected', () => {
    expect(canAutosave(beginFamilyView(null))).toBe(false);
  });
});
