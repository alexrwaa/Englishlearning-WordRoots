use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

use crate::db::{self, AttemptRow, BookmarkRow, CardRow, DailyStat, KindStat, LessonStateRow, NoteRow, ReviewRow};
use crate::paths;

pub struct Db(pub Mutex<rusqlite::Connection>);

/// Set once the frontend has mounted and talked to us over IPC. The startup
/// watchdog in `main.rs` uses it to tell "app is loading" from "app is broken".
pub struct Ready(pub Arc<AtomicBool>);

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
    /// True when the harness asked the renderer to run its interaction self-test.
    selftest: bool,
    /// Which lesson the self-test drives (WORDROOTS_SELFTEST_LESSON). Lets the
    /// release gate prove that a C9/C11 lesson can be answered, not just day 1.
    selftest_lesson: String,
    /// Browser arguments actually handed to WebView2 (proxy isolation proof).
    webview_args: String,
    /// True when the binary still loads the dev server instead of bundled assets.
    dev_mode: bool,
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
        selftest: std::env::var("WORDROOTS_SELFTEST").map(|v| v == "1").unwrap_or(false),
        selftest_lesson: std::env::var("WORDROOTS_SELFTEST_LESSON").unwrap_or_else(|_| "w01d1".to_string()),
        webview_args: std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default(),
        dev_mode: tauri::is_dev(),
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

/// Read a course file that ships next to the executable.
///
/// `name` comes from the webview, so it must never be able to escape
/// `courses/`: reject absolute paths, parent segments and anything that is not a
/// `.json` file, then compare the canonicalised path against the canonicalised
/// root. Without this a malicious or buggy renderer could read arbitrary files on
/// disk through our IPC surface.
#[tauri::command]
pub fn read_course_file(name: String) -> Result<String, String> {
    let root = paths::courses_dir();
    let root = root.canonicalize().map_err(|e| format!("courses dir unavailable: {e}"))?;

    if name.trim().is_empty() || name.contains("..") || name.contains('\\') {
        return Err("invalid course file name".into());
    }
    if !name.ends_with(".json") {
        return Err("only .json course files can be read".into());
    }

    let candidate = root.join(&name);
    let resolved = candidate
        .canonicalize()
        .map_err(|_| format!("course file not found: {name}"))?;
    if !resolved.starts_with(&root) {
        return Err("path escapes the courses directory".into());
    }
    std::fs::read_to_string(&resolved).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoursePack {
    pub source: String,
    pub content_version: String,
    pub schema_version: i32,
    pub week_count: usize,
    pub day_count: usize,
    pub weeks: Vec<serde_json::Value>,
    pub lexicon: serde_json::Value,
    pub problems: Vec<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CourseManifest {
    #[serde(default)]
    content_version: String,
    #[serde(default)]
    schema_version: i32,
}

/// Load the course bundle that sits next to the executable.
///
/// The frontend keeps using its compiled-in copy unless this pack is complete and
/// version-compatible, so a partially copied folder can never leave the app with
/// missing lessons.
#[tauri::command]
pub fn load_course_pack() -> Result<CoursePack, String> {
    let root = paths::courses_dir();
    let mut problems: Vec<String> = Vec::new();

    let manifest: CourseManifest = match std::fs::read_to_string(root.join("manifest.json")) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_else(|e| {
            problems.push(format!("manifest.json 无法解析: {e}"));
            CourseManifest::default()
        }),
        Err(_) => {
            problems.push("courses/manifest.json 缺失".into());
            CourseManifest::default()
        }
    };

    let mut weeks = Vec::new();
    let mut day_count = 0usize;
    let weeks_dir = root.join("weeks");
    if let Ok(entries) = std::fs::read_dir(&weeks_dir) {
        let mut dirs: Vec<_> = entries.filter_map(|e| e.ok()).map(|e| e.path()).collect();
        dirs.sort();
        for week_dir in dirs {
            if !week_dir.is_dir() {
                continue;
            }
            let mut days: Vec<_> = match std::fs::read_dir(&week_dir) {
                Ok(rd) => rd
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| p.extension().map(|x| x == "json").unwrap_or(false))
                    // weekNN/meta.json is the week theme, not a lesson day.
                    .filter(|p| {
                        p.file_name()
                            .map(|n| n != std::ffi::OsStr::new("meta.json"))
                            .unwrap_or(true)
                    })
                    .collect(),
                Err(_) => continue,
            };
            days.sort();
            let mut parsed_days = Vec::new();
            for day in days {
                match std::fs::read_to_string(&day).and_then(|t| {
                    serde_json::from_str::<serde_json::Value>(&t).map_err(std::io::Error::other)
                }) {
                    Ok(v) => {
                        if v.get("cards").and_then(|c| c.as_array()).map(|a| a.is_empty()).unwrap_or(true) {
                            problems.push(format!(
                                "{} 没有卡片",
                                day.strip_prefix(&root).unwrap_or(day.as_path()).display()
                            ));
                        }
                        parsed_days.push(v);
                        day_count += 1;
                    }
                    Err(e) => problems.push(format!(
                        "{} 解析失败: {e}",
                        day.strip_prefix(&root).unwrap_or(day.as_path()).display()
                    )),
                }
            }
            if !parsed_days.is_empty() {
                let meta = std::fs::read_to_string(week_dir.join("meta.json"))
                    .ok()
                    .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
                    .unwrap_or(serde_json::Value::Null);
                weeks.push(serde_json::json!({ "meta": meta, "days": parsed_days }));
            }
        }
    } else {
        problems.push("courses/weeks 目录不存在".into());
    }

    let lex_dir = root.join("lexicon");
    let read_list = |name: &str| -> serde_json::Value {
        std::fs::read_to_string(lex_dir.join(name))
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or_else(|| serde_json::json!([]))
    };
    let lexicon = serde_json::json!({
        "morphemes": read_list("morphemes.json"),
        "words": read_list("words.json"),
        "concepts": read_list("concepts.json"),
    });

    Ok(CoursePack {
        source: if weeks.is_empty() { "none".into() } else { "external".into() },
        content_version: manifest.content_version,
        schema_version: manifest.schema_version,
        week_count: weeks.len(),
        day_count,
        weeks,
        lexicon,
        problems,
    })
}

#[tauri::command]
pub fn app_diagnostics() -> serde_json::Value {
    crate::diagnostics::snapshot()
}

/// Called once by the renderer after it has mounted. Proves the frontend really
/// rendered (the JS executed and IPC works), which is what the packaging smoke
/// test asserts — a database file alone would not prove that.
#[tauri::command]
pub fn frontend_ready(
    state: State<'_, Ready>,
    app: tauri::AppHandle,
    payload: serde_json::Value,
) -> Result<String, String> {
    state.0.store(true, Ordering::SeqCst);
    let dir = paths::log_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("frontend-ready.json");
    let body = serde_json::json!({
        "ready_at_ms": paths::now_ms(),
        "app_version": app.package_info().version.to_string(),
        "payload": payload,
    });
    std::fs::write(&path, serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    // The renderer also reports the result of its own interaction self-test when
    // the harness asks for it (WORDROOTS_SELFTEST=1). Written to a separate file
    // so the packaging check can assert real in-app interaction, not just paint.
    if payload.get("phase").and_then(|p| p.as_str()) == Some("selftest") {
        let test_path = dir.join("selftest.json");
        std::fs::write(
            &test_path,
            serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }

    paths::log_line(&format!(
        "frontend_ready: phase={} payload={}",
        payload.get("phase").and_then(|p| p.as_str()).unwrap_or("mounted"),
        payload
    ));
    Ok(path.to_string_lossy().to_string())
}
