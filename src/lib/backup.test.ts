import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  buildExport,
  countsOf,
  parseBackup,
  serializeBackup,
  toSnapshot,
  toWebDb,
  totalRecords,
  validateBackup,
  writeAtomic,
  type BackupData,
  type BackupFile,
  type KVStore,
  type WebDbPayload,
} from './backup';
import { DEFAULT_SETTINGS, type Settings } from './types';

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const NOW = Date.UTC(2026, 10, 18, 8, 0);

const settings: Settings = { ...DEFAULT_SETTINGS, theme: 'sepia', dailyMinutes: 30, fontScale: 1.1 };

function sampleData(): BackupData {
  return {
    settings,
    lessonStates: [
      {
        lessonId: 'w01d1',
        status: 'completed',
        startedAt: NOW - 86_400_000,
        completedAt: NOW - 86_000_000,
        elapsedMs: 1_200_000,
        score: 0.9,
        cursor: 12,
        lastSeenAt: NOW - 86_000_000,
      },
      {
        lessonId: 'w01d2',
        status: 'in_progress',
        startedAt: NOW - 3_600_000,
        completedAt: null,
        elapsedMs: 300_000,
        score: null,
        cursor: 4,
        lastSeenAt: NOW - 60_000,
      },
    ],
    cards: [
      {
        cardId: 'concept:c-struct',
        kind: 'concept',
        refId: 'c-struct',
        stability: 12.5,
        difficulty: 4.2,
        reps: 6,
        lapses: 1,
        state: 2,
        due: NOW + 86_400_000,
        lastReview: NOW - 60_000,
      },
      {
        cardId: 'inference:infer:w01d1-e3',
        kind: 'inference',
        refId: 'infer:w01d1-e3',
        stability: 3.1,
        difficulty: 5.4,
        reps: 2,
        lapses: 0,
        state: 1,
        due: NOW + 3_600_000,
        lastReview: NOW - 7_200_000,
      },
    ],
    reviews: [
      { cardId: 'concept:c-struct', rating: 3, ts: NOW - 60_000, correct: true, phase: 'review', elapsedMs: 9_500 },
      { cardId: 'inference:infer:w01d1-e3', rating: 1, ts: NOW - 7_200_000, correct: false, phase: 'apply' },
    ],
    attempts: [
      {
        lessonId: 'w01d1',
        exerciseId: 'w01d1-e1',
        kind: 'mcq',
        correct: true,
        ts: NOW - 90_000,
        durationMs: 8_400,
        answer: 'B',
      },
      {
        lessonId: 'w01d1',
        exerciseId: 'w01d1-e2',
        kind: 'cloze',
        correct: false,
        ts: NOW - 80_000,
        durationMs: 21_000,
      },
    ],
    notes: [
      { id: 1, targetType: 'word', targetId: 'construct', body: 'con- + struct', createdAt: NOW, updatedAt: NOW },
    ],
    bookmarks: [{ targetType: 'morpheme', targetId: 'struct', createdAt: NOW }],
  };
}

function memStore(initial: Record<string, string> = {}): KVStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/**
 * Store whose `setItem` fails the first `failCount` writes of `failKey` and
 * then recovers, so the rollback path itself can be exercised.
 */
function failingStore(failKey: string, failCount: number, initial: Record<string, string> = {}) {
  const base = memStore(initial);
  let writes = 0;
  return {
    ...base,
    getItem: base.getItem,
    removeItem: base.removeItem,
    setItem: (key: string, value: string) => {
      if (key === failKey) {
        writes += 1;
        if (writes <= failCount) {
          // Simulate a partial write: the backend stores half the payload and
          // then reports quota exhaustion.
          base.data.set(key, value.slice(0, Math.floor(value.length / 2)));
          throw new Error('QuotaExceededError');
        }
      }
      base.setItem(key, value);
    },
  } satisfies KVStore;
}

function countWebDb(payload: WebDbPayload) {
  return {
    lessonStates: payload.lessonStates.length,
    cards: payload.cards.length,
    reviews: payload.reviews.length,
    attempts: payload.attempts.length,
    notes: payload.notes.length,
    bookmarks: payload.bookmarks.length,
  };
}

/* ------------------------------------------------------------------ */
/* 1. export -> validate -> import                                     */
/* ------------------------------------------------------------------ */

describe('buildExport / validateBackup round trip', () => {
  it('exports every collection with matching counts and validates clean', () => {
    const data = sampleData();
    const file = buildExport(data, { now: NOW, appVersion: '0.2.0' });

    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(file.appVersion).toBe('0.2.0');
    expect(file.exportedAt).toBe(NOW);
    expect(file.counts).toEqual(countsOf(data));
    expect(file.counts).toEqual({
      settings: 1,
      lessonStates: 2,
      cards: 2,
      reviews: 2,
      attempts: 2,
      notes: 1,
      bookmarks: 1,
    });
    expect(totalRecords(file)).toBe(10);

    const result = validateBackup(JSON.parse(serializeBackup(file)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.counts).toEqual(file.counts);
    expect(result.file.settings).toEqual(settings);
    expect(result.file.lessonStates[0].lastSeenAt).toBe(NOW - 86_000_000);
  });

  it('restores the same number of records into an empty browser database', () => {
    const file = buildExport(sampleData(), { now: NOW });
    const parsed = validateBackup(JSON.parse(serializeBackup(file)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const store = memStore();
    writeAtomic(store, 'wordroots.dev.db.v1', 'wordroots.dev.db.v1.staging', toWebDb(parsed.file));

    const restored = JSON.parse(store.data.get('wordroots.dev.db.v1') ?? '{}') as WebDbPayload;
    expect(countWebDb(restored)).toEqual({
      lessonStates: 2,
      cards: 2,
      reviews: 2,
      attempts: 2,
      notes: 1,
      bookmarks: 1,
    });
    expect(restored.settings).toEqual(settings);
    expect(restored.attempts[1].correct).toBe(false);
    expect(restored.reviews[1].correct).toBe(false);
    expect(store.data.has('wordroots.dev.db.v1.staging')).toBe(false);
  });

  it('survives a canonical -> Rust snapshot -> validate round trip', () => {
    const file = buildExport(sampleData(), { now: NOW });
    const snapshot = toSnapshot(file);

    // The Rust importer reads reviews/attempts with `as_i64()`, so booleans must
    // travel as 1/0 or every correct answer silently turns into a wrong one.
    expect((snapshot.review as { correct: unknown }[])[0].correct).toBe(1);
    expect((snapshot.attempt as { correct: unknown }[])[1].correct).toBe(0);
    expect(snapshot.format).toBe('wordroots-snapshot');
    expect(snapshot.schema_version).toBe(BACKUP_SCHEMA_VERSION);

    const back = validateBackup(snapshot);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    // The snapshot carries no settings block, so a restore keeps the current
    // ones; every other collection must survive intact.
    expect(back.file.counts).toEqual({ ...file.counts, settings: 0 });
    expect(back.file.cards).toEqual(file.cards);
    expect(back.file.reviews).toEqual(file.reviews); // no id field in canonical reviews
    // A Rust snapshot has no settings block: restore keeps the current settings.
    expect(back.file.settings).toBeNull();
    expect(back.file.migrationNotes?.join(' ')).toContain('保留当前设置');
  });
});

/* ------------------------------------------------------------------ */
/* browser shim end to end (localStorage)                              */
/* ------------------------------------------------------------------ */

describe('browser shim', () => {
  it('exports and restores the whole database through api.ts', async () => {
    const { db, WEB_DB_KEY } = await import('./api');
    const store = memStore();
    (globalThis as unknown as { localStorage: KVStore }).localStorage = store;

    const file = buildExport(sampleData(), { now: NOW });
    // Import into an empty shim database.
    await db.importBackup(file);

    const live = JSON.parse(store.data.get(WEB_DB_KEY) ?? '{}') as WebDbPayload;
    expect(countWebDb(live)).toEqual({
      lessonStates: 2,
      cards: 2,
      reviews: 2,
      attempts: 2,
      notes: 1,
      bookmarks: 1,
    });
    expect(live.settings.theme).toBe('sepia');

    // The shim keeps a pre-import snapshot of whatever was there before.
    expect(store.data.has('wordroots.dev.preimport')).toBe(true);

    // Export again: the canonical file round-trips through the shim.
    const text = await db.exportData();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.counts).toEqual(file.counts);
    expect(parsed.file.attempts[1].correct).toBe(false);

    // Simulate a wiped profile, then restore from the exported text.
    store.removeItem(WEB_DB_KEY);
    const again = parseBackup(text);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    await db.importBackup(again.file);
    const restored = JSON.parse(store.data.get(WEB_DB_KEY) ?? '{}') as WebDbPayload;
    expect(countWebDb(restored)).toEqual(countWebDb(live));
    expect(store.data.has(`${WEB_DB_KEY}.staging`)).toBe(false);
  });

  it('rejects a corrupt file without touching the current data', async () => {
    const { db, WEB_DB_KEY } = await import('./api');
    const store = memStore();
    (globalThis as unknown as { localStorage: KVStore }).localStorage = store;

    const before = JSON.stringify({ settings: {}, lessonStates: [], cards: [], reviews: [], attempts: [], notes: [], bookmarks: [] });
    store.setItem(WEB_DB_KEY, before);

    const corrupted = { ...buildExport(sampleData(), { now: NOW }), counts: { ...countsOf(sampleData()), cards: 99 } };
    await expect(db.importBackup(corrupted)).rejects.toThrow(/counts\.cards/);
    expect(store.data.get(WEB_DB_KEY)).toBe(before);
  });
});

/* ------------------------------------------------------------------ */
/* 2. validation error branches                                        */
/* ------------------------------------------------------------------ */

describe('validateBackup rejections', () => {
  const good = () => buildExport(sampleData(), { now: NOW }) as unknown as Record<string, unknown>;

  it('rejects a missing required field and names the record index', () => {
    const raw = good();
    const states = (raw.lessonStates as Record<string, unknown>[]).slice();
    states[1] = { ...states[1], lessonId: undefined };
    const result = validateBackup({ ...raw, lessonStates: states });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('第 2 条 lessonStates 记录');
    expect(result.error).toContain('lessonId');
  });

  it('rejects a counts mismatch caused by deleting a row', () => {
    const raw = good();
    const cards = (raw.cards as unknown[]).slice(0, 1);
    const result = validateBackup({ ...raw, cards });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('counts.cards 声明为 2');
    expect(result.error).toContain('实际有 1 条');
  });

  it('rejects a backup from a newer schema', () => {
    const raw = good();
    const result = validateBackup({ ...raw, schemaVersion: BACKUP_SCHEMA_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('更高版本');
    expect(result.error).toContain(`v${BACKUP_SCHEMA_VERSION + 1}`);
  });

  it('rejects non-object payloads with a specific message', () => {
    const asArray = validateBackup([]);
    expect(asArray.ok).toBe(false);
    if (!asArray.ok) expect(asArray.error).toContain('数组');

    const asNull = validateBackup(null);
    expect(asNull.ok).toBe(false);
    if (!asNull.ok) expect(asNull.error).toContain('不是 JSON 对象');

    const asString = validateBackup('{"schemaVersion":2}');
    expect(asString.ok).toBe(false);
    if (!asString.ok) expect(asString.error).toContain('不是 JSON 对象');
  });

  it('rejects a missing or malformed schemaVersion', () => {
    const raw = good();
    const missing = validateBackup({ ...raw, schemaVersion: undefined });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('缺少 schemaVersion');

    const bad = validateBackup({ ...raw, schemaVersion: 'v2' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('正整数');
  });

  it('rejects a collection that is not an array', () => {
    const raw = good();
    const result = validateBackup({ ...raw, attempts: { nope: true } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('attempts 必须是数组');
  });

  it('rejects invalid JSON text with the parser message', () => {
    const result = parseBackup('{ "schemaVersion": 2, ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('不是合法的 JSON');
  });
});

/* ------------------------------------------------------------------ */
/* 3. atomicity                                                        */
/* ------------------------------------------------------------------ */

describe('writeAtomic', () => {
  it('leaves the live database untouched when the swap fails', () => {
    const before = JSON.stringify({ settings: {}, notes: [{ id: 1, body: 'old' }] });
    const store = failingStore('wordroots.dev.db.v1', 1, { 'wordroots.dev.db.v1': before });

    expect(() => writeAtomic(store, 'wordroots.dev.db.v1', 'wordroots.dev.db.v1.staging', { notes: [] })).toThrow(
      /QuotaExceededError/,
    );

    expect(store.data.get('wordroots.dev.db.v1')).toBe(before);
    expect(store.data.has('wordroots.dev.db.v1.staging')).toBe(false);
  });

  it('does not touch the live database when the staging write fails', () => {
    const before = JSON.stringify({ cards: [{ cardId: 'concept:a' }] });
    // The staging key is rejected by the quota check.
    const store = failingStore('staging', 1, { live: before });
    expect(() => writeAtomic(store, 'live', 'staging', { cards: [] })).toThrow(/QuotaExceededError/);
    expect(store.data.get('live')).toBe(before);
    expect(store.data.has('staging')).toBe(false);
  });

  it('never leaves a staging key behind on success', () => {
    const store = memStore();
    writeAtomic(store, 'live', 'staging', { ok: true });
    expect(store.data.get('live')).toBe('{"ok":true}');
    expect(store.data.has('staging')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 4. v1 -> v2                                                         */
/* ------------------------------------------------------------------ */

describe('v1 compatibility', () => {
  it('imports a v1 backup without lastSeenAt and fills the v2 default', () => {
    const v1 = {
      format: BACKUP_FORMAT,
      schemaVersion: 1,
      appVersion: '0.1.0',
      exportedAt: NOW,
      counts: { settings: 1, lessonStates: 1, cards: 0, reviews: 0, attempts: 0, notes: 0, bookmarks: 0 },
      settings: { ...DEFAULT_SETTINGS },
      lessonStates: [
        {
          lessonId: 'w02d1',
          status: 'completed',
          startedAt: NOW - 1_000,
          completedAt: NOW,
          elapsedMs: 60_000,
          score: 0.75,
          cursor: 9,
          // lastSeenAt intentionally absent — it did not exist in v1
        },
      ],
      cards: [],
      reviews: [],
      attempts: [],
      notes: [],
      bookmarks: [],
    };

    const result = validateBackup(v1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.lessonStates[0].lastSeenAt).toBe(NOW - 1_000); // falls back to startedAt
    expect(result.file.lessonStates[0].elapsedMs).toBe(60_000);
    expect(result.file.migrationNotes?.join(' ')).toContain('补齐 v2');
    // v1 rows keep working through the whole import pipeline.
    const snapshot = toSnapshot(result.file);
    expect(snapshot.schema_version).toBe(1);
    expect((snapshot.lesson_state as { lastSeenAt: number | null }[])[0].lastSeenAt).toBe(NOW - 1_000);
  });

  it('defaults a missing lastSeenAt to null when startedAt is absent too', () => {
    const result = validateBackup({
      schemaVersion: 1,
      settings: null,
      counts: { settings: 0, lessonStates: 1, cards: 0, reviews: 0, attempts: 0, notes: 0, bookmarks: 0 },
      lessonStates: [
        { lessonId: 'w03d1', status: 'not_started', startedAt: null, completedAt: null, elapsedMs: 0, score: null, cursor: 0 },
      ],
      cards: [],
      reviews: [],
      attempts: [],
      notes: [],
      bookmarks: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.lessonStates[0].lastSeenAt).toBeNull();
    expect(result.file.settings).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 5. empty database                                                   */
/* ------------------------------------------------------------------ */

describe('empty database', () => {
  it('exports zero counts and imports without error', () => {
    const file = buildExport(
      { settings, lessonStates: [], cards: [], reviews: [], attempts: [], notes: [], bookmarks: [] },
      { now: NOW },
    );
    expect(file.counts).toEqual({
      settings: 1,
      lessonStates: 0,
      cards: 0,
      reviews: 0,
      attempts: 0,
      notes: 0,
      bookmarks: 0,
    });
    expect(totalRecords(file)).toBe(0);

    const result = validateBackup(JSON.parse(serializeBackup(file)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.counts).toEqual(file.counts);

    const store = memStore();
    writeAtomic(store, 'live', 'staging', toWebDb(result.file));
    const restored = JSON.parse(store.data.get('live') ?? '{}') as WebDbPayload;
    expect(countWebDb(restored)).toEqual({
      lessonStates: 0,
      cards: 0,
      reviews: 0,
      attempts: 0,
      notes: 0,
      bookmarks: 0,
    });
  });

  it('accepts an empty legacy snapshot (no counts, no settings)', () => {
    const result = validateBackup({
      format: 'wordroots-snapshot',
      schema_version: 2,
      exported_at: NOW,
      lesson_state: [],
      card: [],
      review: [],
      attempt: [],
      note: [],
      bookmark: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.settings).toBeNull();
    expect(result.file.counts.settings).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* legacy snapshot parsing details                                     */
/* ------------------------------------------------------------------ */

describe('legacy snapshot rows', () => {
  it('reads snake_case review rows and 1/0 booleans from a Rust export', () => {
    const result = validateBackup({
      format: 'wordroots-snapshot',
      schema_version: 2,
      exported_at: NOW,
      lesson_state: [
        {
          lessonId: 'w01d1',
          status: 'completed',
          startedAt: NOW - 5_000,
          completedAt: NOW,
          elapsedMs: 5_000,
          score: 1,
          cursor: 7,
        },
      ],
      card: [],
      review: [
        { id: 3, card_id: 'concept:c-1', rating: 4, ts: NOW, correct: 0, phase: 'review', elapsed_ms: 4_000 },
      ],
      attempt: [
        {
          id: 9,
          lesson_id: 'w01d1',
          exercise_id: 'w01d1-e1',
          kind: 'mcq',
          correct: 1,
          ts: NOW,
          duration_ms: 3_000,
          answer: null,
        },
      ],
      note: [{ id: 2, targetType: 'word', targetId: 'struct', body: 'n', createdAt: NOW, updatedAt: NOW }],
      bookmark: [{ targetType: 'word', targetId: 'struct', createdAt: NOW }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.reviews[0]).toMatchObject({ cardId: 'concept:c-1', correct: false, elapsedMs: 4_000 });
    expect(result.file.attempts[0]).toMatchObject({ lessonId: 'w01d1', correct: true, durationMs: 3_000 });
    expect(result.file.attempts[0].answer).toBeUndefined();
    expect(result.file.lessonStates[0].lastSeenAt).toBe(NOW - 5_000);
    expect(result.file.counts).toEqual({
      settings: 0,
      lessonStates: 1,
      cards: 0,
      reviews: 1,
      attempts: 1,
      notes: 1,
      bookmarks: 1,
    });
  });
});

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */

describe('file metadata', () => {
  it('keeps the backup file self-describing', () => {
    const file: BackupFile = buildExport(sampleData(), { now: NOW });
    expect(Object.keys(file)).toEqual([
      'format',
      'schemaVersion',
      'appVersion',
      'exportedAt',
      'counts',
      'settings',
      'lessonStates',
      'cards',
      'reviews',
      'attempts',
      'notes',
      'bookmarks',
    ]);
  });
});
