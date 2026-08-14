
//! Screen recording (milestone 1): region → temp MP4 via Media Foundation.
//!
//! Flow mirrors the snapshot path but writes H.264 instead of a PNG:
//!   tray/frontend → begin_recording_selection (reuses the scrolling overlay)
//!   → frontend draws region → start_recording (spawns the recorder thread,
//!   opens the floating toolbar) → recorder writes CFR frames to a temp MP4 →
//!   stop_recording / cancel_recording / Esc / 10-min cap → Finalize, move to
//!   the save directory (or discard) → recording-saved / recording-error.
//!
//! We reuse `scrolling_capture`'s GDI capture (`capture_screen_rect_bgra_cursor`,
//! which hands MF the native BGRA bytes with no wasted channel swap), its
//! overlay teardown (`destroy_overlays`), and its Esc-hotkey drain
//! (`check_hotkey`). The recorder runs on its own thread so the command
//! returns immediately and the main thread stays free to service IPC.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU8, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;

use windows::core::PCWSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::Media::MediaFoundation::{
    IMFAttributes, IMFByteStream, IMFMediaType, IMFSinkWriter, MFCreateAttributes,
    MFCreateMediaType, MFCreateMemoryBuffer, MFCreateSample, MFCreateSinkWriterFromURL, MFShutdown,
    MFStartup, MFMediaType_Video, MFVideoFormat_H264, MFVideoFormat_RGB32,
    MFVideoInterlace_Progressive, MF_E_INVALIDMEDIATYPE, MF_E_TOPO_CODEC_NOT_FOUND,
    MF_MT_AVG_BITRATE, MF_MT_DEFAULT_STRIDE, MF_MT_FRAME_RATE, MF_MT_FRAME_SIZE,
    MF_MT_INTERLACE_MODE, MF_MT_MAJOR_TYPE, MF_MT_PIXEL_ASPECT_RATIO, MF_MT_SUBTYPE,
    MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, MF_VERSION, MFSTARTUP_FULL,
};
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};
use windows::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT};

use crate::scrolling_capture;

// ── Session constants ───────────────────────────────────────────────────────

/// Label of the floating recording toolbar window.
const TOOLBAR_LABEL: &str = "rec-toolbar";

/// Label of the click-through outline window framing the capture region.
const BORDER_LABEL: &str = "rec-border";

/// Outline thickness in physical px. The border window is the region inflated by
/// this on every side, so the ring sits just OUTSIDE the captured pixels.
const BORDER_PX: i32 = 3;

/// Toolbar size in *logical* pixels; scaled by the monitor's factor for the
/// physical size/position we set after creation.
const TOOLBAR_W_LOGICAL: f64 = 260.0;
const TOOLBAR_H_LOGICAL: f64 = 44.0;

/// Gap between the recording region and the toolbar (physical px-ish; scaled).
const TOOLBAR_GAP_LOGICAL: f64 = 8.0;

/// Hard cap on recording length. Hits the same path as a manual stop&save.
const MAX_DURATION: Duration = Duration::from_secs(10 * 60);

/// Esc hotkey id on the recorder thread (capture_session uses 1; we use 2).
const HOTKEY_ID: i32 = 2;

/// Stop-signal values written by the stop/cancel commands and Esc.
const STOP_NONE: u8 = 0;
const STOP_SAVE: u8 = 1;
const STOP_CANCEL: u8 = 2;

// ── Shared recorder state ────────────────────────────────────────────────────

/// True while a recording session thread is alive. Guards against a second
/// `start_recording` (e.g. a double-fire from the overlay) clobbering the
/// first session's signals mid-flight.
static RECORDING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Stop signal, polled by the recorder loop. 0 = keep going, 1 = stop & save,
/// 2 = stop & discard. Reset to 0 when a session starts.
static STOP_SIGNAL: AtomicU8 = AtomicU8::new(STOP_NONE);

/// Target FPS chosen at `begin_recording_selection`, read at `start_recording`.
/// One of 10/20/30 after clamping.
static TARGET_FPS: AtomicU32 = AtomicU32::new(30);

/// Output format chosen at `begin_recording_selection`. 0 = MP4 only,
/// 1 = MP4 + GIF (the GIF is transcoded from the finished MP4; both are kept).
static RECORD_FORMAT: AtomicU8 = AtomicU8::new(FORMAT_MP4);
const FORMAT_MP4: u8 = 0;
const FORMAT_GIF: u8 = 1;

// ── FPS clamp ────────────────────────────────────────────────────────────────

/// Snap an arbitrary requested fps to the nearest supported rate (10/20/30).
/// Anything <=15 → 10, <=25 → 20, else 30. Kept tiny and pure for the test.
fn clamp_fps(requested: u32) -> u32 {
    const SUPPORTED: [u32; 3] = [10, 20, 30];
    SUPPORTED
        .into_iter()
        .min_by_key(|&f| f.abs_diff(requested))
        .unwrap_or(30)
}

// ── Commands ────────────────────────────────────────────────────────────────

/// Open the region overlay in recording mode. `fps` is clamped to 10/20/30 and
/// stashed for `start_recording` to read. async: it builds overlay webviews
/// (see scrolling_capture — sync window creation deadlocks on Windows).
#[tauri::command]
pub async fn begin_recording_selection(app: AppHandle, fps: u32, format: Option<String>) {
    let fps = clamp_fps(fps);
    TARGET_FPS.store(fps, Ordering::Relaxed);
    let fmt = match format.as_deref() {
        Some("gif") => FORMAT_GIF,
        _ => FORMAT_MP4,
    };
    RECORD_FORMAT.store(fmt, Ordering::Relaxed);
    scrolling_capture::set_selection_mode(scrolling_capture::MODE_RECORDING);
    scrolling_capture::begin_selection(&app);
}

/// The overlay calls this once the user has drawn the recording region.
/// `x/y/width/height` are physical screen coordinates. Returns immediately; a
/// background thread runs the Media Foundation encode loop.
///
/// async: it creates the toolbar webview window, which (like every window we
/// build on Windows) must not happen on a sync command — `build()` blocks the
/// main thread, which would be blocked waiting on this command's IPC reply.
#[tauri::command]
pub async fn start_recording(app: AppHandle, x: i32, y: i32, width: u32, height: u32) {
    // Guard: only one session at a time. compare_exchange so two overlapping
    // calls can't both win the race.
    if RECORDING_ACTIVE
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        log::error!("start_recording: a recording is already active");
        let _ = app.emit_to(
            "main",
            "recording-error",
            serde_json::json!({"message": "A recording is already in progress"}),
        );
        return;
    }

    // Arm a fresh session: clear any stale stop signal from a prior run.
    STOP_SIGNAL.store(STOP_NONE, Ordering::SeqCst);

    // Tear down the selection overlays now that we have the region.
    scrolling_capture::destroy_overlays(&app);

    // H.264 requires even dimensions; round down (min 2) so the encoder is happy.
    let width = round_down_even(width);
    let height = round_down_even(height);

    let fps = TARGET_FPS.load(Ordering::Relaxed);

    // Build the floating toolbar and the region outline HERE (async command) and
    // position them relative to the region. Failure to create either is
    // non-fatal — we still record.
    create_toolbar(&app, x, y, width, height);
    create_border(&app, x, y, width, height);

    let app_for_thread = app.clone();
    if let Err(e) = thread::Builder::new()
        .name("snippr-recorder".into())
        .spawn(move || recording_session(app_for_thread, x, y, width, height, fps))
    {
        log::error!("start_recording: failed to spawn recorder thread: {e}");
        RECORDING_ACTIVE.store(false, Ordering::SeqCst);
        destroy_toolbar(&app);
        destroy_border(&app);
        let _ = app.emit_to(
            "main",
            "recording-error",
            serde_json::json!({"message": format!("Failed to start recorder: {e}")}),
        );
        crate::show_main_window(&app);
    }
}

/// Stop the active recording and save it to the configured directory.
#[tauri::command]
pub async fn stop_recording() {
    STOP_SIGNAL.store(STOP_SAVE, Ordering::SeqCst);
}

/// Stop the active recording and discard the temp file.
#[tauri::command]
pub async fn cancel_recording() {
    STOP_SIGNAL.store(STOP_CANCEL, Ordering::SeqCst);
}

// ── Even-dimension helper ─────────────────────────────────────────────────────

/// Round a dimension down to the nearest even value, with a floor of 2.
/// H.264 4:2:0 needs even width/height; an odd region would otherwise be
/// rejected by the encoder.
fn round_down_even(v: u32) -> u32 {
    (v & !1).max(2)
}

// ── Toolbar window ────────────────────────────────────────────────────────────

/// Create the floating recording toolbar and place it just below the region
/// (above it, or tucked inside the top-right corner, if there's no room).
///
/// Same creation pattern as `begin_selection`: build invisible, then set the
/// physical position/size and show — the builder works in logical units, which
/// is awkward on mixed-DPI, so we drive everything in physical pixels.
fn create_toolbar(app: &AppHandle, x: i32, y: i32, width: u32, height: u32) {
    // Find the monitor containing the region's center so we scale + clamp to it.
    let cx = x as f64 + width as f64 / 2.0;
    let cy = y as f64 + height as f64 / 2.0;
    let monitor = app
        .monitor_from_point(cx, cy)
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
    let tb_w = (TOOLBAR_W_LOGICAL * scale).round() as i32;
    let tb_h = (TOOLBAR_H_LOGICAL * scale).round() as i32;
    let gap = (TOOLBAR_GAP_LOGICAL * scale).round() as i32;

    // Monitor work area in physical px (fall back to the region itself).
    let (mon_x, mon_y, mon_w, mon_h) = match monitor.as_ref() {
        Some(m) => (
            m.position().x,
            m.position().y,
            m.size().width as i32,
            m.size().height as i32,
        ),
        None => (x, y, width as i32, height as i32),
    };

    // Preferred: 8px below the region, horizontally aligned to its left edge.
    let below_y = y + height as i32 + gap;
    let above_y = y - tb_h - gap;

    let (tb_x, tb_y) = if below_y + tb_h <= mon_y + mon_h {
        // Room below.
        (x, below_y)
    } else if above_y >= mon_y {
        // No room below → place above.
        (x, above_y)
    } else {
        // Neither → tuck inside the region's top-right corner.
        (x + width as i32 - tb_w, y)
    };

    // Clamp fully on-screen so the toolbar never spills past the monitor.
    let tb_x = tb_x.clamp(mon_x, (mon_x + mon_w - tb_w).max(mon_x));
    let tb_y = tb_y.clamp(mon_y, (mon_y + mon_h - tb_h).max(mon_y));

    let win = WebviewWindowBuilder::new(app, TOOLBAR_LABEL, WebviewUrl::App("index.html".into()))
        .decorations(false)
        .shadow(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .resizable(false)
        .transparent(false)
        .visible(false)
        .build();

    let win = match win {
        Ok(w) => w,
        Err(e) => {
            log::error!("recording: toolbar build failed: {e}");
            return;
        }
    };

    if let Err(e) = win.set_position(PhysicalPosition::new(tb_x, tb_y)) {
        log::error!("recording: toolbar set_position failed: {e}");
    }
    if let Err(e) = win.set_size(PhysicalSize::new(tb_w.max(1) as u32, tb_h.max(1) as u32)) {
        log::error!("recording: toolbar set_size failed: {e}");
    }
    if let Err(e) = win.show() {
        log::error!("recording: toolbar show failed: {e}");
    }
}

/// Destroy the toolbar window if it exists. Safe to call when absent.
fn destroy_toolbar(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(TOOLBAR_LABEL) {
        let _ = win.destroy();
    }
}

/// Create the click-through outline that frames the capture region. The window
/// is the region inflated by `BORDER_PX` on every side and positioned at
/// (x-BORDER_PX, y-BORDER_PX); the React side (`RecBorder`) paints a 3px ring on
/// the window's outer edge, so the ring lands just OUTSIDE the captured pixels
/// and never appears in the recording. Transparent + ignore-cursor-events so it
/// neither tints the capture nor blocks interaction with the app being recorded.
fn create_border(app: &AppHandle, x: i32, y: i32, width: u32, height: u32) {
    let win = WebviewWindowBuilder::new(app, BORDER_LABEL, WebviewUrl::App("index.html".into()))
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .build();

    let win = match win {
        Ok(w) => w,
        Err(e) => {
            log::error!("recording: border build failed: {e}");
            return;
        }
    };

    // Click-through: events pass to the app underneath being recorded.
    let _ = win.set_ignore_cursor_events(true);

    let bx = x - BORDER_PX;
    let by = y - BORDER_PX;
    let bw = (width as i32 + BORDER_PX * 2).max(1) as u32;
    let bh = (height as i32 + BORDER_PX * 2).max(1) as u32;
    if let Err(e) = win.set_position(PhysicalPosition::new(bx, by)) {
        log::error!("recording: border set_position failed: {e}");
    }
    if let Err(e) = win.set_size(PhysicalSize::new(bw, bh)) {
        log::error!("recording: border set_size failed: {e}");
    }
    if let Err(e) = win.show() {
        log::error!("recording: border show failed: {e}");
    }
}

/// Destroy the outline window if it exists. Safe to call when absent.
fn destroy_border(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(BORDER_LABEL) {
        let _ = win.destroy();
    }
}

// ── CFR pacing ────────────────────────────────────────────────────────────────

/// Which frame index *should* be presenting at `now`, given a wall-clock
/// `start` and a constant `fps`. Driving timestamps off wall-clock (rather than
/// "previous frame + 1") keeps the MP4's playback duration matched to real time
/// even when capture stalls: if a tick runs late by N frame-periods, the loop
/// advances N indices so the next sample's timestamp is still wall-clock-true.
///
/// Pure + integer-only so it's unit-testable without a clock.
fn next_frame_index(start: Instant, now: Instant, fps: u32) -> u64 {
    let elapsed = now.saturating_duration_since(start);
    // floor(elapsed / frame_period); frame_period = 1/fps seconds.
    // = floor(elapsed_ns * fps / 1e9)
    let elapsed_ns = elapsed.as_nanos();
    ((elapsed_ns * fps as u128) / 1_000_000_000u128) as u64
}

// ── Media Foundation encoder ─────────────────────────────────────────────────

/// Configure an H.264 SinkWriter for `path` at `w`x`h`@`fps` and return
/// (writer, stream_index). Input format is RGB32 (== BGRA).
///
/// Orientation: MF treats RGB32 as **bottom-up** by default, and many H.264
/// encoder MFTs ignore `MF_MT_DEFAULT_STRIDE`'s sign entirely (a negative
/// stride hint produced upside-down video on real hardware). So rather than
/// rely on the stride hint, `write_frame` flips our top-down capture into a
/// genuine bottom-up buffer and we declare a POSITIVE stride to match.
///
/// `SetInputMediaType` is retried once with hardware transforms enabled if the
/// first attempt is rejected for codec/type reasons, matching the documented
/// fallback for machines whose only H.264 encoder is a hardware MFT.
unsafe fn setup_sink_writer(
    path: &str,
    w: u32,
    h: u32,
    fps: u32,
) -> windows::core::Result<(IMFSinkWriter, u32)> {
    let path_w: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();

    let writer: IMFSinkWriter = MFCreateSinkWriterFromURL(
        PCWSTR(path_w.as_ptr()),
        None::<&IMFByteStream>,
        None::<&IMFAttributes>,
    )?;

    // Pack the 64-bit "two u32" attributes MF expects (hi<<32 | lo).
    let frame_size = ((w as u64) << 32) | (h as u64);
    let frame_rate = ((fps as u64) << 32) | 1u64;
    let par = (1u64 << 32) | 1u64;

    // Bitrate heuristic: ~0.1 bits/pixel/frame, clamped to a sane band.
    let bitrate = ((w as f64) * (h as f64) * (fps as f64) * 0.1)
        .clamp(1_000_000.0, 25_000_000.0) as u32;

    // ── Output (encoded) type: H.264 ──
    let out_type: IMFMediaType = MFCreateMediaType()?;
    out_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
    out_type.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_H264)?;
    out_type.SetUINT32(&MF_MT_AVG_BITRATE, bitrate)?;
    out_type.SetUINT64(&MF_MT_FRAME_SIZE, frame_size)?;
    out_type.SetUINT64(&MF_MT_FRAME_RATE, frame_rate)?;
    out_type.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, par)?;
    out_type.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
    let stream_index = writer.AddStream(&out_type)?;

    // ── Input (raw) type: RGB32 / BGRA, bottom-up (positive stride) ──
    let in_type: IMFMediaType = MFCreateMediaType()?;
    in_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
    in_type.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)?;
    in_type.SetUINT64(&MF_MT_FRAME_SIZE, frame_size)?;
    in_type.SetUINT64(&MF_MT_FRAME_RATE, frame_rate)?;
    in_type.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, par)?;
    in_type.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
    // Positive stride, top-down rows: the encoder MFT reads memory row 0 as the
    // top of the video (verified with a 4-colour quadrant probe against a real
    // H.264 decoder). Our capture is top-down, so this is a straight passthrough.
    let stride = (w as i32) * 4;
    in_type.SetUINT32(&MF_MT_DEFAULT_STRIDE, stride as u32)?;

    // First attempt: no encoding-parameter attributes.
    let set_res = writer.SetInputMediaType(stream_index, &in_type, None::<&IMFAttributes>);
    if let Err(ref e) = set_res {
        if e.code() == MF_E_INVALIDMEDIATYPE || e.code() == MF_E_TOPO_CODEC_NOT_FOUND {
            // Retry once allowing a hardware H.264 MFT (some machines have no
            // software encoder; the SinkWriter only uses HW MFTs when asked).
            log::warn!(
                "recording: SetInputMediaType rejected ({:?}); retrying with hardware transforms",
                e.code()
            );
            let mut attrs: Option<IMFAttributes> = None;
            MFCreateAttributes(&mut attrs, 1)?;
            let attrs = attrs.expect("MFCreateAttributes returned null on success");
            attrs.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1)?;
            writer.SetInputMediaType(stream_index, &in_type, &attrs)?;
        } else {
            set_res?;
        }
    }

    writer.BeginWriting()?;
    Ok((writer, stream_index))
}

/// Write a single top-down BGRA frame as one MF sample at the given timestamp.
/// `bgra` must be exactly `w*h*4` bytes.
///
/// Orientation: verified against a real H.264 decoder (browser/VLC) with a
/// 4-colour quadrant probe — the SinkWriter's H.264 encoder treats the input
/// buffer as TOP-DOWN and passes orientation through unchanged. Our capture is
/// already top-down, so we copy it verbatim. (A NEGATIVE stride hint, or a
/// manual row flip, both produced upside-down video; an MF SourceReader
/// round-trip lied because its own readback convention cancelled the flip.)
unsafe fn write_frame(
    writer: &IMFSinkWriter,
    stream_index: u32,
    bgra: &[u8],
    w: u32,
    h: u32,
    sample_time_hns: i64,
    sample_dur_hns: i64,
) -> windows::core::Result<()> {
    debug_assert_eq!(bgra.len(), (w * h * 4) as usize, "frame size mismatch");
    let len = bgra.len() as u32;
    let buffer = MFCreateMemoryBuffer(len)?;

    // Copy our pixels into the MF-owned buffer.
    let mut dst: *mut u8 = std::ptr::null_mut();
    let mut max_len = 0u32;
    buffer.Lock(&mut dst, Some(&mut max_len), None)?;
    // dst is valid for max_len (>= len) bytes; copy exactly our frame.
    std::ptr::copy_nonoverlapping(bgra.as_ptr(), dst, bgra.len());
    buffer.Unlock()?;
    buffer.SetCurrentLength(len)?;

    let sample = MFCreateSample()?;
    sample.AddBuffer(&buffer)?;
    sample.SetSampleTime(sample_time_hns)?;
    sample.SetSampleDuration(sample_dur_hns)?;
    writer.WriteSample(stream_index, &sample)?;
    Ok(())
}

/// Encode frames produced by `frame_provider` into an MP4 at `path`.
///
/// Factored out of the live session so the integration test can drive it with
/// synthetic gradient frames. `frame_provider(call_n)` is invoked with a 0-based
/// *call* counter and returns `Some((frame_index, bgra))` to write one frame, or
/// `None` to stop. The provider owns pacing/stop logic and — crucially — chooses
/// the `frame_index` that stamps the sample's presentation time
/// (`frame_index * frame_dur`). That lets the live loop keep timestamps
/// wall-clock-true: when capture stalls, it returns a *jumped* frame_index so the
/// MP4 clock skips the missed slots instead of compressing real time.
///
/// COM/MF must already be initialized on the calling thread.
unsafe fn encode_frames<F>(
    path: &str,
    w: u32,
    h: u32,
    fps: u32,
    mut frame_provider: F,
) -> windows::core::Result<u64>
where
    F: FnMut(u64) -> Option<(u64, Vec<u8>)>,
{
    let (writer, stream_index) = setup_sink_writer(path, w, h, fps)?;
    let frame_dur_hns = (10_000_000u64 / fps as u64) as i64;

    let mut call_n: u64 = 0;
    let mut written: u64 = 0;
    while let Some((frame_index, frame)) = frame_provider(call_n) {
        if frame.len() == (w * h * 4) as usize {
            if let Err(e) = write_frame(
                &writer,
                stream_index,
                &frame,
                w,
                h,
                frame_index as i64 * frame_dur_hns,
                frame_dur_hns,
            ) {
                log::error!("recording: WriteSample failed at frame {frame_index}: {e}");
                let _ = writer.Finalize();
                return Err(e);
            }
            written += 1;
        } else {
            log::error!(
                "recording: frame {frame_index} had wrong size {} (expected {})",
                frame.len(),
                w * h * 4
            );
        }
        call_n += 1;
    }

    writer.Finalize()?;
    Ok(written)
}

// ── Recording session thread ──────────────────────────────────────────────────

fn recording_session(app: AppHandle, x: i32, y: i32, width: u32, height: u32, fps: u32) {
    // COM + Media Foundation are per-thread; init here, tear down at the end.
    unsafe {
        // MTA: this thread does nothing but drive MF, no STA/UI requirements.
        let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        if hr.is_err() {
            log::error!("recording: CoInitializeEx failed: {hr:?}");
            finish(&app, Err("COM init failed".into()), None);
            return;
        }
        if let Err(e) = MFStartup(MF_VERSION, MFSTARTUP_FULL) {
            log::error!("recording: MFStartup failed: {e}");
            CoUninitialize();
            finish(&app, Err("Media Foundation init failed".into()), None);
            return;
        }
    }

    let result = run_capture_loop(x, y, width, height, fps);

    unsafe {
        let _ = MFShutdown();
        CoUninitialize();
    }

    finish(&app, result.outcome, Some(result.temp_path));
}

/// Outcome + temp path produced by the capture loop.
struct LoopResult {
    /// Ok(should_save) — true = move temp to save dir, false = discard (cancel).
    /// Err(message) — encode/setup failed; temp (if any) gets cleaned up.
    outcome: Result<bool, String>,
    temp_path: PathBuf,
}

/// The actual capture + encode loop. Assumes COM/MF are initialized.
fn run_capture_loop(x: i32, y: i32, width: u32, height: u32, fps: u32) -> LoopResult {
    // Temp file: one per process; remove a stale leftover first.
    let temp_path =
        std::env::temp_dir().join(format!("snippr_rec_{}.mp4", std::process::id()));
    let _ = std::fs::remove_file(&temp_path);
    let temp_str = temp_path.to_string_lossy().into_owned();

    // Esc on this thread's queue → stop & save (signal 1), same as a stop click.
    let hotkey_ok =
        unsafe { RegisterHotKey(HWND::default(), HOTKEY_ID, MOD_NOREPEAT, 0x1B).is_ok() };

    let frame_dur = Duration::from_nanos(1_000_000_000u64 / fps as u64);
    let start = Instant::now();

    // Shared closure state for pacing across frame_provider calls.
    // First tick fires immediately (next_tick == start) → frame index 0 at t≈0.
    let mut next_tick = start;
    let mut last_index: Option<u64> = None;
    let mut discard = false;

    let encode_result = unsafe {
        encode_frames(&temp_str, width, height, fps, |_call_n| {
            // ── stop conditions ──
            match STOP_SIGNAL.load(Ordering::SeqCst) {
                STOP_SAVE => return None,
                STOP_CANCEL => {
                    discard = true;
                    return None;
                }
                _ => {}
            }
            if scrolling_capture::check_hotkey(HOTKEY_ID) {
                // Esc = stop & save.
                STOP_SIGNAL.store(STOP_SAVE, Ordering::SeqCst);
                return None;
            }
            if start.elapsed() >= MAX_DURATION {
                log::debug!("recording: 10-minute cap reached, saving");
                STOP_SIGNAL.store(STOP_SAVE, Ordering::SeqCst);
                return None;
            }

            // ── CFR pacing: sleep until this frame's wall-clock slot ──
            let now = Instant::now();
            if now < next_tick {
                thread::sleep(next_tick - now);
            }

            // Wall-clock frame index for THIS sample. If capture fell behind by
            // ≥1 period, `target` jumps ahead — those missed indices are simply
            // never emitted, so the MP4's presentation clock stays true to real
            // time (CFR with dropped frames, not a slowed-down clock).
            let now = Instant::now();
            let mut target = next_frame_index(start, now, fps);
            // Guarantee strictly increasing timestamps: a too-fast tick (or two
            // calls resolving to the same index) would otherwise hand MF an
            // equal/decreasing sample time, which it rejects.
            if let Some(prev) = last_index {
                if target <= prev {
                    target = prev + 1;
                }
            }
            last_index = Some(target);
            // Schedule the next tick one period past this frame's slot.
            next_tick = start + frame_dur * (target as u32).saturating_add(1);

            // ── capture one frame (native BGRA, top-down) ──
            // SAFETY: enclosing `unsafe` block (the encode_frames call) covers this.
            match scrolling_capture::capture_screen_rect_bgra_cursor(x, y, width, height) {
                Some(buf) => Some((target, buf)),
                None => {
                    log::error!("recording: capture_screen_rect_bgra_cursor failed; stopping");
                    STOP_SIGNAL.store(STOP_SAVE, Ordering::SeqCst);
                    None
                }
            }
        })
    };

    if hotkey_ok {
        unsafe {
            let _ = UnregisterHotKey(HWND::default(), HOTKEY_ID);
        }
    }

    let outcome = match encode_result {
        Ok(frames) => {
            log::debug!("recording: wrote {frames} frames");
            if frames == 0 {
                // Nothing captured — treat as an error so we don't emit a 0-byte save.
                Err("No frames were captured".into())
            } else {
                Ok(!discard)
            }
        }
        Err(e) => Err(format!("Encoding failed: {e}")),
    };

    LoopResult { outcome, temp_path }
}

// ── Finalization / cleanup ────────────────────────────────────────────────────

/// Move the finished temp file into the save directory, returning the final
/// path. Falls back to copy+delete if a plain rename fails (e.g. TEMP and the
/// save folder are on different volumes — rename can't cross volumes).
fn finalize_to_save_dir(app: &AppHandle, temp_path: &PathBuf) -> Result<PathBuf, String> {
    let settings = crate::settings::load(app);
    let dir = PathBuf::from(&settings.save_directory);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("create save dir failed: {e}"))?;

    let stamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let final_path = dir.join(format!("snippr_rec_{stamp}.mp4"));

    if std::fs::rename(temp_path, &final_path).is_ok() {
        return Ok(final_path);
    }
    // Cross-volume or other rename failure → copy then delete.
    std::fs::copy(temp_path, &final_path)
        .map_err(|e| format!("copy to save dir failed: {e}"))?;
    let _ = std::fs::remove_file(temp_path);
    Ok(final_path)
}

/// Tear down the toolbar, clear the active flag, and emit the terminal event.
/// `result`: Ok(true) = save, Ok(false) = cancel/discard, Err(msg) = failure.
fn finish(app: &AppHandle, result: Result<bool, String>, temp_path: Option<PathBuf>) {
    destroy_toolbar(app);
    destroy_border(app);

    let outcome: Result<bool, String> = result;
    match outcome {
        Ok(true) => {
            // Save: move temp → save dir.
            match temp_path.as_ref().map(|p| finalize_to_save_dir(app, p)) {
                Some(Ok(final_path)) => {
                    let path_str = final_path.to_string_lossy().into_owned();
                    // GIF requested: transcode the saved MP4 alongside it (both
                    // kept). A GIF failure is non-fatal — the MP4 is already safe.
                    let gif_str = if RECORD_FORMAT.load(Ordering::Relaxed) == FORMAT_GIF {
                        let gif_path = final_path.with_extension("gif");
                        let fps = TARGET_FPS.load(Ordering::Relaxed);
                        match crate::gif_export::transcode_mp4_to_gif(
                            &path_str,
                            &gif_path.to_string_lossy(),
                            fps,
                        ) {
                            Ok(()) => Some(gif_path.to_string_lossy().into_owned()),
                            Err(e) => {
                                log::error!("recording: GIF transcode failed: {e}");
                                None
                            }
                        }
                    } else {
                        None
                    };
                    let _ = app.emit_to(
                        "main",
                        "recording-saved",
                        serde_json::json!({ "path": path_str, "gif": gif_str }),
                    );
                }
                Some(Err(e)) => {
                    log::error!("recording: {e}");
                    if let Some(p) = temp_path.as_ref() {
                        let _ = std::fs::remove_file(p);
                    }
                    let _ = app.emit_to(
                        "main",
                        "recording-error",
                        serde_json::json!({ "message": e }),
                    );
                }
                None => {
                    let _ = app.emit_to(
                        "main",
                        "recording-error",
                        serde_json::json!({ "message": "No output file produced" }),
                    );
                }
            }
        }
        Ok(false) => {
            // Cancel: discard the temp file, no event payload beyond restoring UI.
            if let Some(p) = temp_path.as_ref() {
                let _ = std::fs::remove_file(p);
            }
        }
        Err(msg) => {
            // Error: best-effort temp cleanup + error event.
            if let Some(p) = temp_path.as_ref() {
                let _ = std::fs::remove_file(p);
            }
            let _ = app.emit_to(
                "main",
                "recording-error",
                serde_json::json!({ "message": msg }),
            );
        }
    }

    RECORDING_ACTIVE.store(false, Ordering::SeqCst);
    crate::show_main_window(app);
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── fps clamp ──
    #[test]
    fn clamp_fps_snaps_to_nearest_supported() {
        assert_eq!(clamp_fps(1), 10);
        assert_eq!(clamp_fps(10), 10);
        assert_eq!(clamp_fps(14), 10);
        assert_eq!(clamp_fps(16), 20); // 16 is closer to 20 than 10
        assert_eq!(clamp_fps(20), 20);
        assert_eq!(clamp_fps(26), 30);
        assert_eq!(clamp_fps(30), 30);
        assert_eq!(clamp_fps(120), 30);
    }

    // ── even rounding ──
    #[test]
    fn round_down_even_floors_to_even_min_two() {
        assert_eq!(round_down_even(0), 2);
        assert_eq!(round_down_even(1), 2);
        assert_eq!(round_down_even(2), 2);
        assert_eq!(round_down_even(3), 2);
        assert_eq!(round_down_even(101), 100);
        assert_eq!(round_down_even(1920), 1920);
    }

    // ── CFR pacing: late ticks skip indices ──
    //
    // Uses fps=10 so one frame period is exactly 100_000_000 ns — no integer
    // truncation of the period, which keeps the boundary assertions exact.
    // (next_frame_index itself floors elapsed→index, so a true boundary `N/fps`
    // must map to N; an instant a hair before maps to N-1.)
    #[test]
    fn next_frame_index_skips_when_late() {
        const FPS: u32 = 10;
        const PERIOD_NS: u64 = 1_000_000_000 / FPS as u64; // 100_000_000, exact
        let start = Instant::now();
        // Instant exactly `n` periods after start, plus an optional ns nudge.
        let at = |n: u64, nudge_ns: i64| {
            let base = PERIOD_NS * n;
            let ns = (base as i64 + nudge_ns) as u64;
            start + Duration::from_nanos(ns)
        };

        // Exactly on frame 0.
        assert_eq!(next_frame_index(start, start, FPS), 0);
        // Just before frame 1 → still 0.
        assert_eq!(next_frame_index(start, at(1, -1), FPS), 0);
        // At frame 1.
        assert_eq!(next_frame_index(start, at(1, 0), FPS), 1);
        // Late by exactly 2 frame-periods → index 2 (the missed tick is skipped).
        assert_eq!(next_frame_index(start, at(2, 0), FPS), 2);
        // Late by 2.5 periods → floors to 2.
        assert_eq!(
            next_frame_index(start, at(2, (PERIOD_NS / 2) as i64), FPS),
            2
        );
        // Way behind: 7 periods.
        assert_eq!(next_frame_index(start, at(7, 0), FPS), 7);
    }

    /// Synthetic gradient frame: a moving diagonal so consecutive frames differ
    /// (helps the encoder, and proves we're feeding distinct content).
    fn gradient_bgra(w: u32, h: u32, n: u64) -> Vec<u8> {
        let mut buf = vec![0u8; (w * h * 4) as usize];
        for y in 0..h {
            for x in 0..w {
                let i = ((y * w + x) * 4) as usize;
                buf[i] = ((x + n as u32) & 0xff) as u8; // B
                buf[i + 1] = ((y + n as u32) & 0xff) as u8; // G
                buf[i + 2] = ((x + y) & 0xff) as u8; // R
                buf[i + 3] = 0xff; // A (ignored by RGB32)
            }
        }
        buf
    }

    /// Integration test — runs the REAL Media Foundation H.264 encoder on this
    /// machine. Writes ~20 gradient frames to a temp MP4 and asserts the file
    /// exists, is non-trivial, and carries the MP4 `ftyp` box at bytes 4..8.
    /// This is milestone 1's proof of the encode path.
    #[test]
    fn encode_synthetic_mp4() {
        const W: u32 = 320;
        const H: u32 = 240;
        const FPS: u32 = 10;
        const FRAMES: u64 = 20;

        let path = std::env::temp_dir().join(format!(
            "snippr_test_{}_{}.mp4",
            std::process::id(),
            // nanos to avoid collisions if the test is run repeatedly in parallel
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let path_str = path.to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&path);

        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            assert!(hr.is_ok(), "CoInitializeEx failed: {hr:?}");
            MFStartup(MF_VERSION, MFSTARTUP_FULL).expect("MFStartup failed");

            let written = encode_frames(&path_str, W, H, FPS, |n| {
                if n < FRAMES {
                    // 1:1 mapping of call index → frame index for the test.
                    Some((n, gradient_bgra(W, H, n)))
                } else {
                    None
                }
            })
            .expect("encode_frames failed");

            MFShutdown().ok();
            CoUninitialize();

            assert_eq!(written, FRAMES, "should have written every frame");
        }

        let meta = std::fs::metadata(&path).expect("output mp4 should exist");
        assert!(
            meta.len() > 10_000,
            "mp4 should be non-trivial, got {} bytes",
            meta.len()
        );

        let bytes = std::fs::read(&path).expect("read mp4");
        assert!(bytes.len() >= 8, "file too short to hold an ftyp box");
        assert_eq!(
            &bytes[4..8],
            b"ftyp",
            "MP4 should start with an ftyp box at offset 4"
        );

        let _ = std::fs::remove_file(&path);
    }
}
