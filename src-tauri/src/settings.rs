//! Persistent app settings, stored as plain JSON next to the executable.
//!
//! WHY next-to-exe instead of the plugin-store app-config dir: a single
//! `settings.json` beside `snippr.exe` is portable (travels with the app) and
//! easy to hand-edit. The NSIS install is `currentUser` (`%LOCALAPPDATA%\snippr`),
//! so the exe directory is writable; a `generate`/`mcp` child is the same exe and
//! resolves the same file.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const FILE_NAME: &str = "settings.json";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct SnipprSettings {
    /// Absolute directory for auto-saved PNGs. Empty = resolved to Pictures\Snippr on load.
    pub save_directory: String,
    pub auto_save: bool,
    pub copy_to_clipboard: bool,
    /// false = only trigger on Snipping Tool clipboard writes; true = any new image.
    pub trigger_on_any_image: bool,
    pub autostart: bool,
}

impl Default for SnipprSettings {
    fn default() -> Self {
        Self {
            save_directory: String::new(),
            auto_save: true,
            copy_to_clipboard: true,
            trigger_on_any_image: false,
            autostart: false,
        }
    }
}

pub fn default_save_dir(app: &AppHandle) -> String {
    app.path()
        .picture_dir()
        .map(|p| p.join("Snippr"))
        .unwrap_or_else(|_| PathBuf::from("Snippr"))
        .to_string_lossy()
        .into_owned()
}

/// `settings.json` next to the executable. Falls back to the app config dir only
/// if the exe path can't be resolved (shouldn't happen in practice).
fn settings_path(app: &AppHandle) -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join(FILE_NAME);
        }
    }
    app.path()
        .app_config_dir()
        .map(|d| d.join(FILE_NAME))
        .unwrap_or_else(|_| PathBuf::from(FILE_NAME))
}

pub fn load(app: &AppHandle) -> SnipprSettings {
    let path = settings_path(app);
    let mut s: SnipprSettings = std::fs::read_to_string(&path)
        .ok()
        .and_then(|txt| serde_json::from_str(&txt).ok())
        // No file yet (or unreadable): try a one-time import from the old store.
        .or_else(|| migrate_from_store(app))
        .unwrap_or_default();
    if s.save_directory.is_empty() {
        s.save_directory = default_save_dir(app);
    }
    s
}

pub fn save(app: &AppHandle, s: &SnipprSettings) -> Result<(), String> {
    let path = settings_path(app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// Best-effort one-time import of pre-1.0 settings written by tauri-plugin-store
/// (keyed JSON under the app config/data dir). Returns `None` on any miss so the
/// caller falls back to defaults; never fails loudly. Runs until the next `save`
/// writes the new next-to-exe file.
fn migrate_from_store(app: &AppHandle) -> Option<SnipprSettings> {
    let resolver = app.path();
    let dirs = [resolver.app_config_dir().ok(), resolver.app_data_dir().ok()];
    for dir in dirs.into_iter().flatten() {
        let Ok(txt) = std::fs::read_to_string(dir.join(FILE_NAME)) else {
            continue;
        };
        let Ok(val) = serde_json::from_str::<serde_json::Value>(&txt) else {
            continue;
        };
        // The store wraps the payload under a "settings" key.
        if let Some(s) = val
            .get("settings")
            .and_then(|inner| serde_json::from_value::<SnipprSettings>(inner.clone()).ok())
        {
            return Some(s);
        }
    }
    None
}
