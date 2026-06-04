
//! Tauri IPC commands exposed to the frontend.

use tauri::{AppHandle, Emitter, Manager};
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

/// Copy the annotated PNG (raw body) to the clipboard. Window stays open.
#[tauri::command]
pub fn copy_annotated(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(png) = request.body() else {
        return Err("expected raw PNG body".into());
    };
    export::write_clipboard_png(&app, png)
}

/// Save the annotated PNG (raw body). The `save-path` header (percent-encoded,
/// from the frontend save dialog) picks the destination; without it the file
/// goes to the configured save directory with a timestamped name.
#[tauri::command]
pub fn save_annotated(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(png) = request.body() else {
        return Err("expected raw PNG body".into());
    };

    let explicit = request
        .headers()
        .get("save-path")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode);

    let saved = match explicit {
        Some(p) if !p.is_empty() => export::save_png_to(std::path::Path::new(&p), png)?,
        _ => export::save_png_file(&app, png)?,
    };
    Ok(saved.to_string_lossy().into_owned())
}

/// Minimal percent-decoder for header-safe UTF-8 paths (encodeURIComponent on the JS side).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let decoded = (bytes[i] == b'%')
            .then(|| {
                let h = (*bytes.get(i + 1)? as char).to_digit(16)?;
                let l = (*bytes.get(i + 2)? as char).to_digit(16)?;
                Some((h * 16 + l) as u8)
            })
            .flatten();
        match decoded {
            Some(b) => {
                out.push(b);
                i += 3;
            }
            None => {
                out.push(bytes[i]);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
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

/// Open an image file (drag-and-drop) as a new editor tab: decode to verify
/// it's an image, then feed the standard pending-image flow.
#[tauri::command]
pub fn load_image_file(app: AppHandle, path: String) -> Result<(), String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Could not read {path}: {e}"))?;
    let img = image::load_from_memory(&bytes).map_err(|e| format!("Not a supported image: {e}"))?;
    let (width, height) = (img.width(), img.height());

    // PNG passes through untouched; everything else is re-encoded so the
    // frontend only ever sees PNG.
    let png = if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        bytes
    } else {
        let mut buf = std::io::Cursor::new(Vec::new());
        img.write_to(&mut buf, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        buf.into_inner()
    };

    {
        let state = app.state::<AppState>();
        *state.pending.lock().unwrap() = Some(crate::state::PendingImage { png, width, height });
    }
    app.emit_to(
        "main",
        "snip-captured",
        serde_json::json!({"width": width, "height": height}),
    )
    .map_err(|e| e.to_string())
}
