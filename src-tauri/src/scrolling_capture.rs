
//! Region selection overlay + single-region snapshot, and the GDI screen
//! capture shared with `screen_recording`.
//!
//! Flow: tray → begin_selection (creates overlay) → frontend draws selection
//! rect → capture_snapshot → snapshot-captured event (added to the current
//! document instead of a new tab).
//!
//! Scrolling capture used to live here and is withheld pending a licensing
//! review of its stitcher — see `git show 88e6db3:src-tauri/src/scrolling_capture.rs`
//! for the last version that had it. The overlay, the selection-mode tri-state
//! and the GDI helpers below are unrelated to that and stay.

use std::io::Cursor;
use std::sync::atomic::{AtomicU8, Ordering};
use std::thread;
use std::time::Duration;

use image::{DynamicImage, ImageFormat, RgbaImage};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;

use windows::Win32::Foundation::{HANDLE, HWND};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC,
    SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY, CAPTUREBLT,
};
use windows::Win32::UI::WindowsAndMessaging::{PeekMessageW, MSG, PM_REMOVE, WM_HOTKEY};

use crate::state::{AppState, PendingImage};

// ── Session constants ───────────────────────────────────────────────────────

/// Initial sleep before first capture, giving the overlay time to hide.
const START_DELAY_MS: u64 = 300;

/// Which flavour of selection the overlay is currently hosting. The overlay
/// frontend asks via `get_selection_mode` to decide its drag behaviour and the
/// command it fires once a region is drawn.
///
/// Still an integer rather than a bool: mode 0 was scrolling capture, and the
/// numbering is left alone so restoring it does not renumber the other two.
///   1 = single-region snapshot → `capture_snapshot`
///   2 = screen recording       → `start_recording`
static SELECTION_MODE: AtomicU8 = AtomicU8::new(MODE_SNAPSHOT);

pub(crate) const MODE_SNAPSHOT: u8 = 1;
pub(crate) const MODE_RECORDING: u8 = 2;

/// Set the active selection mode. Used by the `begin_*_selection` commands
/// (and the recording module) right before they open the overlay.
pub(crate) fn set_selection_mode(mode: u8) {
    SELECTION_MODE.store(mode, Ordering::Relaxed);
}

/// Read the active selection mode.
pub(crate) fn selection_mode() -> u8 {
    SELECTION_MODE.load(Ordering::Relaxed)
}

// ── Overlay window ──────────────────────────────────────────────────────────

/// Destroy every overlay window (one per monitor, labels `overlay-N`).
pub(crate) fn destroy_overlays(app: &AppHandle) {
    for (label, win) in app.webview_windows() {
        if label.starts_with("overlay") {
            let _ = win.destroy();
        }
    }
}

/// Hide every overlay window without destroying it (pre-capture).
fn hide_overlays(app: &AppHandle) {
    for (label, win) in app.webview_windows() {
        if label.starts_with("overlay") {
            let _ = win.hide();
        }
    }
}

/// Show a transparent overlay on EVERY monitor so the user can select a
/// region anywhere. One window per monitor keeps the pointer math correct
/// on mixed-DPI setups (each overlay uses its own scale factor).
pub fn begin_selection(app: &AppHandle) {
    // Hide the editor so the overlay has a clean canvas.
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }

    // Tear down any lingering overlays from a previous invocation.
    destroy_overlays(app);

    let monitors = app.available_monitors().unwrap_or_default();
    if monitors.is_empty() {
        log::error!("scrolling_capture: no monitors found");
        crate::show_main_window(app);
        return;
    }

    // Focus follows the cursor: Esc should land on the overlay under it.
    let cursor = app.cursor_position().ok();

    let mut created = 0;
    for (i, m) in monitors.iter().enumerate() {
        let (mon_x, mon_y, mon_w, mon_h) = (
            m.position().x,
            m.position().y,
            m.size().width,
            m.size().height,
        );

        // Build the overlay window; position/size are set physically after
        // creation to avoid DPI-scaling confusion in the builder (logical units).
        let win = WebviewWindowBuilder::new(
            app,
            format!("overlay-{i}"),
            WebviewUrl::App("index.html".into()),
        )
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .resizable(false)
        .visible(false)
        .focused(false)
        .build();

        let win = match win {
            Ok(w) => w,
            Err(e) => {
                log::error!("scrolling_capture: overlay-{i} build failed: {e}");
                continue;
            }
        };

        if let Err(e) = win.set_position(PhysicalPosition::new(mon_x, mon_y)) {
            log::error!("scrolling_capture: overlay-{i} set_position failed: {e}");
        }
        if let Err(e) = win.set_size(PhysicalSize::new(mon_w, mon_h)) {
            log::error!("scrolling_capture: overlay-{i} set_size failed: {e}");
        }
        if let Err(e) = win.show() {
            log::error!("scrolling_capture: overlay-{i} show failed: {e}");
        }
        created += 1;

        let under_cursor = cursor.is_some_and(|c| {
            c.x >= mon_x as f64
                && c.x < (mon_x + mon_w as i32) as f64
                && c.y >= mon_y as f64
                && c.y < (mon_y + mon_h as i32) as f64
        });
        if under_cursor || (i == 0 && cursor.is_none()) {
            let _ = win.set_focus();
        }
    }

    if created == 0 {
        log::error!("scrolling_capture: no overlay could be created");
        crate::show_main_window(app);
    }
}

// ── Commands ────────────────────────────────────────────────────────────────

/// "Add another screenshot": opens the region overlay, captures a single frame
/// and adds it to the current document.
///
/// async: on Windows, creating a webview window inside a *sync* command
/// deadlocks (build() blocks on the main thread, which is blocked on the
/// command's IPC response).
#[tauri::command]
pub async fn begin_snapshot_selection(app: AppHandle) {
    set_selection_mode(MODE_SNAPSHOT);
    begin_selection(&app);
}

/// The overlay asks which flavour of selection it is hosting.
#[tauri::command]
pub fn get_selection_mode() -> &'static str {
    match selection_mode() {
        MODE_RECORDING => "recording",
        _ => "snapshot",
    }
}

/// Cancel mid-selection: destroy all overlays, restore main window.
#[tauri::command]
pub async fn cancel_scrolling_selection(app: AppHandle) {
    destroy_overlays(&app);
    crate::show_main_window(&app);
}

/// Single-frame variant: capture the drawn region once and hand it to the
/// frontend as `snapshot-captured` (becomes an image layer / background).
#[tauri::command]
pub async fn capture_snapshot(app: AppHandle, x: i32, y: i32, width: u32, height: u32) {
    hide_overlays(&app);

    thread::Builder::new()
        .name("snippr-snapshot".into())
        .spawn(move || snapshot_session(app, x, y, width, height))
        .expect("failed to spawn snapshot thread");
}

fn snapshot_session(app: AppHandle, x: i32, y: i32, width: u32, height: u32) {
    // Let the overlay finish hiding before capturing.
    thread::sleep(Duration::from_millis(START_DELAY_MS));

    let img = unsafe { capture_screen_rect(x, y, width, height) };

    destroy_overlays(&app);

    match img {
        Some(img) => store_and_emit(app, img, "snapshot-captured"),
        None => {
            log::error!("snapshot: capture_screen_rect failed");
            let _ = app.emit_to(
                "main",
                "scroll-capture-error",
                serde_json::json!({"message": "Screen capture failed"}),
            );
            crate::show_main_window(&app);
        }
    }
}

// ── GDI screen capture helper ───────────────────────────────────────────────

/// Capture a rectangle of the screen (physical coords) into a raw, top-down
/// 32bpp **BGRA** byte buffer (the native GDI pixel order — no channel swap).
/// All GDI resources are cleaned up before returning.
///
/// Returns `w*h*4` bytes on success. This is the shared core behind both
/// `capture_screen_rect` (which swaps to RGBA for `image`/PNG) and
/// `capture_screen_rect_bgra_cursor` (which hands the bytes straight to Media
/// Foundation, whose RGB32 input format *is* BGRA — so no swap is wasted).
///
/// We pass zero-value handle sentinels rather than Option<HDC> because in a
/// mixed windows@0.58/0.61 dependency graph the Param<HDC> trait impl for
/// Option conflicts between the two windows_core versions.
unsafe fn capture_screen_rect_raw(
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    with_cursor: bool,
) -> Option<Vec<u8>> {
    let w_i = w as i32;
    let h_i = h as i32;

    // NULL hwnd → GetDC returns the screen DC.
    let screen_dc = GetDC(HWND::default());
    if screen_dc.is_invalid() {
        return None;
    }

    // NULL hdc for CreateCompatibleDC → mono DC; we need a colour DC so we
    // pass the actual screen_dc.
    let mem_dc = CreateCompatibleDC(screen_dc);
    if mem_dc.is_invalid() {
        ReleaseDC(HWND::default(), screen_dc);
        return None;
    }

    // Top-down DIB: negative biHeight means row 0 is at the top (matches RgbaImage).
    let bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w_i,
            biHeight: -h_i, // negative → top-down
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };

    let mut bits_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
    // NULL hsection → the OS allocates the backing store.
    let hbm = CreateDIBSection(mem_dc, &bmi, DIB_RGB_COLORS, &mut bits_ptr, HANDLE::default(), 0);
    let hbm = match hbm {
        Ok(h) if !h.is_invalid() => h,
        _ => {
            let _ = DeleteDC(mem_dc);
            ReleaseDC(HWND::default(), screen_dc);
            return None;
        }
    };

    let old_obj = SelectObject(mem_dc, hbm);

    let blt_ok = BitBlt(
        mem_dc,
        0, 0,
        w_i, h_i,
        screen_dc,
        x, y,
        SRCCOPY | CAPTUREBLT,
    );

    // GDI BitBlt never includes the pointer; for video we draw it on top of the
    // freshly-blitted frame, in the DC's coordinate space (origin = region x/y).
    if blt_ok.is_ok() && with_cursor {
        crate::cursor::draw_cursor_into_dc(mem_dc, x, y);
    }

    let bytes = if blt_ok.is_ok() {
        // bits_ptr is a 32bpp BGRA buffer, top-down.
        let byte_count = (w * h * 4) as usize;
        let bgra = std::slice::from_raw_parts(bits_ptr as *const u8, byte_count);
        Some(bgra.to_vec())
    } else {
        None
    };

    // Cleanup — order matters: deselect before deleting.
    SelectObject(mem_dc, old_obj);
    let _ = DeleteObject(hbm);
    let _ = DeleteDC(mem_dc);
    ReleaseDC(HWND::default(), screen_dc);

    bytes
}

/// Capture a rectangle of the screen (physical coords) into an `RgbaImage`,
/// converting GDI's native BGRA to the RGBA order `image` expects.
unsafe fn capture_screen_rect(x: i32, y: i32, w: u32, h: u32) -> Option<RgbaImage> {
    let mut buf = capture_screen_rect_raw(x, y, w, h, false)?;
    // Convert BGRA → RGBA in place.
    for chunk in buf.chunks_exact_mut(4) {
        chunk.swap(0, 2); // B↔R
    }
    RgbaImage::from_raw(w, h, buf)
}

/// Capture a rectangle of the screen (physical coords) into a raw, top-down
/// 32bpp BGRA buffer for the video encoder, with the live mouse cursor
/// composited on — recordings should show the pointer, where snapshot and
/// scrolling capture deliberately don't.
///
/// No channel swap: MF's RGB32 input format *is* BGRA, so handing GDI's native
/// order straight over is both cheaper and the orientation the SinkWriter wants.
pub(crate) unsafe fn capture_screen_rect_bgra_cursor(
    x: i32,
    y: i32,
    w: u32,
    h: u32,
) -> Option<Vec<u8>> {
    capture_screen_rect_raw(x, y, w, h, true)
}

/// Drain any pending WM_HOTKEY messages for `id` from the thread queue.
/// Returns true if Esc was detected.
pub(crate) fn check_hotkey(id: i32) -> bool {
    let mut msg = MSG::default();
    unsafe {
        while PeekMessageW(&mut msg, HWND::default(), WM_HOTKEY, WM_HOTKEY, PM_REMOVE).as_bool() {
            if msg.wParam.0 as i32 == id {
                return true;
            }
        }
    }
    false
}

/// Encode the image as PNG, store in pending slot, emit `event`, show main window.
/// Mirrors the tail of `clipboard_watcher::capture_pending` exactly.
fn store_and_emit(app: AppHandle, img: RgbaImage, event: &str) {
    let width = img.width();
    let height = img.height();

    let mut buf = Cursor::new(Vec::new());
    if let Err(e) = DynamicImage::ImageRgba8(img).write_to(&mut buf, ImageFormat::Png) {
        log::error!("scroll capture: PNG encode failed: {e}");
        let _ = app.emit_to(
            "main",
            "scroll-capture-error",
            serde_json::json!({"message": format!("PNG encode failed: {e}")}),
        );
        crate::show_main_window(&app);
        return;
    }
    let png = buf.into_inner();

    {
        let state = app.state::<AppState>();
        let mut slot = state.pending.lock().unwrap();
        *slot = Some(PendingImage { png, width, height });
    }

    let _ = app.emit_to(
        "main",
        event,
        serde_json::json!({"width": width, "height": height}),
    );
    crate::show_main_window(&app);
}

