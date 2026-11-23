#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod diagnostics;
mod paths;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::Manager;

/// Browser arguments that make the app immune to system-wide proxies.
///
/// The UI is served from the `tauri.localhost` custom protocol inside this
/// process, so the app never needs a network connection. A system proxy (Clash,
/// v2ray, corporate PAC) can still capture the initial navigation before
/// WebView2 routes it to the in-process handler — that is exactly the "cannot
/// connect to localhost" screen. `--proxy-server=direct://` forces this webview
/// to bypass every proxy configuration; it is scoped to this process and never
/// touches system settings.
///
/// `--disable-features=...` mirrors the defaults wry sets, because specifying
/// additional arguments replaces them.
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
     --proxy-server=direct:// --proxy-bypass-list=* --disable-gpu --enable-logging";

fn main() {
    // Support mode: collect environment info without opening a window.
    if std::env::args().any(|a| a == "--diagnose") {
        let _ = paths::ensure_layout();
        let path = diagnostics::write_snapshot("cli");
        let summary = diagnostics::summary();
        paths::log_line(&format!("diagnose: {summary}"));
        if let Some(p) = path {
            paths::log_line(&format!("diagnose written to {}", p.display()));
        }
        return;
    }

    // Must run before any webview exists: keeps WebView2's profile inside the
    // portable folder and guarantees the browser arguments reach the loader even
    // if a future refactor stops passing them through the config file.
    paths::configure_webview_dir();
    if std::env::var_os("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_none() {
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", BROWSER_ARGS);
    }

    install_panic_logger();

    if let Err(err) = paths::ensure_layout() {
        paths::log_line(&format!("failed to create data layout: {err}"));
    }
    paths::log_line(&format!("WordRoots {} starting", env!("CARGO_PKG_VERSION")));
    paths::log_line(&format!("startup: {}", diagnostics::summary()));

    // A release binary that still points at the dev server is the exact bug that
    // shipped in 0.1.0. Say it in one unmistakable line instead of letting the
    // window show a browser error page.
    if tauri::is_dev() {
        paths::log_line(
            "FATAL: this build runs in dev mode (missing `custom-protocol` feature); \
             the window will try to load the Vite dev server instead of bundled assets",
        );
    }
    diagnostics::write_snapshot("boot");

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

    let ready = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .manage(commands::Db(Mutex::new(connection)))
        .manage(commands::Ready(ready.clone()))
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::app_diagnostics,
            commands::frontend_ready,
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
            commands::load_attempts,
            commands::toggle_bookmark,
            commands::assessment_list,
            commands::assessment_save,
            commands::assessment_clear,
            commands::assessment_count,
            commands::inquiry_progress_list,
            commands::inquiry_progress_save,
            commands::inquiry_progress_count,
            commands::backup_now,
            commands::export_data,
            commands::import_data,
            commands::db_health,
            commands::open_folder,
            commands::read_course_file,
            commands::load_course_pack,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let flag = ready.clone();
            std::thread::spawn(move || watch_startup(handle, flag));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running WordRoots");
}

/// If the frontend never reports in, the window is showing the webview's own
/// error page. Make that visible (window title) and diagnosable (log + snapshot)
/// instead of leaving the user with a silent blank window.
fn watch_startup(app: tauri::AppHandle, ready: Arc<AtomicBool>) {
    // Probe what the webview actually holds. Without this a blank window is
    // indistinguishable from a broken proxy: both only produce "no report".
    std::thread::sleep(Duration::from_millis(4000));
    if !ready.load(Ordering::SeqCst) {
        if let Some(window) = app.get_webview_window("main") {
            let probe = "document.title = 'WR|' + document.readyState + '|' \
                 + document.querySelectorAll('*').length + '|' \
                 + (window.__TAURI_INTERNALS__ ? 'tauri' : 'no-tauri') + '|' \
                 + (document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1)";
            match window.eval(probe) {
                Ok(_) => {
                    std::thread::sleep(Duration::from_millis(400));
                    paths::log_line(&format!(
                        "probe: url={:?} title={:?}",
                        window.url().map(|u| u.to_string()),
                        window.title()
                    ));
                }
                Err(err) => paths::log_line(&format!("probe: eval failed: {err}")),
            }
        }
    }

    for _ in 0..24 {
        if ready.load(Ordering::SeqCst) {
            paths::log_line("frontend reported ready");
            return;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    if ready.load(Ordering::SeqCst) {
        return;
    }

    paths::log_line("startup: frontend did not report ready within 12s");
    if let Some(p) = diagnostics::write_snapshot("startup-failed") {
        paths::log_line(&format!("startup: diagnostics written to {}", p.display()));
    }
    paths::log_line(&format!("startup: {}", diagnostics::STARTUP_HELP));
    let _ = std::fs::write(
        paths::log_dir().join("STARTUP-FAILED.txt"),
        format!(
            "WordRoots 启动失败：前端未能在 12 秒内加载。\n\n{}\n\n诊断文件：app-data/logs/startup-failed.json\n",
            diagnostics::STARTUP_HELP
        ),
    );

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title("WordRoots · 启动异常（请查看 app-data/logs）");
        // One retry: navigating again is cheap and recovers from a race where the
        // proxy or the webview runtime was still initialising at first paint.
        let _ = window.eval("location.reload()");
    }
}

fn install_panic_logger() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        paths::log_line(&format!("panic: {info}"));
        let _ = std::fs::write(paths::log_dir().join("LAST-CRASH.txt"), format!("{info}\n"));
        default_hook(info);
    }));
}
