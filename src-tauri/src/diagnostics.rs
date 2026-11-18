//! Startup diagnostics for the "app does not open behind a proxy / VPN" class of
//! failures.
//!
//! The app is fully offline: the UI is compiled into the executable and served
//! from the `tauri.localhost` custom protocol. The only way the window can show
//! a connection error is therefore *inside* WebView2 — most often because the
//! system proxy (Clash / v2ray / corporate PAC) intercepts the custom-protocol
//! request before WebView2 can route it to the in-process handler.
//!
//! We do two things here:
//! 1. Force the webview to use a direct connection (set as browser arguments in
//!    `tauri.conf.json`, which only affects this process).
//! 2. Record everything a support request needs — proxy environment variables,
//!    WinINET settings, WebView2 runtime version, user-data folder, asset
//!    integrity — into `app-data/logs/startup.json`, so a failed launch is
//!    diagnosable without asking the user to reproduce it.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::paths;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Run a command without flashing a console window on Windows.
fn quiet_command(program: &str, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Read one value from the WinINET proxy settings (`HKCU\...\Internet Settings`).
fn reg_value(name: &str) -> Option<String> {
    let out = quiet_command(
        "reg",
        &[
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v",
            name,
        ],
    )?;
    // Output is a table; the last whitespace-separated column is the value.
    out.lines()
        .find(|l| l.contains(name))
        .and_then(|l| l.split_whitespace().last().map(|s| s.to_string()))
}

fn webview2_version() -> Option<String> {
    for key in [
        r"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        r"HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    ] {
        if let Some(out) = quiet_command("reg", &["query", key, "/v", "pv"]) {
            if let Some(line) = out.lines().find(|l| l.contains("pv")) {
                if let Some(v) = line.split_whitespace().last() {
                    if !v.is_empty() {
                        return Some(v.to_string());
                    }
                }
            }
        }
    }
    None
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn env_or_empty(key: &str) -> String {
    std::env::var(key).unwrap_or_default()
}

/// Snapshot of everything that can make the webview fail to load its own assets.
pub fn snapshot() -> serde_json::Value {
    let base = paths::base_dir();
    let exe = std::env::current_exe().unwrap_or_default();

    let proxy_enabled = reg_value("ProxyEnable").unwrap_or_default();
    let proxy_server = reg_value("ProxyServer").unwrap_or_default();
    let proxy_override = reg_value("ProxyOverride").unwrap_or_default();
    let auto_config = reg_value("AutoConfigURL").unwrap_or_default();

    serde_json::json!({
        "generated_at_ms": now_ms(),
        "app_version": env!("CARGO_PKG_VERSION"),
        "portable": {
            "base_dir": base.display().to_string(),
            "exe": exe.display().to_string(),
            "data_dir_overridden": !env_or_empty("WORDROOTS_DATA_DIR").is_empty(),
            "webview2_user_data": env_or_empty("WEBVIEW2_USER_DATA_FOLDER"),
            "webview2_user_data_exists": Path::new(&env_or_empty("WEBVIEW2_USER_DATA_FOLDER")).exists(),
        },
        "webview2": {
            "runtime_version": webview2_version(),
            "additional_browser_args": env_or_empty("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"),
        },
        "proxy_env": {
            "HTTP_PROXY": env_or_empty("HTTP_PROXY"),
            "HTTPS_PROXY": env_or_empty("HTTPS_PROXY"),
            "ALL_PROXY": env_or_empty("ALL_PROXY"),
            "NO_PROXY": env_or_empty("NO_PROXY"),
            "http_proxy": env_or_empty("http_proxy"),
            "https_proxy": env_or_empty("https_proxy"),
        },
        "wininet": {
            "ProxyEnable": proxy_enabled,
            "ProxyServer": proxy_server,
            "ProxyOverride": proxy_override,
            "AutoConfigURL": auto_config,
        },
        "os": {
            "family": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
        },
    })
}

/// Persist the snapshot; returns the path so it can be shown in the UI.
pub fn write_snapshot(tag: &str) -> Option<std::path::PathBuf> {
    let dir = paths::log_dir();
    fs::create_dir_all(&dir).ok()?;
    let path = dir.join(format!("startup-{tag}.json"));
    let body = serde_json::to_string_pretty(&snapshot()).ok()?;
    fs::write(&path, body).ok()?;
    Some(path)
}

/// One-line summary for the human-readable log.
pub fn summary() -> String {
    let s = snapshot();
    let wininet = &s["wininet"];
    format!(
        "proxy env: HTTP_PROXY={:?} HTTPS_PROXY={:?} ALL_PROXY={:?} | wininet: ProxyEnable={:?} ProxyServer={:?} AutoConfigURL={:?} | webview2={:?}",
        s["proxy_env"]["HTTP_PROXY"].as_str().unwrap_or(""),
        s["proxy_env"]["HTTPS_PROXY"].as_str().unwrap_or(""),
        s["proxy_env"]["ALL_PROXY"].as_str().unwrap_or(""),
        wininet["ProxyEnable"].as_str().unwrap_or(""),
        wininet["ProxyServer"].as_str().unwrap_or(""),
        wininet["AutoConfigURL"].as_str().unwrap_or(""),
        s["webview2"]["runtime_version"].as_str().unwrap_or("unknown"),
    )
}

/// Message written next to the executable when the frontend never reported in.
pub const STARTUP_HELP: &str = "如果窗口一片空白或显示无法连接，请把 app-data/logs/ 整个目录发给开发者。\
程序已强制 WebView2 直连（不使用系统代理），正常情况下即使开启了 VPN / Clash / TUN 也能启动。";
