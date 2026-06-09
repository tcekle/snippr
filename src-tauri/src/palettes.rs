//! Named beautify palettes, stored as individual JSON files in `palettes/` next
//! to the executable.
//!
//! WHY files (not a settings.json field): a palette is a named, shareable thing.
//! One file per palette lets the user name them, hand-edit them, and import /
//! export them by copying files. Each file holds
//! `{ "name": "<display>", "swatches": [{ label, fill }, ...] }`. The filename is
//! derived from the name (sanitized for the filesystem); the in-file `name` is the
//! authoritative display name, so characters the filename can't hold (e.g. '/')
//! survive a round-trip.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Palette {
    pub name: String,
    /// Opaque swatch list — the frontend owns the `{ label, fill }` shape.
    #[serde(default)]
    pub swatches: serde_json::Value,
}

// ── Paths ─────────────────────────────────────────────────────────────────────

/// `palettes/` beside the exe (fallback: app config dir). Created on demand.
fn palettes_dir(app: &AppHandle) -> PathBuf {
    let base = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .or_else(|| app.path().app_config_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("palettes")
}

/// Map a display name to a safe filename stem (Windows-illegal chars → '_', no
/// trailing dots/spaces). Deterministic, so a palette's file is found by name.
fn sanitize(name: &str) -> String {
    let mut s: String = name
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) || c.is_control() { '_' } else { c })
        .collect();
    s = s.trim().trim_end_matches('.').trim().to_string();
    if s.is_empty() {
        s.push_str("palette");
    }
    s
}

fn palette_file(app: &AppHandle, name: &str) -> PathBuf {
    palettes_dir(app).join(format!("{}.json", sanitize(name)))
}

// ── Commands ────────────────────────────────────────────────────────────────--

/// All palettes on disk, sorted by name (case-insensitive). Missing folder = none.
#[tauri::command]
pub fn list_palettes(app: AppHandle) -> Vec<Palette> {
    let Ok(entries) = std::fs::read_dir(palettes_dir(&app)) else {
        return Vec::new();
    };
    let mut out: Vec<Palette> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("json"))
        .filter_map(|path| {
            let txt = std::fs::read_to_string(&path).ok()?;
            let mut p: Palette = serde_json::from_str(&txt).ok()?;
            if p.name.trim().is_empty() {
                // Files lacking a name field fall back to the filename stem.
                p.name = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("palette")
                    .to_string();
            }
            Some(p)
        })
        .collect();
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

/// Write (upsert) a palette. The file is named from `palette.name`.
#[tauri::command]
pub fn save_palette(app: AppHandle, palette: Palette) -> Result<(), String> {
    let dir = palettes_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&palette).map_err(|e| e.to_string())?;
    std::fs::write(palette_file(&app, &palette.name), json).map_err(|e| e.to_string())
}

/// Delete a palette by name. No-op if the file is already gone.
#[tauri::command]
pub fn delete_palette(app: AppHandle, name: String) -> Result<(), String> {
    let file = palette_file(&app, &name);
    if file.exists() {
        std::fs::remove_file(file).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Copy an external palette file into `palettes/` and return it. Accepts either a
/// `{ name, swatches }` object or a bare swatch array (name taken from the file).
#[tauri::command]
pub fn import_palette(app: AppHandle, src_path: String) -> Result<Palette, String> {
    let txt = std::fs::read_to_string(&src_path)
        .map_err(|e| format!("Could not read {src_path}: {e}"))?;
    let palette = parse_palette(&txt, &src_path)?;
    save_palette(app, palette.clone())?;
    Ok(palette)
}

/// Copy a palette's file out to `dest_path`.
#[tauri::command]
pub fn export_palette(app: AppHandle, name: String, dest_path: String) -> Result<(), String> {
    std::fs::copy(palette_file(&app, &name), &dest_path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Parse imported text into a Palette, tolerating a bare swatch array.
fn parse_palette(txt: &str, src_path: &str) -> Result<Palette, String> {
    let val: serde_json::Value =
        serde_json::from_str(txt).map_err(|e| format!("Not valid JSON: {e}"))?;
    let stem = || {
        Path::new(src_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("imported")
            .to_string()
    };
    if val.is_array() {
        return Ok(Palette { name: stem(), swatches: val });
    }
    let mut p: Palette =
        serde_json::from_value(val).map_err(|e| format!("Not a palette file: {e}"))?;
    if p.name.trim().is_empty() {
        p.name = stem();
    }
    Ok(p)
}
