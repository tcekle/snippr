
//! Scrolling screenshot capture + single-region snapshot.
//!
//! Flow: tray → begin_selection (creates overlay) → frontend draws selection rect
//! → start_scrolling_capture (spawns capture thread) → snip-captured event.
//! Snapshot mode reuses the same overlay but takes one frame and emits
//! snapshot-captured (added to the current document instead of a new tab).

use std::io::Cursor;
use std::sync::atomic::{AtomicU8, Ordering};
use std::thread;
use std::time::Duration;

use image::{DynamicImage, ImageFormat, RgbaImage};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;

use windows::Win32::Foundation::{HANDLE, HWND, POINT};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC,
    SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY, CAPTUREBLT,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, SendInput, UnregisterHotKey, INPUT, INPUT_MOUSE, INPUT_0, MOUSEINPUT,
    MOUSEEVENTF_WHEEL, MOD_NOREPEAT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetAncestor, PeekMessageW, SetCursorPos, SetForegroundWindow,
    WindowFromPoint, GA_ROOT, MSG, PM_REMOVE, WM_HOTKEY,
};

use crate::state::{AppState, PendingImage};

// ── Session constants ───────────────────────────────────────────────────────

/// Milliseconds to wait between scroll pulses (lets the page settle).
const SCROLL_DELAY_MS: u64 = 300;

/// Number of 120-unit wheel ticks to send per scroll step.
const WHEEL_TICKS_PER_STEP: i32 = 2;

/// Hard cap on captured frames (safety valve against infinite pages).
const MAX_FRAMES: usize = 300;

/// Maximum output image height in pixels (Konva/canvas texture limit).
const MAX_OUTPUT_HEIGHT: u32 = 16_000;

/// Initial sleep before first capture, giving the overlay time to hide.
const START_DELAY_MS: u64 = 300;

/// Which flavour of selection the overlay is currently hosting. The overlay
/// frontend asks via `get_selection_mode` to decide its drag behaviour and the
/// command it fires once a region is drawn.
///
/// Tri-state rather than a bool because recording (added in milestone 1) is a
/// third, distinct flow that reuses the very same overlay windows:
///   0 = scrolling capture   → `start_scrolling_capture`
///   1 = single-region snapshot → `capture_snapshot`
///   2 = screen recording     → `start_recording`
static SELECTION_MODE: AtomicU8 = AtomicU8::new(0);

pub(crate) const MODE_SCROLLING: u8 = 0;
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

/// Called from the frontend "start select" button / shortcut.
/// async: on Windows, creating a webview window inside a *sync* command
/// deadlocks (build() blocks on the main thread, which is blocked on the
/// command's IPC response).
#[tauri::command]
pub async fn begin_scrolling_selection(app: AppHandle) {
    set_selection_mode(MODE_SCROLLING);
    begin_selection(&app);
}

/// "Add another screenshot": same overlay, but a single frame is captured and
/// added to the current document.
#[tauri::command]
pub async fn begin_snapshot_selection(app: AppHandle) {
    set_selection_mode(MODE_SNAPSHOT);
    begin_selection(&app);
}

/// The overlay asks which flavour of selection it is hosting.
#[tauri::command]
pub fn get_selection_mode() -> &'static str {
    match selection_mode() {
        MODE_SNAPSHOT => "snapshot",
        MODE_RECORDING => "recording",
        _ => "scrolling",
    }
}

/// Cancel mid-selection: destroy all overlays, restore main window.
#[tauri::command]
pub async fn cancel_scrolling_selection(app: AppHandle) {
    destroy_overlays(&app);
    crate::show_main_window(&app);
}

/// The frontend calls this once the user has drawn their region.
/// `x/y/width/height` are physical screen coordinates.
/// Returns immediately; a background thread performs the actual capture.
#[tauri::command]
pub async fn start_scrolling_capture(app: AppHandle, x: i32, y: i32, width: u32, height: u32) {
    // Hide (not destroy) so the captured region doesn't show the overlay chrome.
    hide_overlays(&app);

    thread::Builder::new()
        .name("snippr-scroll-capture".into())
        .spawn(move || capture_session(app, x, y, width, height))
        .expect("failed to spawn scroll capture thread");
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
/// `capture_screen_rect_bgra` (which hands the bytes straight to Media
/// Foundation, whose RGB32 input format *is* BGRA — so no swap is wasted).
///
/// We pass zero-value handle sentinels rather than Option<HDC> because in a
/// mixed windows@0.58/0.61 dependency graph the Param<HDC> trait impl for
/// Option conflicts between the two windows_core versions.
unsafe fn capture_screen_rect_raw(x: i32, y: i32, w: u32, h: u32) -> Option<Vec<u8>> {
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
    let mut buf = capture_screen_rect_raw(x, y, w, h)?;
    // Convert BGRA → RGBA in place.
    for chunk in buf.chunks_exact_mut(4) {
        chunk.swap(0, 2); // B↔R
    }
    RgbaImage::from_raw(w, h, buf)
}

/// Capture a rectangle of the screen (physical coords) into a raw, top-down
/// 32bpp BGRA buffer for the video encoder. No channel swap (MF RGB32 == BGRA),
/// which is both cheaper and the orientation/order the SinkWriter wants.
pub(crate) unsafe fn capture_screen_rect_bgra(x: i32, y: i32, w: u32, h: u32) -> Option<Vec<u8>> {
    capture_screen_rect_raw(x, y, w, h)
}

// ── Stitch algorithm (ported from ShareX CombineImages) ─────────────────────

/// Per-session best-match state, threaded through the stitch calls.
struct StitchState {
    best_match_count: usize,
    best_match_index: usize,
    best_ignore_bottom: usize,
}

/// Stitch `current` onto the bottom of `result`.
///
/// Algorithm mirrors ShareX CombineImages:
///   - Side margins (ignored for row comparison): clamp(max(50, w/20), _, w/3)
///   - Auto bottom-edge ignore: grow from initial guess while the last rows
///     of result and current are identical, capped at h/3.
///   - Row-wise search: walk `currentImageY` from bottom upward looking for
///     the longest run of identical rows; limit at h/2 (matchLimit).
///   - Best-match fallback: if current search yields 0 matches but a prior
///     frame found matches, reuse those values (partial status).
///
/// Returns Some(new_image) on success, None if no overlap found at all.
fn stitch(
    result: &RgbaImage,
    current: &RgbaImage,
    state: &mut StitchState,
) -> Option<RgbaImage> {
    let rw = result.width() as usize;
    let rh = result.height() as usize;
    let cw = current.width() as usize;
    let ch = current.height() as usize;

    // Side margin to exclude scrollbar / border artifacts.
    let ignore_side = (50_usize).max(cw / 20).min(cw / 3);
    let stride = cw * 4; // 4 bytes per pixel (RGBA)
    let result_stride = rw * 4;
    let compare_start = ignore_side * 4;
    // Strip both sides: each side is `ignore_side` pixels × 4 bytes.
    if stride < ignore_side * 4 * 2 {
        return None;
    }
    let compare_len = stride - ignore_side * 4 * 2;
    if compare_len == 0 {
        return None;
    }

    let result_buf = result.as_raw();
    let current_buf = current.as_raw();

    // Auto bottom-edge ignore: detect sticky footers/nav bars by comparing
    // the trailing rows of result and current while they match.
    let ignore_bottom_max = ch / 3;
    let mut ignore_bottom = (50_usize).max(ch / 10);

    // Walk from the last row upward; extend the ignored tail while rows match.
    for i in 0..=ignore_bottom_max {
        if rh < 1 + i || ch < 1 + i {
            break;
        }
        let r_row = rh - 1 - i;
        let c_row = ch - 1 - i;
        let r_off = r_row * result_stride + compare_start;
        let c_off = c_row * stride + compare_start;
        if r_off + compare_len > result_buf.len() || c_off + compare_len > current_buf.len() {
            break;
        }
        if result_buf[r_off..r_off + compare_len] != current_buf[c_off..c_off + compare_len] {
            ignore_bottom += i;
            break;
        }
    }
    // Grow monotonically across frames; cap.
    ignore_bottom = ignore_bottom.max(state.best_ignore_bottom).min(ignore_bottom_max);

    // The "active" bottom of result (rows below this index are the ignored footer).
    // rect_bottom is the exclusive row index; searching goes from rect_bottom-1 downward.
    let rect_bottom = if rh > ignore_bottom { rh - ignore_bottom } else { return None; };

    let match_limit = ch / 2;
    let mut match_count = 0usize;
    let mut match_index = 0usize; // currentImageY at best match

    // Search: for each candidate anchor row in current (bottom→top), try to
    // extend a matching run upward from rect_bottom-1 in result.
    'outer: for current_y in (0..ch).rev() {
        if match_count >= match_limit {
            break;
        }
        let mut current_match = 0usize;

        for y in 0.. {
            if current_y < y || rect_bottom < 1 + y {
                break;
            }
            let r_row = rect_bottom - 1 - y;
            let c_row = current_y - y;
            let r_off = r_row * result_stride + compare_start;
            let c_off = c_row * stride + compare_start;
            if r_off + compare_len > result_buf.len() || c_off + compare_len > current_buf.len() {
                break;
            }
            if result_buf[r_off..r_off + compare_len] == current_buf[c_off..c_off + compare_len] {
                current_match += 1;
                if current_match >= match_limit {
                    break;
                }
            } else {
                break;
            }
        }

        if current_match > match_count {
            match_count = current_match;
            match_index = current_y;
            if match_count >= match_limit {
                break 'outer;
            }
        }
    }

    // Best-match fallback: if we got nothing this frame, use the best from history.
    let best_guess = if match_count == 0 && state.best_match_count > 0 {
        match_count = state.best_match_count;
        match_index = state.best_match_index;
        ignore_bottom = state.best_ignore_bottom;
        true
    } else {
        false
    };

    if match_count == 0 {
        return None;
    }

    // Rows of `current` that are new content (below the matched overlap).
    let match_height = ch - match_index - 1;
    if match_height == 0 {
        // No new rows to append — treat as scroll-bottom.
        return None;
    }

    // Update best-match state for future frames (monotonically increasing).
    if !best_guess && match_count > state.best_match_count {
        state.best_match_count = match_count;
        state.best_match_index = match_index;
        state.best_ignore_bottom = ignore_bottom;
    }

    // Compose: result[0..rh-ignore_bottom] ++ current[match_index+1..]
    let keep_rows = rh - ignore_bottom;
    let new_h = (keep_rows + match_height) as u32;
    let new_w = result.width();
    let mut new_img = RgbaImage::new(new_w, new_h);

    let dst_buf = new_img.as_mut();
    let copy_result_bytes = keep_rows * result_stride;
    dst_buf[..copy_result_bytes]
        .copy_from_slice(&result_buf[..copy_result_bytes]);

    let src_off = (match_index + 1) * stride;
    let dst_off = copy_result_bytes;
    let copy_len = match_height * stride;
    if src_off + copy_len <= current_buf.len() && dst_off + copy_len <= dst_buf.len() {
        dst_buf[dst_off..dst_off + copy_len]
            .copy_from_slice(&current_buf[src_off..src_off + copy_len]);
    }

    Some(new_img)
}

// ── Capture session thread ──────────────────────────────────────────────────

fn capture_session(app: AppHandle, x: i32, y: i32, width: u32, height: u32) {
    // Let the overlay finish hiding before we start capturing.
    thread::sleep(Duration::from_millis(START_DELAY_MS));

    let cx = x + (width as i32 / 2);
    let cy = y + (height as i32 / 2);

    // Move cursor to region center and bring the target window to the foreground
    // so mouse-wheel events reach it (needed if "scroll inactive windows" is off).
    unsafe {
        let _ = SetCursorPos(cx, cy);
        let pt = POINT { x: cx, y: cy };
        let hwnd = WindowFromPoint(pt);
        if !hwnd.is_invalid() {
            let root = GetAncestor(hwnd, GA_ROOT);
            if !root.is_invalid() {
                let _ = SetForegroundWindow(root);
            }
        }
    }

    // Register Esc hotkey on this thread's message queue (hwnd = HWND::default()
    // → WM_HOTKEY arrives in the thread queue, not a window's queue).
    let hotkey_id: i32 = 1;
    let hotkey_ok = unsafe {
        RegisterHotKey(HWND::default(), hotkey_id, MOD_NOREPEAT, 0x1B /* VK_ESCAPE */).is_ok()
    };

    let mut result: Option<RgbaImage> = None;
    let mut prev_frame: Option<RgbaImage> = None;
    let mut stitch_state = StitchState {
        best_match_count: 0,
        best_match_index: 0,
        best_ignore_bottom: 0,
    };

    'capture: for _frame in 0..MAX_FRAMES {
        // Poll for Esc hotkey before capturing.
        if check_hotkey(hotkey_id) {
            log::debug!("scroll capture: Esc pressed, stopping");
            break;
        }

        // Capture the region.
        let frame = unsafe { capture_screen_rect(x, y, width, height) };
        let frame = match frame {
            Some(f) => f,
            None => {
                log::error!("scroll capture: capture_screen_rect failed");
                break 'capture;
            }
        };

        // Pixel-identical to previous frame → we've reached the bottom.
        if let Some(ref prev) = prev_frame {
            if frame.as_raw() == prev.as_raw() {
                log::debug!("scroll capture: duplicate frame, done");
                break 'capture;
            }
        }

        // Stitch into accumulated result.
        match result.take() {
            None => {
                // First frame becomes the result directly.
                result = Some(frame.clone());
            }
            Some(acc) => {
                match stitch(&acc, &frame, &mut stitch_state) {
                    Some(new_acc) => {
                        result = Some(new_acc);
                    }
                    None => {
                        // No overlap found — keep the previous result and stop.
                        log::debug!("scroll capture: stitch returned no overlap, stopping");
                        result = Some(acc);
                        break 'capture;
                    }
                }
            }
        }

        // Height cap: a stitch can overshoot by up to one viewport, and anything
        // past ~16384px exceeds the WebView2 canvas texture limit — crop, then stop.
        if let Some(ref mut r) = result {
            if r.height() >= MAX_OUTPUT_HEIGHT {
                if r.height() > MAX_OUTPUT_HEIGHT {
                    *r = image::imageops::crop_imm(r, 0, 0, r.width(), MAX_OUTPUT_HEIGHT)
                        .to_image();
                }
                log::debug!("scroll capture: MAX_OUTPUT_HEIGHT reached");
                break 'capture;
            }
        }

        prev_frame = Some(frame);

        // Poll Esc again before scrolling.
        if check_hotkey(hotkey_id) {
            log::debug!("scroll capture: Esc pressed, stopping");
            break 'capture;
        }

        // Scroll down.
        unsafe {
            let _ = SetCursorPos(cx, cy);
            send_scroll(-(120 * WHEEL_TICKS_PER_STEP));
        }

        thread::sleep(Duration::from_millis(SCROLL_DELAY_MS));
    }

    // Unregister hotkey regardless of how we exited.
    if hotkey_ok {
        unsafe {
            let _ = UnregisterHotKey(HWND::default(), hotkey_id);
        }
    }

    // Destroy overlays and show main window — mirrors the clipboard_watcher pattern.
    destroy_overlays(&app);

    match result {
        Some(img) => store_and_emit(app, img, "snip-captured"),
        None => {
            log::error!("scroll capture: no frames captured");
            let _ = app.emit_to(
                "main",
                "scroll-capture-error",
                serde_json::json!({"message": "No frames captured"}),
            );
            crate::show_main_window(&app);
        }
    }
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

/// Send a single mouse wheel event (negative = scroll down).
unsafe fn send_scroll(delta: i32) {
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                mouseData: delta as u32,
                dwFlags: MOUSEEVENTF_WHEEL,
                ..Default::default()
            },
        },
    };
    SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
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

#[cfg(test)]
mod tests {
    use super::*;

    const W: u32 = 400;

    /// Unique RGBA pattern per document row index.
    fn doc_row_pixel(row: u32) -> [u8; 4] {
        [(row & 0xff) as u8, ((row >> 8) & 0xff) as u8, 137, 255]
    }

    /// Distinct pattern for sticky-footer rows.
    fn footer_row_pixel(row: u32) -> [u8; 4] {
        [13, (row & 0xff) as u8, 211, 255]
    }

    fn fill_row(img: &mut RgbaImage, y: u32, px: [u8; 4]) {
        for x in 0..img.width() {
            img.put_pixel(x, y, image::Rgba(px));
        }
    }

    /// Viewport frame of a synthetic document at scroll `offset`, with an
    /// optional sticky footer occupying the bottom `footer` rows.
    fn frame(offset: u32, vh: u32, footer: u32) -> RgbaImage {
        let mut img = RgbaImage::new(W, vh);
        let content_rows = vh - footer;
        for j in 0..content_rows {
            fill_row(&mut img, j, doc_row_pixel(offset + j));
        }
        for j in 0..footer {
            fill_row(&mut img, content_rows + j, footer_row_pixel(j));
        }
        img
    }

    fn run_stitch(offsets: &[u32], vh: u32, footer: u32) -> RgbaImage {
        let mut state = StitchState {
            best_match_count: 0,
            best_match_index: 0,
            best_ignore_bottom: 0,
        };
        let mut result = frame(offsets[0], vh, footer);
        for &off in &offsets[1..] {
            let cur = frame(off, vh, footer);
            result = stitch(&result, &cur, &mut state)
                .unwrap_or_else(|| panic!("stitch found no overlap at offset {off}"));
        }
        result
    }

    fn assert_rows(img: &RgbaImage, expect: impl Fn(u32) -> [u8; 4]) {
        for y in 0..img.height() {
            let got = img.get_pixel(W / 2, y).0;
            let want = expect(y);
            assert_eq!(got, want, "row {y} mismatch");
        }
    }

    #[test]
    fn stitch_no_footer_reconstructs_document() {
        // 200-row viewport, 120-row scroll steps → 80 rows of overlap each time.
        let offsets = [0, 120, 240, 360, 480, 600];
        let out = run_stitch(&offsets, 200, 0);
        assert_eq!(out.height(), 800);
        assert_rows(&out, doc_row_pixel);
    }

    #[test]
    fn stitch_skips_sticky_footer() {
        // 40-row sticky footer on every frame; 160 content rows visible per frame.
        let vh = 200;
        let footer = 40;
        let offsets = [0, 100, 200, 300, 400, 500, 600];
        let out = run_stitch(&offsets, vh, footer);
        // Content stream ends at 600 + 160; footer appears exactly once at the bottom.
        let content_h = 600 + (vh - footer);
        assert_eq!(out.height(), content_h + footer);
        assert_rows(&out, |y| {
            if y < content_h {
                doc_row_pixel(y)
            } else {
                footer_row_pixel(y - content_h)
            }
        });
    }

    #[test]
    fn stitch_uneven_final_step() {
        // Page bottom: the last scroll moves less than the regular step.
        let offsets = [0, 120, 240, 300];
        let out = run_stitch(&offsets, 200, 0);
        assert_eq!(out.height(), 500);
        assert_rows(&out, doc_row_pixel);
    }
}
