import { useEffect, useState } from 'react';

/**
 * Capture `count` evenly-spaced thumbnail frames from a video URL by seeking
 * an offscreen <video> element and drawing each frame to a canvas.
 *
 * Returns an array of JPEG dataURLs (empty until all frames are ready).
 * Re-runs whenever src or count changes. Resolves to [] on any error so
 * callers never need to handle a rejection or null state.
 *
 * WHY sequential seeks on one element: the HTMLVideoElement can only be in one
 * seek at a time. Creating N elements in parallel risks GPU/memory pressure on
 * long recordings and produces inconsistent results when the decoder pipeline
 * is shared. Sequential seeks are slightly slower but predictable and cheap.
 */
export function useFilmstrip(src: string | null, count: number): string[] {
  const [thumbs, setThumbs] = useState<string[]>([]);

  useEffect(() => {
    // Reset immediately so stale frames from a previous src don't flash.
    setThumbs([]);

    if (!src || count <= 0) return;

    // Cancellation flag: set to true on cleanup so any in-progress async
    // iteration exits without calling setThumbs on an unmounted component.
    let cancelled = false;

    void captureFrames(src, count, () => cancelled).then((frames) => {
      if (!cancelled) setThumbs(frames);
    });

    return () => {
      cancelled = true;
    };
  }, [src, count]);

  return thumbs;
}

// ── implementation ─────────────────────────────────────────────────────────

/**
 * Resolve to an array of `count` JPEG dataURLs sampled at evenly-spaced
 * positions across the video duration.
 *
 * @param isCancelled - called before each async step so the loop can exit
 *   early when the calling component unmounts or src/count changes.
 */
async function captureFrames(
  src: string,
  count: number,
  isCancelled: () => boolean,
): Promise<string[]> {
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    // crossOrigin is intentionally omitted for asset: URLs (Tauri custom
    // protocol) — setting it causes a CORS preflight that the protocol
    // doesn't serve, breaking the load entirely.

    // Attach listeners BEFORE setting src so we never miss the event on a
    // fast in-memory load (e.g. blob: URLs resolve synchronously in WebView2).
    const metaReady = waitForEvent(video, 'loadedmetadata', 'error');
    video.src = src;

    await metaReady;
    if (isCancelled()) return [];

    const { duration } = video;
    if (!isFinite(duration) || duration <= 0) return [];

    // Canvas sized to ~160px wide, preserving the video aspect ratio.
    const thumbWidth = 160;
    const thumbHeight = Math.round(
      (thumbWidth / (video.videoWidth || thumbWidth)) * (video.videoHeight || thumbWidth),
    );

    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = Math.max(thumbHeight, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const frames: string[] = [];

    for (let i = 0; i < count; i++) {
      if (isCancelled()) return [];

      // Sample at the centre of each equal-width segment so edge frames
      // show something interesting rather than the black first/last frame.
      const t = ((i + 0.5) / count) * duration;

      // Attach listener BEFORE setting currentTime — same race-free pattern
      // as the loadedmetadata wait above.
      const seekDone = waitForEvent(video, 'seeked', 'error');
      video.currentTime = t;

      await seekDone;
      if (isCancelled()) return [];

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.6));
    }

    // Release the offscreen video element's resources promptly.
    video.src = '';
    video.load();

    return frames;
  } catch {
    // Never propagate: bad src, codec unsupported, network error — all resolve [].
    return [];
  }
}

/**
 * Await one of two events on an EventTarget.
 *
 * Resolves on `resolveEvent`, rejects on `rejectEvent` (causing the outer
 * try/catch to return []). Callers are responsible for triggering whatever
 * action fires the event AFTER calling this so the listener is never missed.
 */
function waitForEvent(
  target: EventTarget,
  resolveEvent: string,
  rejectEvent: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onResolve = () => {
      target.removeEventListener(resolveEvent, onResolve);
      target.removeEventListener(rejectEvent, onReject);
      resolve();
    };
    const onReject = () => {
      target.removeEventListener(resolveEvent, onResolve);
      target.removeEventListener(rejectEvent, onReject);
      reject(new Error(`${rejectEvent} on ${String(target)}`));
    };
    target.addEventListener(resolveEvent, onResolve, { once: true });
    target.addEventListener(rejectEvent, onReject, { once: true });
  });
}
