/**
 * Backdrop rendering — two separate exports so the caller can composite them
 * on different layers (panel stays upright; chrome tilts with the device).
 *
 * Device-frame geometry (bezel sizes, deck heights, notch dims) comes exclusively
 * from backdropGeometry.ts — laptopMetrics / phoneMetrics are the single source
 * of truth shared by the bounds math. If you ever adjust a metric, change it
 * there and both the visual chrome and the panel bounds stay in sync.
 */
import { Group, Rect, Circle, Line } from 'react-konva';
import type { BackdropConfig } from '../types/backdrop';
import { FRAME_BAR_HEIGHT } from '../types/backdrop';
import {
  gradientProps,
  laptopMetrics,
  phoneMetrics,
  type Bounds,
} from '../utils/backdropGeometry';

type FillProps =
  | { fill: string }
  | ReturnType<typeof gradientProps>;

// ── BackdropPanel ─────────────────────────────────────────────────────────────

/**
 * The colored backdrop panel only — the large Rect that sits behind everything.
 * Receives pre-computed `bounds` so the caller can pass an annotation-aware
 * expansion without us re-deriving it here.
 */
export function BackdropPanel({ b, bounds }: { b: BackdropConfig; bounds: Bounds }) {
  const fillProps: FillProps = b.fill.kind === 'solid'
    ? { fill: b.fill.color }
    : gradientProps(b.fill, bounds);

  return (
    <Rect
      x={bounds.x} y={bounds.y}
      width={bounds.width} height={bounds.height}
      cornerRadius={Math.min(20, b.cornerRadius + 6)}
      {...fillProps}
      listening={false}
    />
  );
}

// ── BackdropChrome ────────────────────────────────────────────────────────────

/**
 * Shadow card + frame hardware — everything EXCEPT the backdrop panel and the
 * screenshot itself. The image is assumed to sit at (0,0)→(imgW,imgH) in the
 * caller's coordinate space and is drawn on top of this component.
 *
 * Bar frames ('macos' | 'windows' | 'browser'): white card + title bar chrome.
 * 'none': white card only (when shadow is on).
 * 'laptop': MacBook-style dark screen slab + keyboard deck + hinge notch.
 * 'phone': dark device slab, clean (no notch/camera — they would overlap the shot).
 */
export function BackdropChrome({ b, imgW, imgH }: { b: BackdropConfig; imgW: number; imgH: number }) {
  const frame = b.frame;

  if (frame === 'laptop') {
    return <LaptopChrome b={b} imgW={imgW} imgH={imgH} />;
  }
  if (frame === 'phone') {
    return <PhoneChrome b={b} imgW={imgW} imgH={imgH} />;
  }

  // Bar frames and 'none' share the white shadow-card idiom.
  const bar = FRAME_BAR_HEIGHT[frame];
  const r = b.cornerRadius;

  return (
    <Group listening={false}>
      {/* White drop-shadow card sits behind the image + bar. The shadow is
          intentionally on the card, not the image, so it doesn't clip to the
          screenshot border. */}
      {b.shadow && (
        <Rect
          x={0} y={-bar} width={imgW} height={imgH + bar}
          cornerRadius={r}
          fill="#ffffff"
          shadowColor="#000" shadowBlur={40} shadowOpacity={0.35} shadowOffsetY={20}
        />
      )}

      {/* Title bar chrome — only for bar-style frames */}
      {frame !== 'none' && (
        <>
          <Rect
            x={0} y={-bar} width={imgW} height={bar}
            cornerRadius={[r, r, 0, 0]} fill="#e9e9ee"
          />
          {/* Subtle separator line between bar and screenshot */}
          <Rect x={0} y={-1} width={imgW} height={1} fill="rgba(0,0,0,0.08)" />
          {frame === 'windows' ? (
            <WindowsCaption imgW={imgW} cy={-bar / 2} />
          ) : (
            <>
              {/* macOS traffic lights — used by both 'macos' and 'browser' */}
              {(['#ff5f57', '#febc2e', '#28c840'] as const).map((c, i) => (
                <Circle key={c} x={16 + i * 18} y={-bar / 2} radius={5.5} fill={c} />
              ))}
              {frame === 'browser' && (
                // URL pill: roughly centered, 44% of the bar width
                <Rect
                  x={imgW * 0.28} y={-bar / 2 - 10}
                  width={imgW * 0.44} height={20}
                  cornerRadius={6} fill="#ffffff"
                />
              )}
            </>
          )}
        </>
      )}
    </Group>
  );
}

// ── Device-frame sub-components ───────────────────────────────────────────────

/**
 * MacBook-style laptop chrome. Three layers from back to front:
 *   1. Dark screen slab (bezel around the image, optionally carries the drop shadow).
 *   2. Keyboard deck below the slab (wider, short, rounded bottom corners).
 *   3. Hinge notch centered under the deck (inset groove).
 *
 * All dimensions come from laptopMetrics(imgW) — same call the bounds math makes.
 */
function LaptopChrome({ b, imgW, imgH }: { b: BackdropConfig; imgW: number; imgH: number }) {
  const m = laptopMetrics(imgW);

  // Screen slab shadow props — only present when b.shadow is true.
  // We put the shadow on the slab itself (not a separate white card) because the
  // slab IS the backing surface for device frames; a white card would bleed out
  // from behind the dark bezel.
  const slabShadow = b.shadow
    ? { shadowColor: '#000', shadowBlur: 40, shadowOpacity: 0.35, shadowOffsetY: 20 }
    : {};

  const deckY  = imgH + m.bezel;
  const notchY = deckY + m.baseH;

  return (
    <Group listening={false}>
      {/* Screen slab — dark bezel around the screenshot area */}
      <Rect
        x={-m.bezel} y={-m.bezel}
        width={imgW + 2 * m.bezel} height={imgH + 2 * m.bezel}
        cornerRadius={m.slabR}
        fill="#0c0c12"
        {...slabShadow}
      />

      {/* Keyboard deck — slightly wider than the slab, rounded at the bottom */}
      <Rect
        x={-(m.bezel + m.baseOverhang)} y={deckY}
        width={imgW + 2 * (m.bezel + m.baseOverhang)} height={m.baseH}
        cornerRadius={[0, 0, m.slabR * 0.9, m.slabR * 0.9]}
        fillLinearGradientStartPoint={{ x: 0, y: deckY }}
        fillLinearGradientEndPoint={{ x: 0, y: deckY + m.baseH }}
        fillLinearGradientColorStops={[0, '#cfcfd8', 1, '#9a9aa6']}
      />

      {/* Hinge notch — thin groove centered below the keyboard deck */}
      <Rect
        x={imgW / 2 - m.notchW / 2} y={notchY}
        width={m.notchW} height={m.notchH}
        cornerRadius={[0, 0, m.notchH, m.notchH]}
        fill="#7d7d8a"
      />
    </Group>
  );
}

/**
 * Phone chrome: a single dark rounded slab with uniform bezels.
 * No notch or camera cutout — they would cover part of the screenshot.
 * All dimensions from phoneMetrics(imgW, imgH).
 */
function PhoneChrome({ b, imgW, imgH }: { b: BackdropConfig; imgW: number; imgH: number }) {
  const m = phoneMetrics(imgW, imgH);

  const slabShadow = b.shadow
    ? { shadowColor: '#000', shadowBlur: 40, shadowOpacity: 0.35, shadowOffsetY: 20 }
    : {};

  return (
    <Group listening={false}>
      <Rect
        x={-m.bezel} y={-m.bezel}
        width={imgW + 2 * m.bezel} height={imgH + 2 * m.bezel}
        cornerRadius={m.deviceR}
        fill="#0c0c12"
        {...slabShadow}
      />
    </Group>
  );
}

// ── WindowsCaption ─────────────────────────────────────────────────────────────

/** Windows-style caption buttons (minimize / maximize / close) on the RIGHT. */
function WindowsCaption({ imgW, cy }: { imgW: number; cy: number }) {
  const stroke = '#3a3a3a';
  const sw = 1.4;
  const s = 5; // glyph half-size
  const close = imgW - 22;
  const max   = imgW - 50;
  const min   = imgW - 78;
  return (
    <>
      <Line points={[min - s, cy, min + s, cy]} stroke={stroke} strokeWidth={sw} />
      <Rect x={max - s} y={cy - s} width={2 * s} height={2 * s} stroke={stroke} strokeWidth={sw} />
      <Line points={[close - s, cy - s, close + s, cy + s]} stroke={stroke} strokeWidth={sw} />
      <Line points={[close - s, cy + s, close + s, cy - s]} stroke={stroke} strokeWidth={sw} />
    </>
  );
}
