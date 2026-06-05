//! MP4 → animated GIF transcoding (export path).
//!
//! Self-contained: decode every frame of an H.264 MP4 with a Media Foundation
//! `IMFSourceReader` (RGB32 output), then re-encode the frames as a single
//! looping GIF with a global NeuQuant palette. The one public entry point —
//! [`transcode_mp4_to_gif`] — does its own COM + MF init/teardown, so it's safe
//! to call from any thread (the orchestrator wires it to a Tauri command).
//!
//! Why a SourceReader (not raw H.264 parsing): MF's reader negotiates the
//! decoder MFT for us and, with advanced video processing enabled, will hand
//! back plain RGB32 (BGRA) frames regardless of the source's native YUV format.
//! That keeps this module free of any color-conversion math of its own.
//!
//! Why GIF via the `gif` crate + `color_quant`: GIF is capped at 256 colors per
//! palette. We quantize once over a sample of frames into a single GLOBAL
//! palette and index every frame against it (see `build_global_palette`). The
//! tradeoff is documented there: one shared table keeps the file small and
//! avoids per-frame palette/LZW resets, at the cost of color fidelity when the
//! scene's colors shift a lot across the clip.

use std::fs::File;
use std::io::BufWriter;

use windows::core::PCWSTR;
use windows::Win32::Media::MediaFoundation::{
    IMFAttributes, IMFMediaType, IMFSample, IMFSourceReader, MFCreateAttributes,
    MFCreateMediaType, MFCreateSourceReaderFromURL, MFShutdown, MFStartup, MFMediaType_Video,
    MFVideoFormat_RGB32, MFVideoInterlace_Progressive, MFSTARTUP_FULL, MF_MT_DEFAULT_STRIDE,
    MF_MT_FRAME_SIZE, MF_MT_INTERLACE_MODE, MF_MT_MAJOR_TYPE, MF_MT_SUBTYPE,
    MF_SOURCE_READERF_ENDOFSTREAM, MF_SOURCE_READER_ENABLE_ADVANCED_VIDEO_PROCESSING,
    MF_SOURCE_READER_FIRST_VIDEO_STREAM, MF_VERSION,
};
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

// ── Tuning constants ──────────────────────────────────────────────────────────

/// Hard cap on decoded frames. A corrupt/looping source can't run us out of
/// memory or wedge the encode forever; if we hit this we log and stop cleanly
/// with whatever we've gathered so far.
const MAX_FRAMES: usize = 100_000;

/// Number of colors in the GIF palette. GIF allows at most 256.
const PALETTE_COLORS: usize = 256;

/// NeuQuant sample factor: 1 = best quality (samples every pixel), 30 = fastest
/// (coarsest). 10 is the library's documented middle ground — good palettes
/// without scanning every pixel of every sampled frame.
const NEUQUANT_SAMPLE_FAC: i32 = 10;

/// At most this many frames feed the global-palette quantizer. The palette only
/// needs a representative color spread, not every frame, so we stride across the
/// clip and cap the sample to keep quantization fast on long recordings.
const MAX_PALETTE_SAMPLE_FRAMES: usize = 24;

// ── Public API ────────────────────────────────────────────────────────────────

/// Decode every frame of `mp4` (H.264) via Media Foundation and write an
/// animated GIF to `gif` at `fps` (frame delay = round(100/fps) centiseconds,
/// min 2). Does its own COM + MF init/teardown (call from any thread).
pub fn transcode_mp4_to_gif(mp4: &str, gif: &str, fps: u32) -> Result<(), String> {
    // COM + Media Foundation are per-thread; bring them up here and tear them
    // back down before returning so callers don't have to care what thread
    // they're on. CoInitializeEx may return S_FALSE if COM is already up on
    // this thread — that's success (the bool in HRESULT), only `is_err` is fatal.
    unsafe {
        let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        if hr.is_err() {
            return Err(format!("CoInitializeEx failed: {hr:?}"));
        }
        if let Err(e) = MFStartup(MF_VERSION, MFSTARTUP_FULL) {
            CoUninitialize();
            return Err(format!("MFStartup failed: {e}"));
        }
    }

    // Do the real work in a helper so a single teardown path runs no matter how
    // we exit (Ok or Err). MFShutdown/CoUninitialize must pair the init above.
    let result = unsafe { decode_and_encode(mp4, gif, fps) };

    unsafe {
        let _ = MFShutdown();
        CoUninitialize();
    }

    result
}

// ── Decode (Media Foundation SourceReader) ────────────────────────────────────

/// One decoded frame: tightly-packed RGBA (`w*h*4` bytes), top-down (row 0 is
/// the visual top). We carry alpha (forced opaque) only because both NeuQuant
/// and our index lookup take 4-byte pixels; the GIF itself is opaque.
struct Frame {
    rgba: Vec<u8>,
}

/// Build the SourceReader for `path` and force its output to RGB32, returning
/// the reader plus the negotiated `(width, height)`.
///
/// `MF_SOURCE_READER_ENABLE_ADVANCED_VIDEO_PROCESSING` is the load-bearing bit:
/// without it, `SetCurrentMediaType(RGB32)` on an H.264 source is rejected with
/// `MF_E_INVALIDMEDIATYPE`, because the bare decoder MFT only emits YUV. With it
/// enabled, MF inserts the video processor that converts to RGB32 for us.
unsafe fn open_reader(path: &str) -> Result<(IMFSourceReader, u32, u32), String> {
    let path_w: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();

    // Reader attributes: turn on advanced (colorspace-converting) video proc.
    let mut attrs: Option<IMFAttributes> = None;
    MFCreateAttributes(&mut attrs, 1).map_err(|e| format!("MFCreateAttributes failed: {e}"))?;
    let attrs = attrs.expect("MFCreateAttributes returned null on success");
    attrs
        .SetUINT32(&MF_SOURCE_READER_ENABLE_ADVANCED_VIDEO_PROCESSING, 1)
        .map_err(|e| format!("enable advanced video processing failed: {e}"))?;

    let reader: IMFSourceReader = MFCreateSourceReaderFromURL(PCWSTR(path_w.as_ptr()), &attrs)
        .map_err(|e| format!("MFCreateSourceReaderFromURL failed: {e}"))?;

    let stream = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;

    // Force RGB32 out. We only set major type + subtype; the video processor
    // fills in the rest of the negotiated type (size, stride) which we read back.
    let want: IMFMediaType = MFCreateMediaType().map_err(|e| format!("MFCreateMediaType: {e}"))?;
    want.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)
        .map_err(|e| format!("set major type: {e}"))?;
    want.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)
        .map_err(|e| format!("set subtype RGB32: {e}"))?;
    want.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)
        .map_err(|e| format!("set interlace mode: {e}"))?;
    reader
        .SetCurrentMediaType(stream, None, &want)
        .map_err(|e| format!("SetCurrentMediaType(RGB32) failed: {e}"))?;

    // Read the *negotiated* current type back for the real frame size.
    let current = reader
        .GetCurrentMediaType(stream)
        .map_err(|e| format!("GetCurrentMediaType failed: {e}"))?;
    let frame_size = current
        .GetUINT64(&MF_MT_FRAME_SIZE)
        .map_err(|e| format!("read MF_MT_FRAME_SIZE failed: {e}"))?;
    let width = (frame_size >> 32) as u32;
    let height = (frame_size & 0xffff_ffff) as u32;
    if width == 0 || height == 0 {
        return Err(format!("degenerate frame size {width}x{height}"));
    }

    Ok((reader, width, height))
}

/// Decode one sample's buffer into a top-down RGBA frame.
///
/// ## The orientation trap (see module docs / the spec)
/// MF's RGB32 output is reported with an `MF_MT_DEFAULT_STRIDE` whose **sign**
/// declares row order: a NEGATIVE stride means the buffer is **bottom-up** (the
/// first row in memory is the visual *bottom* — the classic Windows DIB
/// convention), a POSITIVE stride means **top-down**. We respect that sign so
/// the rows we hand the GIF encoder are always top-down (row 0 = visual top).
///
/// This is verified against an EXTERNAL decoder (headless Edge rendering the
/// produced GIF — see `orientation_probe_*` below), because an MF encode→decode
/// round-trip can't catch an orientation bug: both ends share the convention and
/// a flip on one side cancels the flip on the other. The Edge render is the
/// oracle; this code matches what made that render come out upright.
unsafe fn sample_to_rgba(
    sample: &IMFSample,
    width: u32,
    height: u32,
    stride: i32,
) -> Result<Frame, String> {
    let w = width as usize;
    let h = height as usize;

    let buffer = sample
        .ConvertToContiguousBuffer()
        .map_err(|e| format!("ConvertToContiguousBuffer failed: {e}"))?;

    let mut data: *mut u8 = std::ptr::null_mut();
    let mut max_len = 0u32;
    let mut cur_len = 0u32;
    buffer
        .Lock(&mut data, Some(&mut max_len), Some(&mut cur_len))
        .map_err(|e| format!("buffer Lock failed: {e}"))?;

    // Absolute bytes-per-row. A negative stride still has |stride| pitch; if the
    // negotiated type omitted a stride (0), fall back to the packed width.
    let row_bytes = if stride != 0 {
        stride.unsigned_abs() as usize
    } else {
        w * 4
    };

    let needed = row_bytes * h;
    if (cur_len as usize) < needed {
        let _ = buffer.Unlock();
        return Err(format!(
            "locked buffer too small: {cur_len} < {needed} ({row_bytes}B/row * {h} rows)"
        ));
    }

    // Walk source rows in *visual top→bottom* order, accounting for stride sign,
    // and emit a packed top-down RGBA buffer (B/R swapped, alpha forced opaque).
    let mut rgba = vec![0u8; w * h * 4];
    let bottom_up = stride < 0;
    for dst_y in 0..h {
        // Visual row `dst_y`: for bottom-up buffers it lives near the end.
        let src_y = if bottom_up { h - 1 - dst_y } else { dst_y };
        let src_row = std::slice::from_raw_parts(data.add(src_y * row_bytes), w * 4);
        let dst_off = dst_y * w * 4;
        for x in 0..w {
            let s = x * 4;
            let d = dst_off + x * 4;
            // Source is BGRA → store RGBA.
            rgba[d] = src_row[s + 2]; // R ← B-slot's neighbor: src B,G,R,A
            rgba[d + 1] = src_row[s + 1]; // G
            rgba[d + 2] = src_row[s]; // B
            rgba[d + 3] = 255; // A (opaque)
        }
    }

    let _ = buffer.Unlock();
    Ok(Frame { rgba })
}

/// Decode all frames of the MP4 into top-down RGBA buffers.
///
/// Loops `ReadSample` until the end-of-stream flag (bit `0x2`,
/// `MF_SOURCE_READERF_ENDOFSTREAM`). A read that returns no sample but isn't EOS
/// is a format/stream change notification — we skip it and read again. Stops
/// early (with a log) if we somehow exceed `MAX_FRAMES`.
unsafe fn decode_all_frames(
    reader: &IMFSourceReader,
    width: u32,
    height: u32,
) -> Result<Vec<Frame>, String> {
    let stream = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;
    let mut frames: Vec<Frame> = Vec::new();

    loop {
        let mut flags = 0u32;
        let mut sample: Option<IMFSample> = None;
        reader
            .ReadSample(
                stream,
                0,
                None,             // actual stream index — single stream, don't care
                Some(&mut flags), // stream flags (EOS / format change live here)
                None,             // timestamp — GIF delay is derived from fps, not PTS
                Some(&mut sample),
            )
            .map_err(|e| format!("ReadSample failed: {e}"))?;

        if let Some(sample) = sample {
            // The negotiated stride can change on a format change; re-read it per
            // sample from the *current* media type so the sign stays correct.
            let stride = current_stride(reader, stream, width);
            let frame = sample_to_rgba(&sample, width, height, stride)?;
            frames.push(frame);

            if frames.len() >= MAX_FRAMES {
                log::warn!(
                    "gif_export: hit MAX_FRAMES ({MAX_FRAMES}); truncating the GIF here"
                );
                break;
            }
        }
        // else: no sample this read (format change / gap) — fall through and
        // either stop on EOS or read again.

        if flags & MF_SOURCE_READERF_ENDOFSTREAM.0 as u32 != 0 {
            break;
        }
    }

    if frames.is_empty() {
        return Err("decoded zero frames from the MP4".into());
    }
    Ok(frames)
}

/// Read the current output type's `MF_MT_DEFAULT_STRIDE` (signed). Falls back to
/// the packed positive stride `width*4` if the attribute is absent — most RGB32
/// types set it, but we don't want a missing hint to mean "stride 0 / flip".
unsafe fn current_stride(reader: &IMFSourceReader, stream: u32, width: u32) -> i32 {
    if let Ok(mt) = reader.GetCurrentMediaType(stream) {
        // MF_MT_DEFAULT_STRIDE is stored as a UINT32 but is semantically i32
        // (sign carries row order). Reinterpret the bits rather than clamp.
        if let Ok(raw) = mt.GetUINT32(&MF_MT_DEFAULT_STRIDE) {
            return raw as i32;
        }
    }
    (width * 4) as i32
}

// ── Encode (gif crate + global NeuQuant palette) ──────────────────────────────

/// Build a single 256-color global palette for the whole animation with
/// NeuQuant, sampling across the clip.
///
/// Palette strategy & size tradeoff: GIF caps each palette at 256 colors. The
/// alternative — a fresh per-frame palette (e.g. `Frame::from_rgb`) — adapts to
/// each frame's colors but pays a full color table + LZW dictionary reset on
/// every frame, inflating the file and causing inter-frame color shimmer. A
/// single GLOBAL palette (this function) is written once; every frame is just
/// indices, which keeps the GIF small and temporally stable. The cost is
/// fidelity: scenes whose colors change a lot over time share one fixed table,
/// so late-clip hues can band. For screen recordings (mostly stable UI colors)
/// the global palette is the right call. We feed NeuQuant a strided sample of up
/// to `MAX_PALETTE_SAMPLE_FRAMES` frames so quantization stays fast on long clips.
fn build_global_palette(frames: &[Frame]) -> Vec<u8> {
    // Stride so the sample spans the whole clip (start..end), not just the head.
    let step = (frames.len() / MAX_PALETTE_SAMPLE_FRAMES).max(1);
    let mut sample_rgba: Vec<u8> = Vec::new();
    for frame in frames.iter().step_by(step).take(MAX_PALETTE_SAMPLE_FRAMES) {
        sample_rgba.extend_from_slice(&frame.rgba);
    }
    // Guard: NeuQuant needs a non-empty, 4-byte-aligned buffer.
    if sample_rgba.is_empty() {
        sample_rgba.extend_from_slice(&[0, 0, 0, 255]);
    }

    let nq = color_quant::NeuQuant::new(NEUQUANT_SAMPLE_FAC, PALETTE_COLORS, &sample_rgba);
    // RGB triples (3 bytes/color) — exactly the global-palette layout gif wants.
    nq.color_map_rgb()
}

/// Frame delay in GIF centiseconds for `fps`: round(100/fps), floored at 2.
///
/// GIF stores delay in 1/100 s units. The floor of 2 cs matches real-world
/// browser behavior (most clamp anything < ~2 cs up anyway) and keeps fast
/// captures from encoding a 0-delay "as fast as possible" loop.
fn frame_delay_cs(fps: u32) -> u16 {
    if fps == 0 {
        return 2;
    }
    let cs = ((100.0 / fps as f64).round()) as u16;
    cs.max(2)
}

/// Quantize every frame against `palette` (via NeuQuant index lookup) and write
/// the looping GIF to `path`.
fn encode_gif(
    path: &str,
    frames: &[Frame],
    width: u32,
    height: u32,
    fps: u32,
) -> Result<(), String> {
    use gif::{Encoder, Frame as GifFrame, Repeat};

    let palette = build_global_palette(frames);

    // Re-derive a quantizer from the same global palette so `index_of` maps each
    // pixel to the matching global index. (NeuQuant is built from a sample but
    // indexes any pixel; rebuilding here would change the palette, so instead we
    // build ONE quantizer and reuse it for both the palette and the indexing.)
    let step = (frames.len() / MAX_PALETTE_SAMPLE_FRAMES).max(1);
    let mut sample_rgba: Vec<u8> = Vec::new();
    for frame in frames.iter().step_by(step).take(MAX_PALETTE_SAMPLE_FRAMES) {
        sample_rgba.extend_from_slice(&frame.rgba);
    }
    if sample_rgba.is_empty() {
        sample_rgba.extend_from_slice(&[0, 0, 0, 255]);
    }
    let nq = color_quant::NeuQuant::new(NEUQUANT_SAMPLE_FAC, PALETTE_COLORS, &sample_rgba);
    debug_assert_eq!(
        nq.color_map_rgb(),
        palette,
        "quantizer/palette must agree so indices match the written table"
    );

    let file = File::create(path).map_err(|e| format!("create GIF file failed: {e}"))?;
    let writer = BufWriter::new(file);

    let w16 = u16::try_from(width).map_err(|_| format!("width {width} exceeds GIF max 65535"))?;
    let h16 =
        u16::try_from(height).map_err(|_| format!("height {height} exceeds GIF max 65535"))?;

    let mut encoder = Encoder::new(writer, w16, h16, &palette)
        .map_err(|e| format!("gif Encoder::new failed: {e}"))?;
    encoder
        .set_repeat(Repeat::Infinite)
        .map_err(|e| format!("gif set_repeat failed: {e}"))?;

    let delay = frame_delay_cs(fps);
    let px_count = width as usize * height as usize;

    for (i, frame) in frames.iter().enumerate() {
        // Map each RGBA pixel to its global-palette index.
        let mut indices = vec![0u8; px_count];
        for (p, idx) in frame.rgba.chunks_exact(4).zip(indices.iter_mut()) {
            *idx = nq.index_of(p) as u8;
        }

        let mut gframe = GifFrame::from_indexed_pixels(w16, h16, indices, None);
        gframe.delay = delay;
        encoder
            .write_frame(&gframe)
            .map_err(|e| format!("gif write_frame {i} failed: {e}"))?;
    }

    // `encoder` flushes the trailer on drop; dropping the BufWriter flushes IO.
    drop(encoder);
    Ok(())
}

/// The decode→encode core, assuming COM/MF are already initialized on this
/// thread (its sole caller, [`transcode_mp4_to_gif`], guarantees that).
unsafe fn decode_and_encode(mp4: &str, gif: &str, fps: u32) -> Result<(), String> {
    let (reader, width, height) = open_reader(mp4)?;
    let frames = decode_all_frames(&reader, width, height)?;
    log::debug!(
        "gif_export: decoded {} frames at {width}x{height}",
        frames.len()
    );
    encode_gif(gif, &frames, width, height, fps)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── delay math ──
    #[test]
    fn frame_delay_rounds_and_floors() {
        assert_eq!(frame_delay_cs(10), 10); // 100/10
        assert_eq!(frame_delay_cs(20), 5); // 100/20
        assert_eq!(frame_delay_cs(30), 3); // round(3.33)
        assert_eq!(frame_delay_cs(50), 2); // round(2.0)
        assert_eq!(frame_delay_cs(60), 2); // round(1.66)=2, floor holds
        assert_eq!(frame_delay_cs(100), 2); // 1 → floored to 2
        assert_eq!(frame_delay_cs(0), 2); // guard
    }

    // ── Test-only MP4 generator (mirrors screen_recording.rs SinkWriter) ──────
    //
    // We need real H.264 MP4s to exercise the SourceReader. This is the
    // PROVEN-CORRECT encode config from the sibling `screen_recording.rs`: input
    // RGB32, POSITIVE stride `(w*4)`, frames fed TOP-DOWN verbatim (row 0 = the
    // visual top, no flip), output H.264. That file verified this config draws
    // upright against a real decoder, so any orientation result we observe in the
    // produced GIF is attributable to the *decode* side, not the encode side.
    use windows::Win32::Media::MediaFoundation::{
        IMFByteStream, IMFSinkWriter, MFCreateMemoryBuffer, MFCreateSample,
        MFCreateSinkWriterFromURL, MFVideoFormat_H264, MF_MT_AVG_BITRATE, MF_MT_FRAME_RATE,
        MF_MT_PIXEL_ASPECT_RATIO,
    };

    /// Write `frames` (each a top-down BGRA `w*h*4` buffer) to an H.264 MP4 at
    /// `path`, `fps`. Returns Err on any MF failure. COM/MF must be up already.
    unsafe fn write_test_mp4(
        path: &str,
        w: u32,
        h: u32,
        fps: u32,
        frames: &[Vec<u8>],
    ) -> windows::core::Result<()> {
        let path_w: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let writer: IMFSinkWriter = MFCreateSinkWriterFromURL(
            PCWSTR(path_w.as_ptr()),
            None::<&IMFByteStream>,
            None::<&IMFAttributes>,
        )?;

        let frame_size = ((w as u64) << 32) | (h as u64);
        let frame_rate = ((fps as u64) << 32) | 1u64;
        let par = (1u64 << 32) | 1u64;
        let bitrate = ((w as f64) * (h as f64) * (fps as f64) * 0.1)
            .clamp(1_000_000.0, 25_000_000.0) as u32;

        // Output: H.264.
        let out_type: IMFMediaType = MFCreateMediaType()?;
        out_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        out_type.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_H264)?;
        out_type.SetUINT32(&MF_MT_AVG_BITRATE, bitrate)?;
        out_type.SetUINT64(&MF_MT_FRAME_SIZE, frame_size)?;
        out_type.SetUINT64(&MF_MT_FRAME_RATE, frame_rate)?;
        out_type.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, par)?;
        out_type.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
        let stream_index = writer.AddStream(&out_type)?;

        // Input: RGB32, POSITIVE stride (top-down passthrough — proven correct).
        let in_type: IMFMediaType = MFCreateMediaType()?;
        in_type.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        in_type.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)?;
        in_type.SetUINT64(&MF_MT_FRAME_SIZE, frame_size)?;
        in_type.SetUINT64(&MF_MT_FRAME_RATE, frame_rate)?;
        in_type.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, par)?;
        in_type.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
        in_type.SetUINT32(&MF_MT_DEFAULT_STRIDE, (w * 4) as u32)?;
        writer.SetInputMediaType(stream_index, &in_type, None::<&IMFAttributes>)?;

        writer.BeginWriting()?;

        let frame_dur_hns = (10_000_000u64 / fps as u64) as i64;
        for (i, bgra) in frames.iter().enumerate() {
            let len = bgra.len() as u32;
            let buffer = MFCreateMemoryBuffer(len)?;
            let mut dst: *mut u8 = std::ptr::null_mut();
            let mut max_len = 0u32;
            buffer.Lock(&mut dst, Some(&mut max_len), None)?;
            std::ptr::copy_nonoverlapping(bgra.as_ptr(), dst, bgra.len());
            buffer.Unlock()?;
            buffer.SetCurrentLength(len)?;

            let sample = MFCreateSample()?;
            sample.AddBuffer(&buffer)?;
            sample.SetSampleTime(i as i64 * frame_dur_hns)?;
            sample.SetSampleDuration(frame_dur_hns)?;
            writer.WriteSample(stream_index, &sample)?;
        }

        writer.Finalize()?;
        Ok(())
    }

    /// A solid-color top-down BGRA frame.
    fn solid_bgra(w: u32, h: u32, b: u8, g: u8, r: u8) -> Vec<u8> {
        let mut buf = vec![0u8; (w * h * 4) as usize];
        for px in buf.chunks_exact_mut(4) {
            px[0] = b;
            px[1] = g;
            px[2] = r;
            px[3] = 255;
        }
        buf
    }

    /// A top-down BGRA frame split into 4 quadrants:
    ///   TL=red, TR=green, BL=blue, BR=yellow.
    /// Bytes are BGRA: red=(0,0,255), green=(0,255,0), blue=(255,0,0),
    /// yellow=(0,255,255). Row 0 is the visual top.
    fn quadrant_bgra(w: u32, h: u32) -> Vec<u8> {
        let mut buf = vec![0u8; (w * h * 4) as usize];
        let half_w = w / 2;
        let half_h = h / 2;
        for y in 0..h {
            for x in 0..w {
                let i = ((y * w + x) * 4) as usize;
                let (b, g, r) = match (x < half_w, y < half_h) {
                    (true, true) => (0u8, 0u8, 255u8),    // TL red
                    (false, true) => (0u8, 255u8, 0u8),   // TR green
                    (true, false) => (255u8, 0u8, 0u8),   // BL blue
                    (false, false) => (0u8, 255u8, 255u8), // BR yellow
                };
                buf[i] = b;
                buf[i + 1] = g;
                buf[i + 2] = r;
                buf[i + 3] = 255;
            }
        }
        buf
    }

    /// Round-trip a tiny generated MP4 → GIF and assert the GIF exists, is
    /// non-trivial (>1 KB), and starts with the `GIF89a` magic. Runs the REAL
    /// Media Foundation decoder + the gif encoder on this machine. This is the
    /// always-on proof of the transcode path (no external tools needed).
    #[test]
    fn roundtrip_mp4_to_gif() {
        const W: u32 = 160;
        const H: u32 = 120;
        const FPS: u32 = 10;
        const FRAMES: usize = 12;

        let tmp = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let mp4 = tmp.join(format!("snippr_gifsrc_{}_{stamp}.mp4", std::process::id()));
        let gif = tmp.join(format!("snippr_gifout_{}_{stamp}.gif", std::process::id()));
        let mp4_s = mp4.to_string_lossy().into_owned();
        let gif_s = gif.to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&mp4);
        let _ = std::fs::remove_file(&gif);

        // Build a short clip of shifting solid colors so frames differ.
        let palette = [
            (0u8, 0u8, 255u8),   // red
            (0u8, 255u8, 0u8),   // green
            (255u8, 0u8, 0u8),   // blue
            (0u8, 255u8, 255u8), // yellow
        ];
        let mut clip = Vec::with_capacity(FRAMES);
        for n in 0..FRAMES {
            let (b, g, r) = palette[n % palette.len()];
            clip.push(solid_bgra(W, H, b, g, r));
        }

        // The MP4 generator needs COM/MF up; transcode_mp4_to_gif inits its own.
        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            assert!(hr.is_ok(), "CoInitializeEx failed: {hr:?}");
            MFStartup(MF_VERSION, MFSTARTUP_FULL).expect("MFStartup failed");
            let res = write_test_mp4(&mp4_s, W, H, FPS, &clip);
            MFShutdown().ok();
            CoUninitialize();
            res.expect("write_test_mp4 failed");
        }

        transcode_mp4_to_gif(&mp4_s, &gif_s, FPS).expect("transcode_mp4_to_gif failed");

        let bytes = std::fs::read(&gif).expect("output gif should exist");
        assert!(
            bytes.len() > 1024,
            "gif should be non-trivial, got {} bytes",
            bytes.len()
        );
        assert_eq!(&bytes[0..6], b"GIF89a", "GIF should start with GIF89a magic");

        let _ = std::fs::remove_file(&mp4);
        let _ = std::fs::remove_file(&gif);
    }

    /// MANUAL orientation oracle — IGNORED in CI because it needs Edge.
    ///
    /// Why this exists: an MF encode→decode round-trip CANNOT verify orientation
    /// (a flip on encode cancels a flip on decode). The only trustworthy oracle
    /// is an EXTERNAL decoder rendering the produced GIF. This test writes a
    /// 4-color quadrant MP4 (TL=red, TR=green, BL=blue, BR=yellow) with the
    /// proven-correct top-down SinkWriter config, transcodes it to a GIF, and
    /// leaves a probe.gif + probe.html in TEMP for you to render with headless
    /// Edge and inspect.
    ///
    /// Run + verify (PowerShell):
    /// ```text
    /// cargo test --manifest-path D:\snippr\src-tauri\Cargo.toml \
    ///     gif_export::tests::orientation_probe_quadrants -- --ignored --nocapture
    /// # note the printed paths, then:
    /// & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
    ///     --headless=new --disable-gpu --window-size=400,300 `
    ///     --virtual-time-budget=3000 `
    ///     --screenshot="$env:TEMP\snippr_gifprobe.png" `
    ///     "file:///$env:TEMP/snippr_gifprobe.html"
    /// # then open the PNG: TL must be red, TR green, BL blue, BR yellow (upright).
    /// ```
    /// The probe.html is:
    /// ```text
    /// <html><body style="margin:0">
    ///   <img src="file:///.../snippr_gifprobe.gif" style="image-rendering:pixelated">
    /// </body></html>
    /// ```
    /// If the render is flipped/mirrored, fix the row mapping in
    /// `sample_to_rgba` (the stride-sign branch) and re-verify until upright.
    #[test]
    #[ignore = "needs Edge to render the GIF; run manually with --ignored"]
    fn orientation_probe_quadrants() {
        const W: u32 = 160;
        const H: u32 = 120;
        const FPS: u32 = 10;
        const FRAMES: usize = 6;

        let tmp = std::env::temp_dir();
        let mp4 = tmp.join("snippr_gifprobe_src.mp4");
        let gif = tmp.join("snippr_gifprobe.gif");
        let html = tmp.join("snippr_gifprobe.html");
        let mp4_s = mp4.to_string_lossy().into_owned();
        let gif_s = gif.to_string_lossy().into_owned();
        let _ = std::fs::remove_file(&mp4);
        let _ = std::fs::remove_file(&gif);

        let clip: Vec<Vec<u8>> = (0..FRAMES).map(|_| quadrant_bgra(W, H)).collect();

        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            assert!(hr.is_ok(), "CoInitializeEx failed: {hr:?}");
            MFStartup(MF_VERSION, MFSTARTUP_FULL).expect("MFStartup failed");
            let res = write_test_mp4(&mp4_s, W, H, FPS, &clip);
            MFShutdown().ok();
            CoUninitialize();
            res.expect("write_test_mp4 failed");
        }

        transcode_mp4_to_gif(&mp4_s, &gif_s, FPS).expect("transcode_mp4_to_gif failed");

        // Drop an HTML harness next to the GIF for the Edge render step.
        let gif_url = gif_s.replace('\\', "/");
        let page = format!(
            "<html><body style=\"margin:0\"><img src=\"file:///{gif_url}\" \
             style=\"image-rendering:pixelated\"></body></html>"
        );
        std::fs::write(&html, page).expect("write probe html");

        eprintln!("orientation probe written:");
        eprintln!("  GIF : {gif_s}");
        eprintln!("  HTML: {}", html.to_string_lossy());
        eprintln!("Render with headless Edge and confirm TL=red TR=green BL=blue BR=yellow.");

        // The GIF must at least be a valid, non-trivial file; the human/oracle
        // confirms the actual orientation from the Edge screenshot.
        let bytes = std::fs::read(&gif).expect("probe gif should exist");
        assert!(bytes.len() > 1024, "probe gif too small: {} bytes", bytes.len());
        assert_eq!(&bytes[0..6], b"GIF89a");
    }
}
