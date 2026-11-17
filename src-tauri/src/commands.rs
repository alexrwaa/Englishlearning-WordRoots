use rusqlite::params;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

use crate::db::{self, AttemptRow, BookmarkRow, CardRow, DailyStat, KindStat, LessonStateRow, NoteRow, ReviewRow};
use crate::paths;

pub struct Db(pub Mutex<rusqlite::Connection>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    data_dir: String,
    db_path: String,
    courses_dir: String,
    backups_dir: String,
    version: String,
    schema_version: i32,
    portable: bool,
}

fn s(p: std::path::PathBuf) -> String {
    p.to_string_lossy().to_string()
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        data_dir: s(paths::data_dir()),
        db_path: s(paths::db_path()),
        courses_dir: s(paths::courses_dir()),
        backups_dir: s(paths::backups_dir()),
        version: env!("CARGO_PKG_VERSION").to_string(),
        schema_version: db::SCHEMA_VERSION,
        portable: std::env::var("WORDROOTS_DATA_DIR").is_err(),
    }
}

#[tauri::command]
pub fn log_event(level: String, message: String) {
    paths::log_line(&format!("[{level}] {message}"));
}

#[tauri::command]
pub fn load_settings(db: State<Db>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let value: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key='app'", [], |r| r.get(0))
        .ok();
    Ok(value.unwrap_or_else(|| "{}".into()))
}

#[tauri::command]
pub fn save_settings(db: State<Db>, json: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings(key, value) VALUES('app', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_lesson_states(db: State<Db>) -> Result<Vec<LessonStateRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::load_lesson_states(&conn)
}

#[tauri::command]
pub fn save_lesson_state(db: State<Db>, state: LessonStateRow) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO lesson_state(lesson_id,status,started_at,completed_at,elapsed_ms,score,cursor)
         VALUES(?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(lesson_id) DO UPDATE SET
           status=excluded.status,
           started_at=COALESCE(excluded.started_at, lesson_state.started_at),
           completed_at=COALESCE(excluded.completed_at, lesson_state.completed_at),
           elapsed_ms=excluded.elapsed_ms,
           score=excluded.score,
           cursor=excluded.cursor",
        params![
            state.lesson_id,
            state.status,
            state.started_at,
            state.completed_at,
            state.elapsed_ms,
            state.score,
            state.cursor
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_cards(db: State<Db>) -> Result<Vec<CardRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::load_cards(&conn)
}

#[tauri::command]
pub fn save_card(db: State<Db>, card: CardRow) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO card(card_id,kind,ref_id,stability,difficulty,reps,lapses,state,due,last_review)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(card_id) DO UPDATE SET
           stability=excluded.stability, difficulty=excluded.difficulty, reps=excluded.reps,
           lapses=excluded.lapses, state=excluded.state, due=excluded.due,
           last_review=excluded.last_review",
        params![
            card.card_id,
            card.kind,
            card.ref_id,
            card.stability,
            card.difficulty,
            card.reps,
            card.lapses,
            card.state,
            card.due,
            card.last_review
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn add_review(db: State<Db>, log: ReviewRow) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO review(card_id,rating,ts,correct,phase,elapsed_ms) VALUES(?1,?2,?3,?4,?5,?6)",
        params![log.card_id, log.rating, log.ts, log.correct as i64, log.phase, log.elapsed_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn add_attempt(db: State<Db>, attempt: AttemptRow) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO attempt(lesson_id,exercise_id,kind,correct,ts,duration_ms,answer)
         VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![
            attempt.lesson_id,
            attempt.exercise_id,
            attempt.kind,
            attempt.correct as i64,
            attempt.ts,
            attempt.duration_ms,
            attempt.answer
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_daily_stats(db: State<Db>) -> Result<Vec<DailyStat>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::daily_stats(&conn)
}

#[tauri::command]
pub fn load_totals(db: State<Db>) -> Result<db::Totals, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::totals(&conn)
}

#[tauri::command]
pub fn load_kind_stats(db: State<Db>) -> Result<Vec<KindStat>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::kind_stats(&conn)
}

#[tauri::command]
pub fn load_notes(db: State<Db>) -> Result<Vec<NoteRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::notes(&conn)
}

#[tauri::command]
pub fn save_note(
    db: State<Db>,
    target_type: String,
    target_id: String,
    body: String,
    note_id: Option<i64>,
) -> Result<NoteRow, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = paths::now_ms();
    let id = match note_id {
        Some(id) => {
            conn.execute(
                "UPDATE note SET body=?1, updated_at=?2 WHERE id=?3",
                params![body, now, id],
            )
            .map_err(|e| e.to_string())?;
            id
        }
        None => {
            conn.execute(
                "INSERT INTO note(target_type,target_id,body,created_at,updated_at) VALUES(?1,?2,?3,?4,?5)",
                params![target_type, target_id, body, now, now],
            )
            .map_err(|e| e.to_string())?;
            conn.last_insert_rowid()
        }
    };
    Ok(NoteRow {
        id,
        target_type,
        target_id,
        body,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn delete_note(db: State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM note WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_bookmarks(db: State<Db>) -> Result<Vec<BookmarkRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::bookmarks(&conn)
}

#[tauri::command]
pub fn toggle_bookmark(
    db: State<Db>,
    target_type: String,
    target_id: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let existed: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bookmark WHERE target_type=?1 AND target_id=?2",
            params![target_type, target_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if existed > 0 {
        conn.execute(
            "DELETE FROM bookmark WHERE target_type=?1 AND target_id=?2",
            params![target_type, target_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        conn.execute(
            "INSERT INTO bookmark(target_type,target_id,created_at) VALUES(?1,?2,?3)",
            params![target_type, target_id, paths::now_ms()],
        )
        .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn backup_now() -> Result<String, String> {
    let path = db::backup("manual")?;
    db::prune_backups();
    Ok(path)
}

#[tauri::command]
pub fn export_data() -> Result<String, String> {
    let conn = rusqlite::Connection::open(paths::db_path()).map_err(|e| e.to_string())?;
    db::export_snapshot(&conn)
}

#[tauri::command]
pub fn import_data(json: String) -> Result<(), String> {
    let mut conn = rusqlite::Connection::open(paths::db_path()).map_err(|e| e.to_string())?;
    db::backup("pre-import")?;
    db::import_snapshot(&mut conn, &json)
}

#[tauri::command]
pub fn db_health() -> Result<String, String> {
    let conn = rusqlite::Connection::open(paths::db_path()).map_err(|e| e.to_string())?;
    Ok(if db::integrity_ok(&conn) { "ok".into() } else { "corrupt".into() })
}

#[tauri::command]
pub fn open_folder(which: String) -> Result<(), String> {
    let path = match which.as_str() {
        "data" => paths::data_dir(),
        "backups" => paths::backups_dir(),
        "logs" => paths::log_dir(),
        _ => paths::base_dir(),
    };
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let _ = path;
    }
    Ok(())
}

#[tauri::command]
pub fn read_course_file(name: String) -> Result<String, String> {
    // Course JSON shipped next to the executable can override the bundled copy.
    let candidate = paths::courses_dir().join(&name);
    if candidate.exists() {
        return std::fs::read_to_string(candidate).map_err(|e| e.to_string());
    }
    Err("not found".into())
}
