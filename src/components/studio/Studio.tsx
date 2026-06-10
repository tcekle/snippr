import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { showToast } from '../Toast';
import {
  ST, StudioShell, PreviewFrame, TransportBar, TimeRuler, TrackLane,
  ClipView, PlayheadView, Field, NumChip,
} from './StudioAtoms';
import { useFilmstrip } from './useFilmstrip';

/** Matches studio.rs RecordingInfo (serde keeps snake_case field names). */
interface RecordingInfo { duration_ms: number; width: number; height: number; fps: number }

const HEADER_W = 150;
const MIN_TRIM_GAP = 0.2; // seconds — keeps the handles from crossing
const HANDLE_HIT_PX = 9;

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const tenth = Math.floor((t % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenth}`;
}

type Drag = { kind: 'seek' | 'in' | 'out' } | null;

/** snippr Studio — the recording editor, embedded as a video tab in the main
 *  editor window. v1 scope: real playback + scrubbing of the saved mp4, trim
 *  in/out on the timeline, and a re-encoded trimmed export. Single Screen
 *  track: recordings are video-only, so the mock's webcam/mic lanes have
 *  nothing to show yet.
 *
 *  Instances stay mounted (hidden) while their tab is inactive so the trim
 *  points and playhead survive tab switches; `active` gates the keyboard. */
export function Studio({ path, active }: { path: string; active: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [info, setInfo] = useState<RecordingInfo | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // The timeline block (ruler + lanes). All scrub/trim pointer math happens
  // here geometrically — the atoms are render-only, same split as the crop UI.
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag>(null);
  const [hoverCursor, setHoverCursor] = useState('default');

  const thumbs = useFilmstrip(src, 8);

  // `open_video` already granted the asset protocol access to this path;
  // convertFileSrc turns it into a streamable asset: URL.
  useEffect(() => {
    // try/catch: outside Tauri (plain-browser preview) the API internals are
    // absent and these THROW synchronously instead of rejecting.
    try {
      setSrc(convertFileSrc(path));
    } catch {
      setLoadError('No recording to edit (not running under Tauri)');
      return;
    }
    try {
      invoke<RecordingInfo>('probe_recording', { path })
        .then(setInfo)
        .catch(() => { /* inspector just omits w×h/fps */ });
    } catch { /* plain browser */ }
  }, [path]);

  // Deactivated tab: freeze playback (the element stays mounted, just hidden).
  useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);

  // ── playback ──────────────────────────────────────────────────────────────

  const clampTime = useCallback((t: number) => Math.max(0, Math.min(t, duration || 0)), [duration]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const ct = Math.max(0, Math.min(t, (duration || 0) - 0.001));
    v.currentTime = ct;
    setCurrent(ct);
  }, [duration]);

  const playPause = useCallback(() => {
    const v = videoRef.current;
    if (!v || !duration) return;
    if (v.paused) {
      // Play means "play the trimmed result": restart inside the trim range
      // when the playhead sits outside it.
      if (v.currentTime >= trimOut - 0.05 || v.currentTime < trimIn - 0.05) {
        v.currentTime = trimIn;
        setCurrent(trimIn);
      }
      void v.play();
    } else {
      v.pause();
    }
  }, [duration, trimIn, trimOut]);

  // Playhead follows the video clock; playback auto-stops at the out point so
  // the preview is the trimmed result.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.currentTime >= trimOut) {
        v.pause();
        v.currentTime = trimOut;
        setCurrent(trimOut);
        return;
      }
      setCurrent(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, trimOut]);

  // ── timeline pointer interactions (geometric, atoms are visual-only) ──────

  /** px → seconds across the lane area (right of the track headers). */
  const timeAt = useCallback((clientX: number) => {
    const el = surfaceRef.current;
    if (!el || !duration) return 0;
    const r = el.getBoundingClientRect();
    const frac = (clientX - r.left - HEADER_W) / Math.max(1, r.width - HEADER_W);
    return clampTime(frac * duration);
  }, [duration, clampTime]);

  const handleXs = useCallback(() => {
    const el = surfaceRef.current;
    if (!el || !duration) return null;
    const r = el.getBoundingClientRect();
    const laneW = r.width - HEADER_W;
    return {
      inX: r.left + HEADER_W + (trimIn / duration) * laneW,
      outX: r.left + HEADER_W + (trimOut / duration) * laneW,
    };
  }, [duration, trimIn, trimOut]);

  const onSurfaceDown = useCallback((e: React.PointerEvent) => {
    if (!duration) return;
    const xs = handleXs();
    if (xs && Math.abs(e.clientX - xs.inX) <= HANDLE_HIT_PX) drag.current = { kind: 'in' };
    else if (xs && Math.abs(e.clientX - xs.outX) <= HANDLE_HIT_PX) drag.current = { kind: 'out' };
    else {
      drag.current = { kind: 'seek' };
      seek(timeAt(e.clientX));
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [duration, handleXs, seek, timeAt]);

  const onSurfaceMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) {
      const xs = handleXs();
      setHoverCursor(
        xs && (Math.abs(e.clientX - xs.inX) <= HANDLE_HIT_PX || Math.abs(e.clientX - xs.outX) <= HANDLE_HIT_PX)
          ? 'ew-resize'
          : e.clientX - (surfaceRef.current?.getBoundingClientRect().left ?? 0) > HEADER_W ? 'crosshair' : 'default',
      );
      return;
    }
    const t = timeAt(e.clientX);
    if (drag.current.kind === 'seek') seek(t);
    else if (drag.current.kind === 'in') setTrimIn(Math.min(t, trimOut - MIN_TRIM_GAP));
    else setTrimOut(Math.max(t, trimIn + MIN_TRIM_GAP));
  }, [handleXs, timeAt, seek, trimIn, trimOut]);

  const onSurfaceUp = useCallback(() => { drag.current = null; }, []);

  // ── keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!duration) return;
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      const step = e.shiftKey ? 5 : 1 / (info?.fps || 30);
      switch (e.key) {
        case ' ': e.preventDefault(); playPause(); break;
        case 'ArrowLeft': e.preventDefault(); seek(current - step); break;
        case 'ArrowRight': e.preventDefault(); seek(current + step); break;
        case 'Home': e.preventDefault(); seek(0); break;
        case 'End': e.preventDefault(); seek(duration); break;
        case 'i': case 'I': setTrimIn(Math.min(current, trimOut - MIN_TRIM_GAP)); break;
        case 'o': case 'O': setTrimOut(Math.max(current, trimIn + MIN_TRIM_GAP)); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, duration, current, trimIn, trimOut, info, playPause, seek]);

  // ── export ────────────────────────────────────────────────────────────────

  const exportTrim = useCallback(async () => {
    if (!path || !duration || exporting) return;
    try {
      const target = await save({
        defaultPath: path.replace(/\.mp4$/i, '') + '_trim.mp4',
        filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
      });
      if (!target) return;
      setExporting(true);
      const out = await invoke<string>('trim_recording', {
        input: path,
        output: target,
        startMs: trimIn * 1000,
        endMs: trimOut * 1000,
      });
      showToast(`Exported: ${out}`);
    } catch (e) {
      showToast(String(e), true);
    } finally {
      setExporting(false);
    }
  }, [path, duration, exporting, trimIn, trimOut]);

  // ── render ────────────────────────────────────────────────────────────────

  const fileName = path.split(/[\\/]/).pop() ?? path;
  const trimmed = duration > 0 && (trimIn > 0.05 || trimOut < duration - 0.05);
  const badge = info
    ? `${fmt(duration)} · ${info.width}×${info.height} · ${Math.round(info.fps)}fps`
    : duration ? fmt(duration) : undefined;

  const inspector = (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
      <Field label="Duration">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NumChip>{fmt(duration)}</NumChip>
          {info && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {info.width}×{info.height} · {Math.round(info.fps)}fps
            </span>
          )}
        </div>
      </Field>
      <Field label="Trim">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <NumChip>{fmt(trimIn)}</NumChip>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>→</span>
          <NumChip>{fmt(trimOut)}</NumChip>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>({fmt(Math.max(0, trimOut - trimIn))})</span>
        </div>
      </Field>
      <button
        onClick={() => { void exportTrim(); }}
        disabled={!duration || exporting}
        style={{
          background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 7,
          padding: '8px 0', fontSize: 12.5, fontWeight: 700,
          cursor: duration && !exporting ? 'pointer' : 'default',
          opacity: duration && !exporting ? 1 : 0.55,
        }}
      >
        {exporting ? 'Exporting…' : trimmed ? 'Export trimmed MP4' : 'Export MP4'}
      </button>
      <div style={{
        fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5,
        borderTop: `1px solid ${ST.line}`, paddingTop: 12,
      }}>
        Drag the white handles to trim · drag the timeline to scrub · Space plays the
        trimmed range · I / O set in &amp; out at the playhead. Export re-encodes, so
        cuts are frame-accurate.
      </div>
    </div>
  );

  const timeline = (
    <div
      ref={surfaceRef}
      style={{ position: 'relative', cursor: hoverCursor }}
      onPointerDown={onSurfaceDown}
      onPointerMove={onSurfaceMove}
      onPointerUp={onSurfaceUp}
      onPointerCancel={onSurfaceUp}
    >
      <TimeRuler duration={duration} headerWidth={HEADER_W} />
      <TrackLane name="Screen" color={ST.video} height={64} headerWidth={HEADER_W}>
        <ClipView
          leftPct={0} widthPct={100}
          label={fileName}
          thumbs={thumbs}
          selected
          trimStartFrac={duration ? trimIn / duration : 0}
          trimEndFrac={duration ? trimOut / duration : 1}
        />
      </TrackLane>
      <PlayheadView frac={duration ? current / duration : 0} headerWidth={HEADER_W} />
    </div>
  );

  return (
    <StudioShell
      title={fileName}
      recBadge={badge}
      preview={
        <PreviewFrame>
          {src && !loadError ? (
            <video
              ref={videoRef}
              src={src}
              muted
              preload="auto"
              style={{
                display: 'block',
                maxWidth: '100%', maxHeight: '100%',
                borderRadius: 8,
                background: '#000',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              }}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) {
                  setDuration(d);
                  setTrimOut(d);
                }
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setLoadError('Could not load the recording')}
              onClick={playPause}
            />
          ) : (
            <div style={{
              color: 'var(--color-text-muted)', fontSize: 13, padding: 60,
              background: '#0d0d12', borderRadius: 8,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}>
              {loadError ?? 'Loading…'}
            </div>
          )}
        </PreviewFrame>
      }
      transport={
        <TransportBar
          playing={playing}
          tc={fmt(current)}
          dur={fmt(duration)}
          onPlayPause={playPause}
          onSkipStart={() => seek(trimIn)}
          onSkipEnd={() => seek(trimOut)}
        />
      }
      inspector={inspector}
      timeline={timeline}
    />
  );
}
