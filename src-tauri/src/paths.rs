use std::fs;
use std::io::Write;
use std::path::PathBuf;

/// Resolve the folder that owns all portable state.
///
/// Order of precedence:
/// 1. `WORDROOTS_DATA_DIR` (explicit override, used by tests and by the CI
///    portable-layout check).
/// 2. The directory that contains the executable — this is what makes the app
///    portable: copy the folder, keep the data.
pub fn base_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("WORDROOTS_DATA_DIR") {
        if !dir.trim().is_empty() {
            return PathBuf::from(dir);
        }
    }
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn data_dir() -> PathBuf {
    base_dir().join("data")
}

pub fn db_path() -> PathBuf {
    data_dir().join("wordroots.db")
}

pub fn courses_dir() -> PathBuf {
    base_dir().join("courses")
}

pub fn app_data_dir() -> PathBuf {
    base_dir().join("app-data")
}

pub fn cache_dir() -> PathBuf {
    app_data_dir().join("cache")
}

pub fn config_dir() -> PathBuf {
    app_data_dir().join("config")
}

pub fn log_dir() -> PathBuf {
    app_data_dir().join("logs")
}

pub fn backups_dir() -> PathBuf {
    base_dir().join("backups")
}

pub fn ensure_layout() -> std::io::Result<()> {
    for dir in [
        data_dir(),
        courses_dir(),
        cache_dir(),
        config_dir(),
        log_dir(),
        backups_dir(),
    ] {
        fs::create_dir_all(dir)?;
    }
    Ok(())
}

/// Point the WebView2 runtime at a folder inside the app directory so browser
/// profile data travels with the portable folder instead of landing in
/// `%LOCALAPPDATA%`. Must run before the webview is created.
pub fn configure_webview_dir() {
    let dir = cache_dir().join("webview2");
    if fs::create_dir_all(&dir).is_ok() {
        // Safety: called single-threaded at process start, before any webview.
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dir);
    }
}

pub fn log_line(message: &str) {
    let _ = fs::create_dir_all(log_dir());
    let path = log_dir().join("wordroots.log");
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let _ = writeln!(file, "[{ts}] {message}");
    }
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
