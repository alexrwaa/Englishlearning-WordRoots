use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::paths;

pub const SCHEMA_VERSION: i32 = 4;

const MIGRATION_V1: &str = r#"
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_state (
  lesson_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'not_started',
  started_at INTEGER,
  completed_at INTEGER,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  score REAL,
  cursor INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS card (
  card_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state INTEGER NOT NULL DEFAULT 0,
  due INTEGER NOT NULL,
  last_review INTEGER
);
CREATE TABLE IF NOT EXISTS review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  phase TEXT NOT NULL,
  elapsed_ms INTEGER
);
CREATE TABLE IF NOT EXISTS attempt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  correct INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  answer TEXT
);
CREATE TABLE IF NOT EXISTS note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmark (
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (target_type, target_id)
);
CREATE TABLE IF NOT EXISTS session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  minutes INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_review_ts ON review(ts);
CREATE INDEX IF NOT EXISTS idx_attempt_ts ON attempt(ts);
CREATE INDEX IF NOT EXISTS idx_card_due ON card(due);
CREATE INDEX IF NOT EXISTS idx_note_target ON note(target_type, target_id);
"#;


/// v2: add the bits needed for honest timing and for future content updates.
/// Everything is additive, so a v1 database keeps all of its rows.
const MIGRATION_V2: &str = r#"
ALTER TABLE lesson_state ADD COLUMN last_seen_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_attempt_ts ON attempt(ts);
CREATE INDEX IF NOT EXISTS idx_review_card_ts ON review(card_id, ts);
CREATE INDEX IF NOT EXISTS idx_note_target ON note(target_type, target_id);
"#;

/// v3: learning-assessment runs move out of `localStorage` into the product
/// database so they are covered by backups and travel with the portable folder.
///
/// `payload` is the full `RunResult` JSON (dimensions/overall/answers) and is
/// treated as opaque text: an unreadable row is skipped by the read path instead
/// of failing the whole query, so one bad write can never block startup.
const MIGRATION_V3: &str = r#"
CREATE TABLE IF NOT EXISTS assessment_runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  item_bank_version INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assessment_finished ON assessment_runs(finished_at DESC);
"#;

/// v4: family-inquiry progress moves out of `localStorage` into the product
/// database, so it is covered by backups and travels with the portable folder.
///
/// `schema_version` is the *record* shape, not the database schema: it lets a
/// future build tell a row it understands from one written by a newer app.
/// `done` / `picks` / `sums` are JSON text. A row whose JSON no longer parses is
/// counted as skipped by the read path; it never blocks startup. An unknown
/// `schema_version` is *not* skipped — it is reported as an error, because
/// silently dropping a newer record would lose data.
const MIGRATION_V4: &str = r#"
CREATE TABLE IF NOT EXISTS inquiry_progress (
  family_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  step INTEGER NOT NULL,
  done TEXT NOT NULL,
  hypothesis TEXT NOT NULL DEFAULT '',
  picks TEXT NOT NULL DEFAULT '{}',
  sums TEXT NOT NULL DEFAULT '{}',
  hints INTEGER NOT NULL DEFAULT 0,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiry_updated ON inquiry_progress(updated_at DESC);
"#;

/// Apply every migration the database is missing. Kept separate from `open()` so
/// it can be tested against an in-memory database at any starting version.
pub fn migrate(conn: &mut Connection) -> Result<(), String> {
    let mut version = read_version(conn)?;

    if version < 1 {
        conn.execute_batch(MIGRATION_V1).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO meta(key, value) VALUES('schema_version', '1')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .map_err(|e| e.to_string())?;
        version = 1;
    }

    if version < 2 {
        conn.execute_batch(MIGRATION_V2).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO meta(key, value) VALUES('schema_version', '2')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .map_err(|e| e.to_string())?;
        version = 2;
    }

    if version < 3 {
        conn.execute_batch(MIGRATION_V3).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO meta(key, value) VALUES('schema_version', '3')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .map_err(|e| e.to_string())?;
        version = 3;
    }

    if version < 4 {
        conn.execute_batch(MIGRATION_V4).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO meta(key, value) VALUES('schema_version', '4')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .map_err(|e| e.to_string())?;
        version = 4;
    }

    paths::log_line(&format!(
        "schema at v{version} (target v{SCHEMA_VERSION})"
    ));
    Ok(())
}

pub fn open() -> Result<Connection, String> {
    let path = paths::db_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let existed_with_data = path.exists() && fs::metadata(&path).map(|m| m.len() > 0).unwrap_or(false);

    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(|e| e.to_string())?;

    let mut conn = conn;
    let version = read_version(&conn)?;
    if version < SCHEMA_VERSION {
        if existed_with_data && version > 0 {
            // Never migrate without a restore point.
            if let Ok(path) = backup(&format!("pre-migration-v{version}")) {
                paths::log_line(&format!("pre-migration backup: {path}"));
            }
        }
        migrate(&mut conn)?;
        conn.execute(
            "INSERT INTO meta(key, value) VALUES('created_at', ?1)
             ON CONFLICT(key) DO NOTHING",
            params![paths::now_ms().to_string()],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(conn)
}

fn read_version(conn: &Connection) -> Result<i32, String> {
    let exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='meta'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Ok(0);
    }
    let value: Option<String> = conn
        .query_row("SELECT value FROM meta WHERE key='schema_version'", [], |row| row.get(0))
        .ok();
    Ok(value.and_then(|v| v.parse().ok()).unwrap_or(0))
}

/// Copy the live database into `backups/` with a timestamped name.
pub fn backup(label: &str) -> Result<String, String> {
    let source = paths::db_path();
    if !source.exists() {
        return Err("database not created yet".into());
    }
    fs::create_dir_all(paths::backups_dir()).map_err(|e| e.to_string())?;
    let stamp = paths::now_ms();
    let target = paths::backups_dir().join(format!("wordroots-{label}-{stamp}.db"));
    // Use SQLite's backup-friendly copy semantics: checkpoint happens on close,
    // but copying WAL + db is not atomic, so copy via the sqlite API instead.
    let conn = Connection::open(&source).map_err(|e| e.to_string())?;
    conn.execute_batch(&format!(
        "VACUUM INTO '{}'",
        target.to_string_lossy().replace('\'', "''")
    ))
    .map_err(|e| format!("backup failed: {e}"))?;
    Ok(target.to_string_lossy().to_string())
}

pub fn integrity_ok(conn: &Connection) -> bool {
    match conn.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0)) {
        Ok(v) => v == "ok",
        Err(_) => false,
    }
}

/// Remove backups beyond the 20 most recent, keeping disk usage bounded.
pub fn prune_backups() {
    let dir = paths::backups_dir();
    let Ok(entries) = fs::read_dir(&dir) else { return };
    let mut files: Vec<_> = entries
        .flatten()
        .filter(|e| e.path().extension().map(|x| x == "db").unwrap_or(false))
        .collect();
    files.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    if files.len() > 20 {
        for f in &files[..files.len() - 20] {
            let _ = fs::remove_file(f.path());
        }
    }
}

/* ---------------------------- row types ---------------------------- */

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonStateRow {
    pub lesson_id: String,
    pub status: String,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub elapsed_ms: i64,
    pub score: Option<f64>,
    pub cursor: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardRow {
    pub card_id: String,
    pub kind: String,
    pub ref_id: String,
    pub stability: f64,
    pub difficulty: f64,
    pub reps: i64,
    pub lapses: i64,
    pub state: i64,
    pub due: i64,
    pub last_review: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRow {
    pub card_id: String,
    pub rating: i64,
    pub ts: i64,
    pub correct: bool,
    pub phase: String,
    pub elapsed_ms: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttemptRow {
    pub lesson_id: String,
    pub exercise_id: String,
    pub kind: String,
    pub correct: bool,
    pub ts: i64,
    pub duration_ms: i64,
    pub answer: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteRow {
    pub id: i64,
    pub target_type: String,
    pub target_id: String,
    pub body: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkRow {
    pub target_type: String,
    pub target_id: String,
    pub created_at: i64,
}

/// Most recent attempts first; the report only needs a window, not the archive.
/// (`AttemptRow` already existed for the export path; this reuses it so the
/// report and the backup cannot drift apart.)
pub fn attempts(conn: &Connection, limit: i64) -> Result<Vec<AttemptRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT lesson_id, exercise_id, kind, correct, ts, duration_ms, answer
             FROM attempt ORDER BY ts DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([limit], |row| {
            Ok(AttemptRow {
                lesson_id: row.get(0)?,
                exercise_id: row.get(1)?,
                kind: row.get(2)?,
                correct: row.get::<_, i64>(3)? != 0,
                ts: row.get(4)?,
                duration_ms: row.get(5)?,
                answer: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStat {
    pub date: String,
    pub minutes: f64,
    pub reviews: i64,
    pub correct: i64,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub lessons_completed: i64,
    pub reviews: i64,
    pub attempts: i64,
    pub correct: i64,
    pub total_minutes: f64,
    pub first_day: Option<String>,
    pub active_days: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KindStat {
    pub kind: String,
    pub correct: i64,
    pub total: i64,
}

/* ---------------------------- queries ---------------------------- */

pub fn load_lesson_states(conn: &Connection) -> Result<Vec<LessonStateRow>, String> {
    let mut stmt = conn
        .prepare("SELECT lesson_id, status, started_at, completed_at, elapsed_ms, score, cursor FROM lesson_state")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(LessonStateRow {
                lesson_id: r.get(0)?,
                status: r.get(1)?,
                started_at: r.get(2)?,
                completed_at: r.get(3)?,
                elapsed_ms: r.get(4)?,
                score: r.get(5)?,
                cursor: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn load_cards(conn: &Connection) -> Result<Vec<CardRow>, String> {
    let mut stmt = conn
        .prepare("SELECT card_id, kind, ref_id, stability, difficulty, reps, lapses, state, due, last_review FROM card")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CardRow {
                card_id: r.get(0)?,
                kind: r.get(1)?,
                ref_id: r.get(2)?,
                stability: r.get(3)?,
                difficulty: r.get(4)?,
                reps: r.get(5)?,
                lapses: r.get(6)?,
                state: r.get(7)?,
                due: r.get(8)?,
                last_review: r.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn daily_stats(conn: &Connection) -> Result<Vec<DailyStat>, String> {
    let mut stmt = conn
        .prepare(
            "WITH days AS (
               SELECT date(ts/1000, 'unixepoch', 'localtime') AS d,
                      SUM(COALESCE(duration_ms,0))/60000.0 AS m
               FROM attempt GROUP BY d
             ),
             rev AS (
               SELECT date(ts/1000, 'unixepoch', 'localtime') AS d,
                      COUNT(*) AS n,
                      SUM(correct) AS c
               FROM review GROUP BY d
             )
             SELECT COALESCE(days.d, rev.d) AS day,
                    COALESCE(days.m, 0) AS minutes,
                    COALESCE(rev.n, 0) AS reviews,
                    COALESCE(rev.c, 0) AS correct,
                    COALESCE(rev.n, 0) AS total
             FROM days LEFT JOIN rev ON days.d = rev.d
             UNION
             SELECT rev.d, 0, rev.n, rev.c, rev.n FROM rev
             WHERE rev.d NOT IN (SELECT d FROM days)
             ORDER BY day ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(DailyStat {
                date: r.get(0)?,
                minutes: r.get(1)?,
                reviews: r.get(2)?,
                correct: r.get(3)?,
                total: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn totals(conn: &Connection) -> Result<Totals, String> {
    let lessons_completed: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM lesson_state WHERE status='completed'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let reviews: i64 = conn.query_row("SELECT COUNT(*) FROM review", [], |r| r.get(0)).unwrap_or(0);
    let attempts: i64 = conn.query_row("SELECT COUNT(*) FROM attempt", [], |r| r.get(0)).unwrap_or(0);
    let correct: i64 = conn
        .query_row("SELECT COALESCE(SUM(correct),0) FROM attempt", [], |r| r.get(0))
        .unwrap_or(0);
    let active_days: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT date(ts/1000,'unixepoch','localtime')) FROM attempt",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let total_minutes: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_ms),0)/60000.0 FROM attempt",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);
    let first_day: Option<String> = conn
        .query_row(
            "SELECT MIN(date(ts/1000,'unixepoch','localtime')) FROM attempt",
            [],
            |r| r.get(0),
        )
        .ok()
        .flatten();
    Ok(Totals {
        lessons_completed,
        reviews,
        attempts,
        correct,
        total_minutes,
        first_day,
        active_days,
    })
}

pub fn kind_stats(conn: &Connection) -> Result<Vec<KindStat>, String> {
    let mut stmt = conn
        .prepare("SELECT kind, SUM(correct), COUNT(*) FROM attempt GROUP BY kind")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(KindStat {
                kind: r.get(0)?,
                correct: r.get(1)?,
                total: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn notes(conn: &Connection) -> Result<Vec<NoteRow>, String> {
    let mut stmt = conn
        .prepare("SELECT id, target_type, target_id, body, created_at, updated_at FROM note ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(NoteRow {
                id: r.get(0)?,
                target_type: r.get(1)?,
                target_id: r.get(2)?,
                body: r.get(3)?,
                created_at: r.get(4)?,
                updated_at: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn bookmarks(conn: &Connection) -> Result<Vec<BookmarkRow>, String> {
    let mut stmt = conn
        .prepare("SELECT target_type, target_id, created_at FROM bookmark ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(BookmarkRow {
                target_type: r.get(0)?,
                target_id: r.get(1)?,
                created_at: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

/* -------------------------- assessment runs -------------------------- */

/// Upper bound for a history read. The UI only ever draws the newest handful,
/// but a bounded read keeps a runaway database from blowing up IPC payloads.
pub const ASSESSMENT_READ_LIMIT: i64 = 200;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentRunRow {
    pub id: String,
    pub mode: String,
    pub item_bank_version: i64,
    pub started_at: i64,
    pub finished_at: i64,
    pub duration_ms: i64,
    pub payload: String,
    pub created_at: i64,
}

/// Input of `assessment_save`: the run's metadata plus its whole `RunResult`
/// as an opaque JSON value (scoring/answer detail lives in `payload`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentRunInput {
    pub id: String,
    pub mode: String,
    /// Older callers may omit it; the column has no sensible 0 value.
    #[serde(default = "default_item_bank_version")]
    pub item_bank_version: i64,
    pub started_at: i64,
    pub finished_at: i64,
    pub duration_ms: i64,
    #[serde(default)]
    pub payload: serde_json::Value,
}

fn default_item_bank_version() -> i64 {
    1
}

/// `{runs, skipped}`. `skipped` counts rows whose payload could not be parsed:
/// they are dropped from `runs` but reported so the UI can say so instead of
/// pretending the history is complete.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentList {
    pub runs: Vec<serde_json::Value>,
    pub skipped: usize,
}

pub fn assessment_save(conn: &Connection, run: &AssessmentRunInput) -> Result<(), String> {
    if run.id.trim().is_empty() {
        return Err("assessment run id is required".into());
    }
    let payload = if run.payload.is_null() {
        serde_json::json!({
            "id": run.id,
            "mode": run.mode,
            "itemBankVersion": run.item_bank_version,
            "startedAt": run.started_at,
            "finishedAt": run.finished_at,
            "durationMs": run.duration_ms,
        })
    } else {
        run.payload.clone()
    };
    conn.execute(
        "INSERT OR REPLACE INTO assessment_runs
           (id, mode, item_bank_version, started_at, finished_at, duration_ms, payload, created_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            &run.id,
            &run.mode,
            run.item_bank_version,
            run.started_at,
            run.finished_at,
            run.duration_ms,
            serde_json::to_string(&payload).map_err(|e| e.to_string())?,
            paths::now_ms(),
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Newest first. A row whose `payload` is not valid JSON is skipped and counted;
/// one damaged row must never take the history (or startup) down with it.
pub fn assessment_list(conn: &Connection, limit: i64) -> Result<AssessmentList, String> {
    let limit = limit.clamp(1, ASSESSMENT_READ_LIMIT);
    let mut stmt = conn
        .prepare(
            "SELECT payload FROM assessment_runs
             ORDER BY finished_at DESC, created_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut runs = Vec::new();
    let mut skipped = 0usize;
    for row in rows {
        let raw = row.map_err(|e| e.to_string())?;
        match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(value) if value.is_object() => runs.push(value),
            _ => skipped += 1,
        }
    }
    Ok(AssessmentList { runs, skipped })
}

pub fn assessment_clear(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM assessment_runs", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn assessment_count(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM assessment_runs", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

/* ------------------------- family inquiry progress ------------------------- */

/// Version of the *record* shape stored in `inquiry_progress.schema_version`.
/// Independent of `SCHEMA_VERSION` (the database schema): a row written here
/// stays readable even if the table gains a column later.
pub const INQUIRY_RECORD_VERSION: i64 = 1;

/// Input of `inquiry_progress_save`. JSON fields arrive as values (the shim and
/// the renderer both send objects) and are serialised here.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InquiryProgressInput {
    pub family_id: String,
    #[serde(default = "default_inquiry_record_version")]
    pub schema_version: i64,
    pub step: i64,
    /// Omitted by an older caller: an empty step list is the honest default.
    #[serde(default)]
    pub done: serde_json::Value,
    #[serde(default)]
    pub hypothesis: String,
    #[serde(default)]
    pub picks: serde_json::Value,
    #[serde(default)]
    pub sums: serde_json::Value,
    #[serde(default)]
    pub hints: i64,
    #[serde(default)]
    pub elapsed_ms: i64,
    /// 0 / missing means "now"; the caller may pass a value in tests.
    #[serde(default)]
    pub updated_at: i64,
}

fn default_inquiry_record_version() -> i64 {
    INQUIRY_RECORD_VERSION
}

/// `{items, skipped}`. `skipped` counts rows whose JSON columns are unreadable:
/// one damaged family must not make every other family's progress disappear.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InquiryList {
    pub items: Vec<serde_json::Value>,
    pub skipped: usize,
}

/// Persist one family's progress. `INSERT OR REPLACE` makes a retry idempotent.
pub fn inquiry_progress_save(
    conn: &Connection,
    progress: &InquiryProgressInput,
) -> Result<(), String> {
    let family_id = progress.family_id.trim();
    if family_id.is_empty() {
        return Err("family id is required".into());
    }
    if progress.schema_version > INQUIRY_RECORD_VERSION {
        return Err(format!(
            "refusing to write inquiry record v{} (this build understands v{INQUIRY_RECORD_VERSION})",
            progress.schema_version
        ));
    }

    let done = match &progress.done {
        serde_json::Value::Null => serde_json::json!([]),
        serde_json::Value::Array(_) => progress.done.clone(),
        _ => return Err("inquiry `done` must be an array".into()),
    };
    let picks = if progress.picks.is_null() {
        serde_json::json!({})
    } else if progress.picks.is_object() {
        progress.picks.clone()
    } else {
        return Err("inquiry `picks` must be an object".into());
    };
    let sums = if progress.sums.is_null() {
        serde_json::json!({})
    } else if progress.sums.is_object() {
        progress.sums.clone()
    } else {
        return Err("inquiry `sums` must be an object".into());
    };
    let updated_at = if progress.updated_at > 0 {
        progress.updated_at
    } else {
        paths::now_ms()
    };

    conn.execute(
        "INSERT OR REPLACE INTO inquiry_progress
           (family_id, schema_version, step, done, hypothesis, picks, sums, hints, elapsed_ms, updated_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            family_id,
            INQUIRY_RECORD_VERSION,
            progress.step,
            serde_json::to_string(&done).map_err(|e| e.to_string())?,
            &progress.hypothesis,
            serde_json::to_string(&picks).map_err(|e| e.to_string())?,
            serde_json::to_string(&sums).map_err(|e| e.to_string())?,
            progress.hints,
            progress.elapsed_ms,
            updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// All families, most recently touched first.
///
/// A row with unknown `schema_version` aborts the read with an error: the UI is
/// told the data is too new for this build instead of being handed a partial
/// list that looks complete. Corrupt JSON columns only cost that one row.
pub fn inquiry_progress_list(conn: &Connection) -> Result<InquiryList, String> {
    let mut stmt = conn
        .prepare(
            "SELECT family_id, schema_version, step, done, hypothesis, picks, sums, hints, elapsed_ms, updated_at
             FROM inquiry_progress ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, i64>(7)?,
                r.get::<_, i64>(8)?,
                r.get::<_, i64>(9)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    let mut skipped = 0usize;
    for row in rows {
        let (family_id, schema_version, step, done_raw, hypothesis, picks_raw, sums_raw, hints, elapsed_ms, updated_at) =
            row.map_err(|e| e.to_string())?;

        if schema_version > INQUIRY_RECORD_VERSION {
            return Err(format!(
                "inquiry progress for `{family_id}` was saved by a newer app version (record v{schema_version})"
            ));
        }

        let done = serde_json::from_str::<serde_json::Value>(&done_raw);
        let picks = serde_json::from_str::<serde_json::Value>(&picks_raw);
        let sums = serde_json::from_str::<serde_json::Value>(&sums_raw);
        let (Ok(done), Ok(picks), Ok(sums)) = (done, picks, sums) else {
            skipped += 1;
            continue;
        };
        if !done.is_array() || !picks.is_object() || !sums.is_object() {
            skipped += 1;
            continue;
        }

        items.push(serde_json::json!({
            "familyId": family_id,
            "schemaVersion": schema_version,
            "step": step,
            "done": done,
            "hypothesis": hypothesis,
            "picks": picks,
            "sums": sums,
            "hints": hints,
            "elapsedMs": elapsed_ms,
            "updatedAt": updated_at,
        }));
    }
    Ok(InquiryList { items, skipped })
}

pub fn inquiry_progress_count(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM inquiry_progress", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

/* ---------------------------- export ---------------------------- */

#[derive(Serialize, Deserialize)]
struct Snapshot {
    format: String,
    schema_version: i32,
    exported_at: i64,
    lesson_state: Vec<LessonStateRow>,
    card: Vec<CardRow>,
    review: Vec<serde_json::Value>,
    attempt: Vec<serde_json::Value>,
    note: Vec<NoteRow>,
    bookmark: Vec<BookmarkRow>,
    /// Key/value settings. Defaulted so older exports (which omitted them) still
    /// import cleanly — in that case the current settings are left untouched.
    #[serde(default)]
    settings: Vec<serde_json::Value>,
    /// Learning-assessment history (v3). Defaulted for the same reason: an old
    /// export must not wipe a history it never carried.
    #[serde(default, alias = "assessment_runs")]
    assessment_run: Vec<serde_json::Value>,
    /// Family-inquiry progress (v4). Defaulted so a backup written before the
    /// table existed imports cleanly instead of wiping progress it never had.
    #[serde(default)]
    inquiry_progress: Vec<serde_json::Value>,
}

/// Canonical snapshot body (no file I/O). Separated so it can be tested without
/// touching the portable data directory.
pub fn snapshot_json(conn: &Connection) -> Result<String, String> {
    fn rows(conn: &Connection, sql: &str) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let cols: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
        let mut out = Vec::new();
        let mut cursor = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = cursor.next().map_err(|e| e.to_string())? {
            let mut map = serde_json::Map::new();
            for (i, col) in cols.iter().enumerate() {
                let value = match row.get_ref(i) {
                    Ok(rusqlite::types::ValueRef::Null) => serde_json::Value::Null,
                    Ok(rusqlite::types::ValueRef::Integer(v)) => serde_json::json!(v),
                    Ok(rusqlite::types::ValueRef::Real(v)) => serde_json::json!(v),
                    Ok(rusqlite::types::ValueRef::Text(t)) => {
                        serde_json::json!(String::from_utf8_lossy(t))
                    }
                    _ => serde_json::Value::Null,
                };
                map.insert(col.clone(), value);
            }
            out.push(serde_json::Value::Object(map));
        }
        Ok(out)
    }

    let snapshot = Snapshot {
        format: "wordroots-snapshot".into(),
        schema_version: SCHEMA_VERSION,
        exported_at: paths::now_ms(),
        lesson_state: load_lesson_states(conn)?,
        card: load_cards(conn)?,
        review: rows(conn, "SELECT * FROM review")?,
        attempt: rows(conn, "SELECT * FROM attempt")?,
        note: notes(conn)?,
        bookmark: bookmarks(conn)?,
        settings: rows(conn, "SELECT key, value FROM settings")?,
        assessment_run: rows(conn, "SELECT * FROM assessment_runs ORDER BY finished_at ASC")?,
        // Raw rows on purpose: a backup must stay lossless even for a record
        // shape this build does not understand yet.
        inquiry_progress: rows(conn, "SELECT * FROM inquiry_progress ORDER BY updated_at ASC")?,
    };
    serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())
}

pub fn export_snapshot(conn: &Connection) -> Result<String, String> {
    let json = snapshot_json(conn)?;
    fs::create_dir_all(paths::backups_dir()).map_err(|e| e.to_string())?;
    let path = paths::backups_dir().join(format!("wordroots-export-{}.json", paths::now_ms()));
    write_with_checksum(&path, &json)?;
    Ok(path.to_string_lossy().to_string())
}

fn write_with_checksum(path: &Path, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())?;
    // Simple, dependency-free integrity marker (FNV-1a 64-bit).
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in content.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    let sidecar = path.with_extension("json.fnv");
    fs::write(sidecar, format!("{hash:016x}")).map_err(|e| e.to_string())?;
    Ok(())
}

/// Read a JSON column that may arrive either as text (a Rust snapshot writes
/// TEXT columns verbatim) or as a real value (the renderer's `toSnapshot`).
fn json_column_text(value: Option<&serde_json::Value>, fallback: &str) -> String {
    match value {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(v) if !v.is_null() => v.to_string(),
        _ => fallback.to_string(),
    }
}

pub fn import_snapshot(conn: &mut Connection, json: &str) -> Result<(), String> {
    let snapshot: Snapshot =
        serde_json::from_str(json).map_err(|e| format!("invalid snapshot: {e}"))?;
    if snapshot.format != "wordroots-snapshot" {
        return Err("not a WordRoots snapshot".into());
    }
    if snapshot.schema_version > SCHEMA_VERSION {
        return Err("snapshot comes from a newer app version".into());
    }
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch(
        "DELETE FROM lesson_state; DELETE FROM card; DELETE FROM review; DELETE FROM attempt;
         DELETE FROM note; DELETE FROM bookmark;",
    )
    .map_err(|e| e.to_string())?;

    // Settings are restored only when the file carries them; an old export must
    // not silently reset the learner's theme, pace or explanation language.
    if !snapshot.settings.is_empty() {
        tx.execute_batch("DELETE FROM settings")
            .map_err(|e| e.to_string())?;
        for row in &snapshot.settings {
            let key = row.get("key").and_then(|v| v.as_str()).unwrap_or_default();
            let value = row.get("value").and_then(|v| v.as_str()).unwrap_or_default();
            if key.is_empty() {
                continue;
            }
            tx.execute(
                "INSERT INTO settings(key, value) VALUES(?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    for s in &snapshot.lesson_state {
        tx.execute(
            "INSERT INTO lesson_state(lesson_id,status,started_at,completed_at,elapsed_ms,score,cursor)
             VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![s.lesson_id, s.status, s.started_at, s.completed_at, s.elapsed_ms, s.score, s.cursor],
        )
        .map_err(|e| e.to_string())?;
    }
    for c in &snapshot.card {
        tx.execute(
            "INSERT INTO card(card_id,kind,ref_id,stability,difficulty,reps,lapses,state,due,last_review)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![c.card_id, c.kind, c.ref_id, c.stability, c.difficulty, c.reps, c.lapses, c.state, c.due, c.last_review],
        )
        .map_err(|e| e.to_string())?;
    }
    for r in &snapshot.review {
        let card_id = r.get("card_id").and_then(|v| v.as_str()).unwrap_or_default();
        let rating = r.get("rating").and_then(|v| v.as_i64()).unwrap_or(3);
        let ts = r.get("ts").and_then(|v| v.as_i64()).unwrap_or(0);
        let correct = r.get("correct").and_then(|v| v.as_i64()).unwrap_or(0);
        let phase = r.get("phase").and_then(|v| v.as_str()).unwrap_or("review");
        let elapsed = r.get("elapsed_ms").and_then(|v| v.as_i64());
        tx.execute(
            "INSERT INTO review(card_id,rating,ts,correct,phase,elapsed_ms) VALUES(?1,?2,?3,?4,?5,?6)",
            params![card_id, rating, ts, correct, phase, elapsed],
        )
        .map_err(|e| e.to_string())?;
    }
    for a in &snapshot.attempt {
        let lesson_id = a.get("lesson_id").and_then(|v| v.as_str()).unwrap_or_default();
        let exercise_id = a.get("exercise_id").and_then(|v| v.as_str()).unwrap_or_default();
        let kind = a.get("kind").and_then(|v| v.as_str()).unwrap_or("mcq");
        let correct = a.get("correct").and_then(|v| v.as_i64()).unwrap_or(0);
        let ts = a.get("ts").and_then(|v| v.as_i64()).unwrap_or(0);
        let duration = a.get("duration_ms").and_then(|v| v.as_i64()).unwrap_or(0);
        let answer = a.get("answer").and_then(|v| v.as_str());
        tx.execute(
            "INSERT INTO attempt(lesson_id,exercise_id,kind,correct,ts,duration_ms,answer) VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![lesson_id, exercise_id, kind, correct, ts, duration, answer],
        )
        .map_err(|e| e.to_string())?;
    }
    for n in &snapshot.note {
        tx.execute(
            "INSERT INTO note(id,target_type,target_id,body,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6)",
            params![n.id, n.target_type, n.target_id, n.body, n.created_at, n.updated_at],
        )
        .map_err(|e| e.to_string())?;
    }
    for b in &snapshot.bookmark {
        tx.execute(
            "INSERT OR REPLACE INTO bookmark(target_type,target_id,created_at) VALUES(?1,?2,?3)",
            params![b.target_type, b.target_id, b.created_at],
        )
        .map_err(|e| e.to_string())?;
    }

    // Assessment history is replaced only when the file carries it, mirroring
    // the settings rule: restoring a v2 backup must not delete runs recorded
    // after that backup was written.
    if !snapshot.assessment_run.is_empty() {
        tx.execute_batch("DELETE FROM assessment_runs")
            .map_err(|e| e.to_string())?;
        for run in &snapshot.assessment_run {
            let id = run.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            if id.is_empty() {
                continue;
            }
            let mode = run.get("mode").and_then(|v| v.as_str()).unwrap_or("baseline");
            let bank = run
                .get("item_bank_version")
                .or_else(|| run.get("itemBankVersion"))
                .and_then(|v| v.as_i64())
                .unwrap_or(1);
            let started = run
                .get("started_at")
                .or_else(|| run.get("startedAt"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let finished = run
                .get("finished_at")
                .or_else(|| run.get("finishedAt"))
                .and_then(|v| v.as_i64())
                .unwrap_or(started);
            let duration = run
                .get("duration_ms")
                .or_else(|| run.get("durationMs"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let created = run
                .get("created_at")
                .or_else(|| run.get("createdAt"))
                .and_then(|v| v.as_i64())
                .unwrap_or(finished);
            let payload = match run.get("payload") {
                Some(serde_json::Value::String(s)) => s.clone(),
                Some(value) => serde_json::to_string(value).map_err(|e| e.to_string())?,
                None => serde_json::to_string(run).map_err(|e| e.to_string())?,
            };
            tx.execute(
                "INSERT OR REPLACE INTO assessment_runs
                   (id,mode,item_bank_version,started_at,finished_at,duration_ms,payload,created_at)
                 VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
                params![id, mode, bank, started, finished, duration, payload, created],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    // Inquiry progress is replaced only when the file carries it. That keeps an
    // old backup (no such table in the file) from erasing progress recorded
    // after the backup was taken.
    if !snapshot.inquiry_progress.is_empty() {
        tx.execute_batch("DELETE FROM inquiry_progress")
            .map_err(|e| e.to_string())?;
        for item in &snapshot.inquiry_progress {
            let family_id = item
                .get("family_id")
                .or_else(|| item.get("familyId"))
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            if family_id.is_empty() {
                continue;
            }
            let number = |snake: &str, camel: &str, fallback: i64| {
                item.get(snake)
                    .or_else(|| item.get(camel))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(fallback)
            };
            let schema_version = number("schema_version", "schemaVersion", INQUIRY_RECORD_VERSION);
            let step = number("step", "step", 0);
            let hints = number("hints", "hints", 0);
            let elapsed_ms = number("elapsed_ms", "elapsedMs", 0);
            let updated_at = number("updated_at", "updatedAt", 0);
            let hypothesis = item
                .get("hypothesis")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let done = json_column_text(item.get("done"), "[]");
            let picks = json_column_text(item.get("picks"), "{}");
            let sums = json_column_text(item.get("sums"), "{}");

            tx.execute(
                "INSERT OR REPLACE INTO inquiry_progress
                   (family_id, schema_version, step, done, hypothesis, picks, sums, hints, elapsed_ms, updated_at)
                 VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                params![
                    family_id,
                    schema_version,
                    step,
                    done,
                    hypothesis,
                    picks,
                    sums,
                    hints,
                    elapsed_ms,
                    updated_at
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;

    fn v1_only() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATION_V1).unwrap();
        conn.execute(
            "INSERT INTO meta(key, value) VALUES('schema_version','1')",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn migrates_v1_to_v2_without_losing_rows() {
        let mut conn = v1_only();
        conn.execute(
            "INSERT INTO lesson_state(lesson_id, status, elapsed_ms) VALUES('w01d1','completed',12345)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings(key, value) VALUES('dailyMinutes','30')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO attempt(lesson_id, exercise_id, kind, correct, ts, duration_ms) VALUES('w01d1','e1','mcq',1,1700000000000,4200)",
            [],
        )
        .unwrap();

        migrate(&mut conn).unwrap();

        assert_eq!(read_version(&conn).unwrap(), SCHEMA_VERSION);
        let elapsed: i64 = conn
            .query_row("SELECT elapsed_ms FROM lesson_state WHERE lesson_id='w01d1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(elapsed, 12345);
        let dur: i64 = conn
            .query_row("SELECT duration_ms FROM attempt WHERE exercise_id='e1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(dur, 4200);
        let setting: String = conn
            .query_row("SELECT value FROM settings WHERE key='dailyMinutes'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(setting, "30");

        // The new column must exist and default to NULL.
        let seen: Option<i64> = conn
            .query_row("SELECT last_seen_at FROM lesson_state WHERE lesson_id='w01d1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(seen, None);

        // Indexes from v2 are present.
        let idx: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='index' AND name IN ('idx_attempt_ts','idx_review_card_ts','idx_note_target')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(idx, 3);
    }

    #[test]
    fn totals_and_daily_stats_use_attempt_duration() {
        // Regression: the SQL used to read `attempt.elapsed_ms`, a column that
        // does not exist there (it belongs to lesson_state/review). SQLite failed
        // silently behind unwrap_or(0), so every build reported 0 minutes.
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        let now = paths::now_ms() as i64;
        conn.execute(
            "INSERT INTO attempt(lesson_id, exercise_id, kind, correct, ts, duration_ms) VALUES('w01d1','e1','mcq',1,?1,90000)",
            params![now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO attempt(lesson_id, exercise_id, kind, correct, ts, duration_ms) VALUES('w01d1','e2','cloze',0,?1,30000)",
            params![now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO review(card_id, rating, ts, correct, phase, elapsed_ms) VALUES('c1',3,?1,1,'review',5000)",
            params![now],
        )
        .unwrap();

        let totals = totals(&conn).unwrap();
        assert!(totals.total_minutes >= 1.9 && totals.total_minutes <= 2.1, "minutes={}", totals.total_minutes);
        assert_eq!(totals.attempts, 2);
        assert_eq!(totals.reviews, 1);

        let daily = daily_stats(&conn).unwrap();
        assert_eq!(daily.len(), 1);
        assert!(daily[0].minutes >= 1.9 && daily[0].minutes <= 2.1, "daily={}", daily[0].minutes);
        assert_eq!(daily[0].reviews, 1);
    }

    #[test]
    fn export_and_import_preserve_settings() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        conn.execute(
            "INSERT INTO settings(key, value) VALUES('dailyMinutes','30')",
            [],
        )
        .unwrap();

        let json = snapshot_json(&conn).unwrap();
        assert!(json.contains("dailyMinutes"));

        let mut fresh = Connection::open_in_memory().unwrap();
        migrate(&mut fresh).unwrap();
        import_snapshot(&mut fresh, &json).unwrap();
        let value: String = fresh
            .query_row("SELECT value FROM settings WHERE key='dailyMinutes'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(value, "30");
    }

    #[test]
    fn import_without_settings_keeps_current_ones() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        conn.execute("INSERT INTO settings(key, value) VALUES('theme','sepia')", [])
            .unwrap();
        let json = serde_json::json!({
            "format": "wordroots-snapshot",
            "schema_version": 2,
            "exported_at": 1,
            "lesson_state": [], "card": [], "review": [], "attempt": [], "note": [], "bookmark": []
        })
        .to_string();
        import_snapshot(&mut conn, &json).unwrap();
        let theme: String = conn
            .query_row("SELECT value FROM settings WHERE key='theme'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(theme, "sepia");
    }

    #[test]
    fn migration_is_idempotent() {
        let mut conn = v1_only();
        migrate(&mut conn).unwrap();
        migrate(&mut conn).unwrap();
        assert_eq!(read_version(&conn).unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn fresh_database_lands_on_latest_version() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        assert_eq!(read_version(&conn).unwrap(), SCHEMA_VERSION);
    }

    fn sample_run(id: &str, finished_at: i64, bank: i64) -> AssessmentRunInput {
        AssessmentRunInput {
            id: id.into(),
            mode: "baseline".into(),
            item_bank_version: bank,
            started_at: finished_at - 1000,
            finished_at,
            duration_ms: 1000,
            payload: serde_json::json!({
                "id": id, "mode": "baseline", "itemBankVersion": bank,
                "startedAt": finished_at - 1000, "finishedAt": finished_at,
                "durationMs": 1000, "answers": [], "dimensions": [], "overall": 50.0
            }),
        }
    }

    #[test]
    fn assessment_save_is_upsert_and_read_newest_first() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        assessment_save(&conn, &sample_run("a", 1000, 1)).unwrap();
        assessment_save(&conn, &sample_run("b", 2000, 2)).unwrap();
        assessment_save(&conn, &sample_run("a", 3000, 3)).unwrap();

        let list = assessment_list(&conn, ASSESSMENT_READ_LIMIT).unwrap();
        assert_eq!(list.runs.len(), 2, "upsert must not duplicate ids");
        assert_eq!(list.skipped, 0);
        assert_eq!(list.runs[0]["id"], "a");
        assert_eq!(list.runs[0]["itemBankVersion"], 3, "bank version round-trips");
        assert_eq!(assessment_count(&conn).unwrap(), 2);
    }

    #[test]
    fn assessment_list_skips_corrupt_payload() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        assessment_save(&conn, &sample_run("good", 1000, 1)).unwrap();
        conn.execute(
            "INSERT INTO assessment_runs(id,mode,item_bank_version,started_at,finished_at,duration_ms,payload,created_at)
             VALUES('bad','baseline',1,0,2000,0,'{not json',0)",
            [],
        )
        .unwrap();

        let list = assessment_list(&conn, ASSESSMENT_READ_LIMIT).unwrap();
        assert_eq!(list.runs.len(), 1);
        assert_eq!(list.runs[0]["id"], "good");
        assert_eq!(list.skipped, 1);

        assessment_clear(&conn).unwrap();
        assert_eq!(assessment_count(&conn).unwrap(), 0);
    }

    #[test]
    fn snapshot_carries_assessment_runs() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        assessment_save(&conn, &sample_run("a", 1000, 2)).unwrap();

        let json = snapshot_json(&conn).unwrap();
        assert!(json.contains("assessment_run"));

        let mut fresh = Connection::open_in_memory().unwrap();
        migrate(&mut fresh).unwrap();
        import_snapshot(&mut fresh, &json).unwrap();
        let list = assessment_list(&fresh, ASSESSMENT_READ_LIMIT).unwrap();
        assert_eq!(list.runs.len(), 1);
        assert_eq!(list.runs[0]["id"], "a");
    }

    fn sample_inquiry(family_id: &str, step: i64, updated_at: i64) -> InquiryProgressInput {
        InquiryProgressInput {
            family_id: family_id.to_string(),
            schema_version: INQUIRY_RECORD_VERSION,
            step,
            done: serde_json::json!(["observe", "discover"]),
            hypothesis: "表示「看」".into(),
            picks: serde_json::json!({ "discover": "suspect", "verify": { "inspect": true } }),
            sums: serde_json::json!({ "inspect": "in + spect" }),
            hints: 1,
            elapsed_ms: 42_000,
            updated_at,
        }
    }

    #[test]
    fn inquiry_save_is_upsert_and_keeps_families_apart() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        inquiry_progress_save(&conn, &sample_inquiry("fam-spect", 2, 1000)).unwrap();
        inquiry_progress_save(&conn, &sample_inquiry("fam-port", 1, 2000)).unwrap();
        inquiry_progress_save(&conn, &sample_inquiry("fam-spect", 4, 3000)).unwrap();

        assert_eq!(inquiry_progress_count(&conn).unwrap(), 2);

        let list = inquiry_progress_list(&conn).unwrap();
        assert_eq!(list.skipped, 0);
        assert_eq!(list.items.len(), 2);
        // Most recently touched first.
        assert_eq!(list.items[0]["familyId"], "fam-spect");
        assert_eq!(list.items[0]["step"], 4);
        assert_eq!(list.items[0]["done"], serde_json::json!(["observe", "discover"]));
        assert_eq!(list.items[0]["picks"]["discover"], "suspect");
        assert_eq!(list.items[1]["familyId"], "fam-port");
    }

    #[test]
    fn inquiry_list_skips_corrupt_json_but_keeps_the_rest() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        inquiry_progress_save(&conn, &sample_inquiry("fam-good", 1, 1000)).unwrap();
        conn.execute(
            "INSERT INTO inquiry_progress(family_id,schema_version,step,done,hypothesis,picks,sums,hints,elapsed_ms,updated_at)
             VALUES('fam-bad',1,0,'{not json','','{}','{}',0,0,2000)",
            [],
        )
        .unwrap();

        let list = inquiry_progress_list(&conn).unwrap();
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0]["familyId"], "fam-good");
        assert_eq!(list.skipped, 1);
    }

    #[test]
    fn inquiry_list_refuses_an_unknown_record_version() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        conn.execute(
            "INSERT INTO inquiry_progress(family_id,schema_version,step,done,hypothesis,picks,sums,hints,elapsed_ms,updated_at)
             VALUES('fam-future',99,0,'[]','','{}','{}',0,0,1000)",
            [],
        )
        .unwrap();

        let err = inquiry_progress_list(&conn).unwrap_err();
        assert!(err.contains("newer app version"), "{err}");
    }

    #[test]
    fn snapshot_carries_inquiry_progress() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        inquiry_progress_save(&conn, &sample_inquiry("fam-spect", 3, 1000)).unwrap();

        let json = snapshot_json(&conn).unwrap();
        assert!(json.contains("inquiry_progress"));

        let mut fresh = Connection::open_in_memory().unwrap();
        migrate(&mut fresh).unwrap();
        import_snapshot(&mut fresh, &json).unwrap();

        let list = inquiry_progress_list(&fresh).unwrap();
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0]["familyId"], "fam-spect");
        assert_eq!(list.items[0]["step"], 3);
        assert_eq!(list.items[0]["hypothesis"], "表示「看」");
        assert_eq!(list.items[0]["elapsedMs"], 42_000);
    }

    #[test]
    fn importing_an_old_snapshot_keeps_current_inquiry_progress() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        inquiry_progress_save(&conn, &sample_inquiry("fam-spect", 2, 1000)).unwrap();

        // A v3-era snapshot has no `inquiry_progress` key at all.
        let json = snapshot_json(&conn).unwrap();
        let mut serialized: serde_json::Value = serde_json::from_str(&json).unwrap();
        serialized.as_object_mut().unwrap().remove("inquiry_progress");
        import_snapshot(&mut conn, &serialized.to_string()).unwrap();

        let list = inquiry_progress_list(&conn).unwrap();
        assert_eq!(list.items.len(), 1, "an old backup must not erase progress");
        assert_eq!(list.items[0]["step"], 2);
    }
}
