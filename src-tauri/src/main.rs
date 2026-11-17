#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod paths;

use std::sync::Mutex;

fn main() {
    paths::configure_webview_dir();
    if let Err(err) = paths::ensure_layout() {
        paths::log_line(&format!("failed to create data layout: {err}"));
    }
    paths::log_line("WordRoots starting");

    let connection = match db::open() {
        Ok(conn) => conn,
        Err(err) => {
            paths::log_line(&format!("database open failed: {err}; attempting recovery"));
            // Recovery: move the broken database aside and start a fresh one so
            // the app still opens; the user can restore a backup afterwards.
            let broken = paths::data_dir().join(format!("wordroots.corrupt-{}.db", paths::now_ms()));
            let _ = std::fs::rename(paths::db_path(), &broken);
            db::open().expect("database recovery failed")
        }
    };

    tauri::Builder::default()
        .manage(commands::Db(Mutex::new(connection)))
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::log_event,
            commands::load_settings,
            commands::save_settings,
            commands::load_lesson_states,
            commands::save_lesson_state,
            commands::load_cards,
            commands::save_card,
            commands::add_review,
            commands::add_attempt,
            commands::load_daily_stats,
            commands::load_totals,
            commands::load_kind_stats,
            commands::load_notes,
            commands::save_note,
            commands::delete_note,
            commands::load_bookmarks,
            commands::toggle_bookmark,
            commands::backup_now,
            commands::export_data,
            commands::import_data,
            commands::db_health,
            commands::open_folder,
            commands::read_course_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WordRoots");
}
