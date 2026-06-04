
//! Win32 message-only window that listens for WM_CLIPBOARDUPDATE notifications.
//! Spawns a background thread; never panics — all errors are logged.

use std::sync::OnceLock;
use std::sync::atomic::Ordering::SeqCst;
use std::io::Cursor;
use std::thread;
use std::time::Duration;

use image::{DynamicImage, ImageFormat, RgbaImage};
use tauri::{AppHandle, Emitter, Manager};
use windows::core::w;
use windows::Win32::Foundation::{HWND, LRESULT, WPARAM, LPARAM};
use windows::Win32::System::DataExchange::AddClipboardFormatListener;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW,
    RegisterClassW, HWND_MESSAGE, MSG, WNDCLASSW, WM_CLIPBOARDUPDATE,
    WINDOW_EX_STYLE, WINDOW_STYLE,
};

use crate::settings;
use crate::snip_filter::{clipboard_owner_exe, is_snip_process};
use crate::state::AppState;

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn spawn(app: AppHandle) {
    let _ = APP.set(app);
    thread::Builder::new()
        .name("snippr-clipboard-watcher".into())
        .spawn(|| unsafe { message_loop() })
        .expect("failed to spawn clipboard watcher thread");
}

unsafe fn message_loop() {
    let hinstance = GetModuleHandleW(None)
        .map(|h| windows::Win32::Foundation::HMODULE::from(h))
        .unwrap_or_default();

    let class_name = w!("snippr_clipboard_watcher");

    let wc = WNDCLASSW {
        lpfnWndProc: Some(wnd_proc),
        hInstance: hinstance.into(),
        lpszClassName: class_name,
        ..Default::default()
    };
    RegisterClassW(&wc);

    let hwnd = CreateWindowExW(
        WINDOW_EX_STYLE::default(),
        class_name,
        w!(""),
        WINDOW_STYLE::default(),
        0, 0, 0, 0,
        HWND_MESSAGE,
        None,
        hinstance,
        None,
    );

    let hwnd = match hwnd {
        Ok(h) => h,
        Err(e) => {
            log::error!("clipboard watcher: CreateWindowExW failed: {e}");
            return;
        }
    };

    if let Err(e) = AddClipboardFormatListener(hwnd) {
        log::error!("clipboard watcher: AddClipboardFormatListener failed: {e}");
        return;
    }

    let mut msg = MSG::default();
    while GetMessageW(&mut msg, None, 0, 0).as_bool() {
        DispatchMessageW(&msg);
    }
}

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_CLIPBOARDUPDATE {
        if let Some(app) = APP.get() {
            on_clipboard_update(app);
        }
        return LRESULT(0);
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

fn on_clipboard_update(app: &AppHandle) {
    let state = app.state::<AppState>();

    // Feedback-loop guard: we just wrote to clipboard ourselves.
    if state.ignore_next.swap(false, SeqCst) {
        log::debug!("clipboard_watcher: skipping our own write");
        return;
    }

    if state.paused.load(SeqCst) {
        log::debug!("clipboard_watcher: paused, skipping");
        return;
    }

    let owner = clipboard_owner_exe();
    log::debug!("clipboard_watcher: owner = {:?}", owner);

    let is_snip = owner.as_deref().map(is_snip_process).unwrap_or(false);
    if !is_snip && !settings::load(app).trigger_on_any_image {
        return;
    }

    // One snip raises several WM_CLIPBOARDUPDATEs (one per format write);
    // accept the first and swallow the echoes.
    {
        let mut last = state.last_trigger.lock().unwrap();
        let now = std::time::Instant::now();
        if let Some(t) = *last {
            if now.duration_since(t) < Duration::from_millis(400) {
                log::debug!("clipboard_watcher: debounced duplicate update");
                return;
            }
        }
        *last = Some(now);
    }

    let app = app.clone();
    thread::spawn(move || capture_pending(app));
}

/// Read the current clipboard image, encode to PNG, store as pending, and show editor.
/// Called from both the watcher and the tray "Annotate clipboard image" menu item.
pub fn capture_pending(app: AppHandle) {
    const MAX_ATTEMPTS: u32 = 5;
    const RETRY_DELAY: Duration = Duration::from_millis(60);

    let img_data = {
        let mut result = Err(arboard::Error::ContentNotAvailable);
        for attempt in 0..MAX_ATTEMPTS {
            result = arboard::Clipboard::new().and_then(|mut c| c.get_image());
            if result.is_ok() {
                break;
            }
            if attempt + 1 < MAX_ATTEMPTS {
                log::debug!(
                    "clipboard capture: attempt {}/{} failed, retrying",
                    attempt + 1,
                    MAX_ATTEMPTS
                );
                thread::sleep(RETRY_DELAY);
            }
        }
        match result {
            Ok(d) => d,
            Err(e) => {
                log::debug!("clipboard capture: no image after {MAX_ATTEMPTS} attempts: {e}");
                return;
            }
        }
    };

    let width = img_data.width as u32;
    let height = img_data.height as u32;

    let rgba = match RgbaImage::from_raw(width, height, img_data.bytes.into_owned()) {
        Some(r) => r,
        None => {
            log::error!("clipboard capture: RgbaImage::from_raw failed (buffer too small?)");
            return;
        }
    };

    let mut buf = Cursor::new(Vec::new());
    if let Err(e) = DynamicImage::ImageRgba8(rgba).write_to(&mut buf, ImageFormat::Png) {
        log::error!("clipboard capture: PNG encode failed: {e}");
        return;
    }
    let png = buf.into_inner();

    {
        let state = app.state::<AppState>();
        let mut slot = state.pending.lock().unwrap();
        *slot = Some(crate::state::PendingImage { png, width, height });
    }

    let _ = app.emit_to("main", "snip-captured", serde_json::json!({"width": width, "height": height}));
    crate::show_main_window(&app);
}
