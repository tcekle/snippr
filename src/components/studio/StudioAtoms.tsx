/**
 * StudioAtoms.tsx — pure presentational atoms for snippr Studio.
 *
 * PURE: no state beyond trivial hover, no pointer-gesture math, no
 * @tauri-apps imports. All sizing/position is passed as derived props
 * (percentages, fractions) from the container that owns drag state.
 *
 * Palette: local ST object (extends the app CSS vars where convenient).
 * Styling: inline style={{...}} throughout, matching the app idiom.
 */

import React from 'react';

// ── Palette ────────────────────────────────────────────────────────────────

/** Studio-specific colour tokens, ported verbatim from the record-studio.jsx
 *  mock so the container and any future components share one source of truth. */
export const ST: Record<string, string> = {
  bg:         '#121217',
  rail:       '#1b1b22',
  trackBg:    '#191920',
  trackAlt:   '#15151b',
  header:     '#23232c',
  line:       '#33333f',
  ruler:      '#1d1d25',
  video:      '#2f6fd0',   // V1 screen clip
  videoEdge:  '#5b93e8',
  cam:        '#7c5cff',   // webcam PiP
  zoom:       '#e0922b',   // auto-zoom track
  audio:      '#1f9d57',   // mic
  audioSys:   '#13794a',   // system audio
  wave:       '#7ff0b0',
  playhead:   '#ff453a',
  marker:     '#ffd60a',
};

// ── StudioShell ────────────────────────────────────────────────────────────

export interface StudioShellProps {
  /** File name shown in the toolbar title area. */
  title: string;
  /** Optional badge on the right of the toolbar, e.g. "0:48 · 1280×800 · 60fps". */
  recBadge?: string;
  /** Slot at the far right of the toolbar (e.g. Export button). */
  toolbarRight?: React.ReactNode;
  preview: React.ReactNode;
  transport: React.ReactNode;
  inspector?: React.ReactNode;
  /** Pixel width of the inspector column. Defaults to 252. */
  inspectorWidth?: number;
  timeline: React.ReactNode;
}

/**
 * Full studio layout shell: toolbar row, preview + inspector side-by-side,
 * transport row beneath the preview, and the timeline block at the bottom.
 *
 * The shell does NOT draw a fake OS titlebar — the real window keeps native
 * decorations. The top row is the studio toolbar only (title + recBadge slot
 * + toolbarRight), matching the "top toolbar" row from the mock minus the
 * Record pill (which belongs to the container's toolbar actions).
 */
export function StudioShell({
  title,
  recBadge,
  toolbarRight,
  preview,
  transport,
  inspector,
  inspectorWidth = 252,
  timeline,
}: StudioShellProps): React.JSX.Element {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: ST.bg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: 'var(--color-text)',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Studio toolbar */}
      <div style={{
        height: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 10,
        background: ST.rail,
        borderBottom: `1px solid ${ST.line}`,
      }}>
        <span style={{ fontSize: 12.5, color: 'var(--color-text)', fontWeight: 600 }}>
          {title}
        </span>
        {recBadge && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--color-text-muted)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: 4,
              background: ST.playhead, flexShrink: 0,
            }} />
            {recBadge}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {toolbarRight}
      </div>

      {/* Preview area + optional inspector */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Preview column: player + transport */}
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column',
          background: ST.bg,
        }}>
          <div style={{
            flex: 1, minHeight: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 18,
          }}>
            {preview}
          </div>
          {/* Transport row */}
          <div style={{
            borderTop: `1px solid ${ST.line}`,
            background: ST.rail,
            flexShrink: 0,
          }}>
            {transport}
          </div>
        </div>

        {/* Inspector column (optional) */}
        {inspector && (
          <div style={{
            width: inspectorWidth,
            flexShrink: 0,
            background: 'var(--color-elevated)',
            borderLeft: `1px solid ${ST.line}`,
            overflow: 'hidden',
          }}>
            {inspector}
          </div>
        )}
      </div>

      {/* Timeline block */}
      <div style={{
        flexShrink: 0,
        background: ST.bg,
        borderTop: `1px solid ${ST.line}`,
      }}>
        {timeline}
      </div>
    </div>
  );
}

// ── PreviewFrame ───────────────────────────────────────────────────────────

export interface PreviewFrameProps {
  /** A <video> element that sizes itself (e.g. max-width/height set by parent). */
  children: React.ReactNode;
}

/**
 * Dark 16:9-ish player frame that centers its child with rounded corners and a
 * heavy drop shadow, matching the mock's PreviewPlayer. The child (a <video>)
 * is responsible for its own dimensions; this wrapper just provides the frame.
 */
export function PreviewFrame({ children }: PreviewFrameProps): React.JSX.Element {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      background: '#000',
    }}>
      <div style={{
        background: '#0d0d12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── TransportBar ───────────────────────────────────────────────────────────

export interface TransportBarProps {
  playing: boolean;
  /** Current timecode formatted as "MM:SS.t". */
  tc: string;
  /** Total duration formatted the same way. */
  dur: string;
  onPlayPause: () => void;
  onSkipStart: () => void;
  onSkipEnd: () => void;
}

/**
 * Transport controls row: skip-to-start, big round play/pause, skip-to-end,
 * then a monospace "tc / dur" readout. Matches the mock's Transport exactly.
 */
export function TransportBar({
  playing,
  tc,
  dur,
  onPlayPause,
  onSkipStart,
  onSkipEnd,
}: TransportBarProps): React.JSX.Element {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '9px 0',
    }}>
      {/* Skip to start */}
      <TransportBtn onClick={onSkipStart}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
          <rect x="1" y="1" width="2" height="11" />
          <path d="M12 1L4 6.5 12 12z" />
        </svg>
      </TransportBtn>

      {/* Play / Pause — large accent circle */}
      <TransportBtn big onClick={onPlayPause}>
        {playing
          ? (
            <svg width="13" height="14" viewBox="0 0 13 14" fill="#fff">
              <rect x="1" y="1" width="4" height="12" rx="1" />
              <rect x="8" y="1" width="4" height="12" rx="1" />
            </svg>
          )
          : (
            <svg width="13" height="14" viewBox="0 0 13 14" fill="#fff">
              <path d="M1 1l11 6-11 6z" />
            </svg>
          )}
      </TransportBtn>

      {/* Skip to end */}
      <TransportBtn onClick={onSkipEnd}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
          <rect x="10" y="1" width="2" height="11" />
          <path d="M1 1l8 5.5L1 12z" />
        </svg>
      </TransportBtn>

      {/* Timecode readout */}
      <span style={{
        fontFamily: 'monospace',
        fontSize: 13,
        color: 'var(--color-text)',
        marginLeft: 6,
      }}>
        {tc}{' '}
        <span style={{ color: 'var(--color-text-muted)' }}>/ {dur}</span>
      </span>
    </div>
  );
}

/** Internal button used by TransportBar — not exported (container doesn't need it). */
function TransportBtn({
  children,
  big,
  onClick,
}: {
  children: React.ReactNode;
  big?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        width: big ? 34 : 28,
        height: big ? 34 : 28,
        borderRadius: big ? 17 : 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: big ? 'var(--color-accent)' : 'transparent',
        color: big ? '#fff' : 'var(--color-text)',
        border: big ? 'none' : `1px solid ${ST.line}`,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

// ── TimeRuler ──────────────────────────────────────────────────────────────

export interface TimeRulerProps {
  /** Total clip duration in seconds — used to compute ~6-8 nice tick marks. */
  duration: number;
  /** Pixel width of the track header column. Defaults to 150. */
  headerWidth?: number;
}

/**
 * Timecode ruler that sits above the track lanes. Computes a nice tick
 * interval (targeting ~6-8 ticks) from the duration so labels stay legible
 * at any zoom level without the container needing to supply explicit marks.
 */
export function TimeRuler({ duration, headerWidth = 150 }: TimeRulerProps): React.JSX.Element {
  const marks = computeRulerMarks(duration);

  return (
    <div style={{
      height: 22, display: 'flex',
      background: ST.ruler,
      borderBottom: `1px solid ${ST.line}`,
      flexShrink: 0,
    }}>
      {/* Header spacer — same width as track headers so ruler aligns with lane area */}
      <div style={{
        width: headerWidth, flexShrink: 0,
        borderRight: `1px solid ${ST.line}`,
      }} />

      {/* Tick marks positioned as % within the lane */}
      <div style={{ flex: 1, position: 'relative' }}>
        {marks.map((m) => (
          <div
            key={m.label}
            style={{
              position: 'absolute',
              left: `${m.pct * 100}%`,
              top: 0, height: '100%',
              display: 'flex', alignItems: 'center',
            }}
          >
            <span style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: 1,
              background: ST.line,
            }} />
            <span style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              fontFamily: 'monospace',
              paddingLeft: 5,
            }}>
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compute ~6-8 ruler tick positions from a duration (seconds). */
function computeRulerMarks(duration: number): Array<{ label: string; pct: number }> {
  if (duration <= 0) return [];

  // Nice step values in seconds; pick the smallest that gives ≤8 ticks.
  const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const targetTicks = 7;
  const step = STEPS.find((s) => Math.floor(duration / s) <= targetTicks) ?? STEPS[STEPS.length - 1];

  const marks: Array<{ label: string; pct: number }> = [];
  for (let t = 0; t <= duration; t += step) {
    marks.push({ label: formatTC(t), pct: t / duration });
  }
  return marks;
}

/** Format seconds as "M:SS" (no tenths — ruler labels stay compact). */
function formatTC(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── TrackLane ──────────────────────────────────────────────────────────────

export interface TrackLaneProps {
  /** Display name in the header, e.g. "Screen". */
  name: string;
  /** Dot colour identifying the track, e.g. ST.video. */
  color: string;
  /** Row height in pixels. Defaults to 56. */
  height?: number;
  /** Pixel width of the header column. Defaults to 150. */
  headerWidth?: number;
  /** Clip atoms (ClipView, etc.) rendered into the lane area. */
  children?: React.ReactNode;
}

/**
 * One multitrack row: coloured-dot + name in a header column on the left,
 * then a relative-positioned lane area on the right for clip children.
 */
export function TrackLane({
  name,
  color,
  height = 56,
  headerWidth = 150,
  children,
}: TrackLaneProps): React.JSX.Element {
  return (
    <div style={{
      display: 'flex', height,
      borderBottom: `1px solid ${ST.line}`,
    }}>
      {/* Header */}
      <div style={{
        width: headerWidth, flexShrink: 0,
        background: ST.header,
        borderRight: `1px solid ${ST.line}`,
        padding: '0 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 2,
            background: color, flexShrink: 0,
          }} />
          <span style={{
            fontSize: 12,
            color: 'var(--color-text)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {name}
          </span>
        </div>
      </div>

      {/* Lane area — relative so clip children can use absolute positioning */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: ST.trackBg,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── ClipView ───────────────────────────────────────────────────────────────

export interface ClipViewProps {
  /** Left edge as a percentage of the lane width (0–100). */
  leftPct: number;
  /** Width as a percentage of the lane width (0–100). */
  widthPct: number;
  /** Short label shown in the label strip at the top of the clip. */
  label: string;
  /** Filmstrip thumbnail dataURLs. Empty array while thumbnails are loading. */
  thumbs: string[];
  /** Background fill colour. Defaults to ST.video. */
  color?: string;
  /** Border/edge colour. Defaults to ST.videoEdge. */
  edge?: string;
  /** Whether this clip is the selected clip (shows white border + trim handles). */
  selected?: boolean;
  /**
   * Trim-in point as a fraction (0..1) within the clip's own span.
   * If provided, the region [0, trimStartFrac] is dimmed with a dark overlay.
   */
  trimStartFrac?: number;
  /**
   * Trim-out point as a fraction (0..1) within the clip's own span.
   * If provided, the region [trimEndFrac, 1] is dimmed with a dark overlay.
   */
  trimEndFrac?: number;
}

/**
 * Video clip bar with a filmstrip thumbnail strip and label strip on top.
 * Position is controlled by leftPct/widthPct (percentages of the parent lane).
 *
 * Trim handles: 6px white bars at trimStartFrac / trimEndFrac positions,
 * carrying data-handle="left" | "right" so the container can hit-test them
 * via elementFromPoint without importing any gesture logic here.
 */
export function ClipView({
  leftPct,
  widthPct,
  label,
  thumbs,
  color = ST.video,
  edge = ST.videoEdge,
  selected = false,
  trimStartFrac,
  trimEndFrac,
}: ClipViewProps): React.JSX.Element {
  return (
    <div style={{
      position: 'absolute',
      left: `${leftPct}%`,
      width: `${widthPct}%`,
      top: 4, bottom: 4,
      borderRadius: 6,
      background: color,
      border: `1.5px solid ${selected ? '#fff' : edge}`,
      boxShadow: selected ? '0 0 0 1px #fff' : 'none',
      overflow: 'hidden',
    }}>
      {/* Label strip */}
      <div style={{
        height: 15,
        background: 'rgba(0,0,0,0.28)',
        display: 'flex', alignItems: 'center',
        padding: '0 7px',
        fontSize: 9.5, fontWeight: 700,
        color: '#fff',
        letterSpacing: 0.2,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        position: 'relative', zIndex: 1,
      }}>
        {label}
      </div>

      {/* Filmstrip row */}
      <div style={{
        position: 'absolute', top: 15, left: 0, right: 0, bottom: 0,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {thumbs.length > 0
          ? thumbs.map((src, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRight: i < thumbs.length - 1 ? '1px solid rgba(0,0,0,0.25)' : 'none',
                overflow: 'hidden',
                position: 'relative',
                background: '#000',
              }}
            >
              <img
                src={src}
                alt=""
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          ))
          : (
            /* Placeholder cells while thumbnails are loading */
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRight: i < 4 ? '1px solid rgba(0,0,0,0.25)' : 'none',
                  background: 'rgba(0,0,0,0.2)',
                }}
              />
            ))
          )}
      </div>

      {/* Trim-in dimmed region (left of trimStartFrac) */}
      {trimStartFrac !== undefined && trimStartFrac > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          right: `${(1 - trimStartFrac) * 100}%`,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 2,
          pointerEvents: 'none',
        }} />
      )}

      {/* Trim-out dimmed region (right of trimEndFrac) */}
      {trimEndFrac !== undefined && trimEndFrac < 1 && (
        <div style={{
          position: 'absolute', inset: 0,
          left: `${trimEndFrac * 100}%`,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 2,
          pointerEvents: 'none',
        }} />
      )}

      {/* Trim handles — only when at least one trim boundary is set */}
      {trimStartFrac !== undefined && (
        <TrimHandle side="left" frac={trimStartFrac} accentColor={color} />
      )}
      {trimEndFrac !== undefined && (
        <TrimHandle side="right" frac={trimEndFrac} accentColor={color} />
      )}
    </div>
  );
}

/**
 * 6px white trim handle bar. Carries data-handle so the container can
 * identify it via elementFromPoint hit-testing without any imports from here.
 */
function TrimHandle({
  side,
  frac,
  accentColor,
}: {
  side: 'left' | 'right';
  frac: number;
  accentColor: string;
}): React.JSX.Element {
  // Position the handle at the fraction boundary (left handle at frac from left,
  // right handle at frac from left as well — container supplies both fracs in
  // the same coordinate space so we just translate to % left offset).
  return (
    <div
      data-handle={side}
      style={{
        position: 'absolute',
        top: 0, bottom: 0,
        left: `${frac * 100}%`,
        // Centre the 6px bar on the boundary line
        transform: side === 'left' ? 'translateX(0)' : 'translateX(-6px)',
        width: 6,
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3,
        cursor: side === 'left' ? 'w-resize' : 'e-resize',
      }}
    >
      {/* Inner pip using the track accent colour, mirroring the mock's Handle inner span */}
      <span style={{
        width: 2, height: 14,
        background: accentColor,
        borderRadius: 1,
      }} />
    </div>
  );
}

// ── PlayheadView ───────────────────────────────────────────────────────────

export interface PlayheadViewProps {
  /**
   * Position as a fraction 0..1 across the LANE area (right of the header).
   * The component converts this to a CSS calc() that accounts for headerWidth.
   */
  frac: number;
  /** Pixel width of the track header column. Defaults to 150. */
  headerWidth?: number;
}

/**
 * Red playhead: triangle head (polygon) + 1.5px vertical line, absolutely
 * positioned over the full timeline block. pointerEvents is none so the
 * container handles all dragging interaction.
 *
 * Geometry matches the mock: triangle is 14×13px, line starts at bottom of
 * triangle and extends to the container bottom.
 */
export function PlayheadView({ frac, headerWidth = 150 }: PlayheadViewProps): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        // Offset = headerWidth + frac * (100% - headerWidth)
        left: `calc(${headerWidth}px + (100% - ${headerWidth}px) * ${frac})`,
        top: 0, bottom: 0,
        width: 0,
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      {/* Triangle head */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: -7,
        width: 14, height: 13,
        background: ST.playhead,
        clipPath: 'polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)',
      }} />
      {/* Vertical line */}
      <div style={{
        position: 'absolute',
        top: 17, bottom: 0, left: 0,
        width: 1.5,
        background: ST.playhead,
      }} />
    </div>
  );
}

// ── Field ──────────────────────────────────────────────────────────────────

export interface FieldProps {
  /** Small uppercase label above the content. */
  label: string;
  children: React.ReactNode;
}

/**
 * Inspector field: uppercase muted label above an arbitrary content slot.
 * Ported from the scrubber.jsx Field component.
 */
export function Field({ label, children }: FieldProps): React.JSX.Element {
  return (
    <div>
      <div style={{
        fontSize: 10.5,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 7,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── NumChip ────────────────────────────────────────────────────────────────

export interface NumChipProps {
  children: React.ReactNode;
}

/**
 * Monospace value chip with a subtle border — used for timecodes, pixel
 * dimensions, numeric settings. Ported from scrubber.jsx's Num component.
 */
export function NumChip({ children }: NumChipProps): React.JSX.Element {
  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: 12.5,
      background: ST.trackBg,
      border: `1px solid ${ST.line}`,
      borderRadius: 6,
      padding: '6px 9px',
      color: 'var(--color-text)',
      display: 'inline-block',
    }}>
      {children}
    </span>
  );
}

