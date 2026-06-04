use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const KEY: &str = "settings";

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
        .unwrap_or_else(|_| std::path::PathBuf::from("Snippr"))
        .to_string_lossy()
        .into_owned()
}

pub fn load(app: &AppHandle) -> SnipprSettings {
    let mut s: SnipprSettings = app
        .store(STORE_FILE)
        .ok()
        .and_then(|store| store.get(KEY))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    if s.save_directory.is_empty() {
        s.save_directory = default_save_dir(app);
    }
    s
}

pub fn save(app: &AppHandle, s: &SnipprSettings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY, serde_json::to_value(s).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())
}
