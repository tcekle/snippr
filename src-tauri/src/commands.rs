
//! Tauri IPC commands exposed to the frontend.

use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::{export, settings, state::AppState};

/// Return the pending PNG bytes as a raw binary IPC response (zero-copy).
#[tauri::command]
pub fn get_pending_image(state: tauri::State<'_, AppState>) -> tauri::ipc::Response {
    let bytes = state
        .pending
        .lock()
        .unwrap()
        .take()
        .map(|p| p.png)
        .unwrap_or_default();
    tauri::ipc::Response::new(bytes)
}

/// Accept the annotated PNG (raw body), write clipboard / save file per settings,
/// then hide the editor window.  Returns the saved file path if auto-save is on.
#[tauri::command]
pub fn export_annotated(
    app: AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<Option<String>, String> {
    let tauri::ipc::InvokeBody::Raw(png) = request.body() else {
        return Err("expected raw PNG body".into());
    };

    let s = settings::load(&app);
    let mut saved_path = None;

    if s.copy_to_clipboard {
        export::write_clipboard_png(&app, png)?;
    }
    if s.auto_save {
        saved_path = Some(
            export::save_png_file(&app, png)?
                .to_string_lossy()
                .into_owned(),
        );
    }

    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }

    Ok(saved_path)
}

/// Return the current settings to the frontend.
#[tauri::command]
pub fn get_settings(app: AppHandle) -> crate::settings::SnipprSettings {
    settings::load(&app)
}

/// Persist updated settings.  Handles autostart enable/disable transitions.
#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    settings: crate::settings::SnipprSettings,
) -> Result<(), String> {
    let old = crate::settings::load(&app);

    // Only touch the autolaunch registration when the value actually changes.
    if settings.autostart != old.autostart {
        let autolaunch = app.autolaunch();
        if settings.autostart {
            autolaunch.enable().map_err(|e| e.to_string())?;
        } else {
            autolaunch.disable().map_err(|e| e.to_string())?;
        }
    }

    crate::settings::save(&app, &settings)
}

/// Open the save folder in Explorer (creates it if absent).
#[tauri::command]
pub fn open_save_folder(app: AppHandle) -> Result<(), String> {
    let dir = settings::load(&app).save_directory;
    let dir = std::path::PathBuf::from(&dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    tauri_plugin_opener::open_path(dir, None::<&str>).map_err(|e| e.to_string())
}

/// Hide the main window (called by the frontend close/cancel button).
#[tauri::command]
pub fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
}
