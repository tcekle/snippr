use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::time::Instant;

/// Screenshot captured from the clipboard, waiting for the frontend to pull it.
pub struct PendingImage {
    pub png: Vec<u8>,
    /// Dimensions travel to the frontend via the `snip-captured` event payload;
    /// kept here for logging/debugging parity with the stored bytes.
    #[allow(dead_code)]
    pub width: u32,
    #[allow(dead_code)]
    pub height: u32,
}

#[derive(Default)]
pub struct AppState {
    /// Set before we write to the clipboard ourselves so the watcher skips
    /// the resulting WM_CLIPBOARDUPDATE (feedback-loop guard).
    pub ignore_next: AtomicBool,
    /// Tray "Pause watching" toggle.
    pub paused: AtomicBool,
    /// Slot the watcher fills and `get_pending_image` drains.
    pub pending: Mutex<Option<PendingImage>>,
    /// Snipping Tool fires WM_CLIPBOARDUPDATE more than once per snip
    /// (one per clipboard format write); debounce window keyed off this.
    pub last_trigger: Mutex<Option<Instant>>,
}
