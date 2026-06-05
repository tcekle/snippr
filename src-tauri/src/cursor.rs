
//! Live mouse-cursor compositing for screen recording.
//!
//! GDI `BitBlt` (used by `scrolling_capture::capture_screen_rect_*`) copies the
//! framebuffer **without** the mouse pointer — the cursor is a hardware/overlay
//! sprite the GPU blends on top at scan-out, so it never lands in the captured
//! DIB. Recordings therefore come out cursor-less, which looks broken for a
//! screen recorder.
//!
//! This module exposes a single helper the capture path calls *after* its
//! `BitBlt` and *before* it reads the bits back out: it asks the OS where the
//! cursor is and which HCURSOR is current, then `DrawIconEx`'s that cursor
//! straight onto the same memory DC. Because we draw into the DIB the recorder
//! already owns, the cursor is baked into every frame at the right spot.
//!
//! Coordinate model matches the recorder's DC: (0,0) in the DC is screen pixel
//! (region_x, region_y), with y increasing downward (the DIB is top-down /
//! negative `biHeight`), so cursor placement is a plain screen→region subtract.

use windows::Win32::Graphics::Gdi::{DeleteObject, HBRUSH, HDC};
use windows::Win32::UI::WindowsAndMessaging::{
    DrawIconEx, GetCursorInfo, GetIconInfo, CURSORINFO, CURSOR_SHOWING, DI_NORMAL, HICON, ICONINFO,
};

// ── Cursor compositing ──────────────────────────────────────────────────────

/// Composite the current system cursor onto `hdc` (a top-down DIB DC whose
/// (0,0) maps to screen pixel (region_x, region_y)). No-op if the cursor is
/// hidden. Safe to call every frame.
pub unsafe fn draw_cursor_into_dc(hdc: HDC, region_x: i32, region_y: i32) {
    // Query the global cursor state: visibility, current HCURSOR, screen pos.
    // `cbSize` MUST be set or GetCursorInfo fails — `Default` zeroes it, so we
    // stamp the real size in afterwards.
    let mut ci = CURSORINFO {
        cbSize: std::mem::size_of::<CURSORINFO>() as u32,
        ..Default::default()
    };
    if GetCursorInfo(&mut ci).is_err() {
        return;
    }

    // Bail when the pointer isn't on screen. `flags` is a newtype over u32 and
    // (in this windows version) has no BitAnd impl, so test the raw bit — this
    // also stays correct across the 0.58/0.61 split the crate is pinned around.
    // A zero `flags` means hidden; CURSOR_SUPPRESSED (touch active) also lacks
    // CURSOR_SHOWING, so this naturally skips those frames too.
    if (ci.flags.0 & CURSOR_SHOWING.0) == 0 {
        return;
    }

    // ci.hCursor is a *shared* system handle. We pass it (as HICON — HCURSOR and
    // HICON are the same underlying handle) to GetIconInfo/DrawIconEx, but we
    // must NEVER DestroyCursor/DestroyIcon it: it belongs to the OS, and
    // destroying it corrupts the cursor for the whole desktop.
    let hicon = HICON(ci.hCursor.0);
    if hicon.is_invalid() {
        return;
    }

    // The hotspot is the pixel inside the cursor bitmap that actually points
    // (e.g. the tip of the arrow, the center of the crosshair). ptScreenPos is
    // the hotspot's screen location, so to place the bitmap's top-left we shift
    // back by the hotspot offset — otherwise the arrow would sit one whole
    // cursor down-and-right of the true pointer.
    let mut ii = ICONINFO::default();
    if GetIconInfo(hicon, &mut ii).is_err() {
        return;
    }

    let draw_x = ci.ptScreenPos.x - region_x - ii.xHotspot as i32;
    let draw_y = ci.ptScreenPos.y - region_y - ii.yHotspot as i32;

    // DrawIconEx applies the cursor's AND/XOR masks and per-pixel alpha for us,
    // so the result matches what the user sees on screen. We deliberately do NOT
    // bounds-check (draw_x, draw_y): a cursor straddling the region edge should
    // still draw partially, and GDI clips anything outside the DC for free.
    //
    // Zero-value sentinels per this crate's mixed-version convention:
    //   cxwidth/cywidth = 0       → use the cursor's native size
    //   istepifanicur   = 0       → frame 0 of an animated cursor
    //   hbrflickerfreedraw = default → no flicker-free background brush
    let _ = DrawIconEx(
        hdc,
        draw_x,
        draw_y,
        hicon,
        0,
        0,
        0,
        HBRUSH::default(),
        DI_NORMAL,
    );

    // CRITICAL: GetIconInfo creates *fresh* HBITMAPs for hbmMask (and hbmColor
    // for colour cursors) on every call and hands ownership to us. This helper
    // runs ~30×/sec for minutes — leaking two GDI objects per frame would
    // exhaust the desktop's GDI handle quota in well under an hour and start
    // failing draws desktop-wide. DeleteObject tolerates a NULL handle, so the
    // hbmColor-is-null case (monochrome cursors) needs no special guard.
    let _ = DeleteObject(ii.hbmMask);
    let _ = DeleteObject(ii.hbmColor);
}

// ── Tests ───────────────────────────────────────────────────────────────────

// No unit tests: every branch here needs a live desktop cursor and a real
// device context. `draw_cursor_into_dc` is one unbroken sequence of FFI calls
// with no pure helper to exercise in isolation, and per the task constraints we
// must not spawn a window or invoke the function (it requires a valid HDC) from
// a test. It is exercised end-to-end by the recorder's capture path instead.
