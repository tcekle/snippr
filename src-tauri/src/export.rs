
//! Clipboard write and file-save helpers for annotated PNGs.

use std::path::PathBuf;
use std::sync::atomic::Ordering::SeqCst;

use arboard::ImageData;
use image::ImageFormat;
use tauri::{AppHandle, Manager};

use crate::settings;
use crate::state::AppState;

/// Write a PNG byte-slice to the system clipboard.
/// Sets `ignore_next` before writing so the clipboard watcher doesn't re-trigger.
pub fn write_clipboard_png(app: &AppHandle, png: &[u8]) -> Result<(), String> {
    let img = image::load_from_memory_with_format(png, ImageFormat::Png)
        .map_err(|e| format!("PNG decode failed: {e}"))?
        .to_rgba8();

    let width = img.width() as usize;
    let height = img.height() as usize;
    let raw: Vec<u8> = img.into_raw();

    // Set the feedback-loop guard BEFORE we touch the clipboard.
    let state = app.state::<AppState>();
    state.ignore_next.store(true, SeqCst);

    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let result = cb.set_image(ImageData {
        width,
        height,
        bytes: raw.into(),
    });

    if let Err(e) = result {
        // Reset the guard — our write failed, so the next update isn't ours.
        state.ignore_next.store(false, SeqCst);
        return Err(format!("clipboard write failed: {e}"));
    }

    Ok(())
}

/// Save a PNG byte-slice to `<save_directory>/snippr_YYYYMMDD_HHMMSS.png`.
/// Returns the full path of the written file.
pub fn save_png_file(app: &AppHandle, png: &[u8]) -> Result<PathBuf, String> {
    let dir = settings::load(app).save_directory;
    let dir = PathBuf::from(&dir);

    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("create_dir_all({dir:?}): {e}"))?;

    let ts = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let mut path = dir.join(format!("snippr_{ts}.png"));

    if path.exists() {
        let millis = chrono::Local::now().format("%3f").to_string();
        path = dir.join(format!("snippr_{ts}_{millis}.png"));
    }

    std::fs::write(&path, png).map_err(|e| format!("write {path:?}: {e}"))?;
    Ok(path)
}
