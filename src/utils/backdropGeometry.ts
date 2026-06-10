import type { BackdropConfig, BackdropFill, FrameStyle } from '../types/backdrop';
import { FRAME_BAR_HEIGHT } from '../types/backdrop';

export interface Bounds { x: number; y: number; width: number; height: number; }

/** Chrome thickness around the content for each frame style. Bar frames only
 *  add a title bar above; device frames wrap bezels on all four sides. */
export interface FrameInsets { left: number; top: number; right: number; bottom: number; }

// ── device frame metrics ─────────────────────────────────────────────────────
// Single source of truth for the laptop/phone hardware proportions: the
// renderer (Backdrop.tsx) and the bounds math below MUST agree, so both read
// these. Reference design is a 760px-wide shot; everything scales from there.

export interface LaptopMetrics {
  bezel: number;        // dark screen bezel, all four sides
  slabR: number;        // screen-slab corner radius
  baseOverhang: number; // keyboard deck extends this far past the slab, each side
  baseH: number;        // keyboard deck height
  notchW: number;       // hinge notch under the deck
  notchH: number;
}

export function laptopMetrics(imgW: number): LaptopMetrics {
  const s = Math.max(0.35, imgW / 760);
  return {
    bezel: Math.round(Math.max(8, 12 * s)),
    slabR: Math.round(Math.max(8, 16 * s)),
    baseOverhang: Math.round(58 * s),
    baseH: Math.round(Math.max(10, 18 * s)),
    notchW: Math.round(120 * s),
    notchH: Math.round(Math.max(4, 7 * s)),
  };
}

export interface PhoneMetrics {
  bezel: number;   // uniform bezel
  deviceR: number; // outer slab corner radius
}

export function phoneMetrics(imgW: number, imgH: number): PhoneMetrics {
  const s = Math.max(0.4, Math.min(imgW, imgH) / 400);
  return {
    bezel: Math.round(Math.max(10, 14 * s)),
    deviceR: Math.round(Math.max(20, 52 * s)),
  };
}

export function frameInsets(frame: FrameStyle, contentW: number, contentH: number): FrameInsets {
  switch (frame) {
    case 'laptop': {
      const m = laptopMetrics(contentW);
      return {
        left: m.bezel + m.baseOverhang,
        top: m.bezel,
        right: m.bezel + m.baseOverhang,
        bottom: m.bezel + m.baseH + m.notchH,
      };
    }
    case 'phone': {
      const m = phoneMetrics(contentW, contentH);
      return { left: m.bezel, top: m.bezel, right: m.bezel, bottom: m.bezel };
    }
    default:
      return { left: 0, top: FRAME_BAR_HEIGHT[frame], right: 0, bottom: 0 };
  }
}

/** Corner radius for the screenshot Image node under each frame. Bar frames
 *  round the bottom only (the bar rounds the top); a phone screen follows the
 *  slab curve so the corners stay concentric. */
export function imageCornerRadius(b: BackdropConfig, imgW: number, imgH: number): number | number[] {
  switch (b.frame) {
    case 'none':   return b.cornerRadius;
    case 'laptop': return Math.min(b.cornerRadius, 6);
    case 'phone': {
      const m = phoneMetrics(imgW, imgH);
      return Math.max(b.cornerRadius, m.deviceR - m.bezel);
    }
    default: return [0, 0, b.cornerRadius, b.cornerRadius];
  }
}

// ── perspective tilt ─────────────────────────────────────────────────────────
// Affine pseudo-3D lean: rotate + vertical shear, pivoted at the image center.
// Applied as LAYER props on the content layers (device + image + annotations);
// the backdrop panel stays upright. Crop straighten and backdrop are mutually
// exclusive in the store, so the layer-transform slot is free when tilting.

export const TILT_ROTATION_DEG = -4;
export const TILT_SKEW_Y = -0.1;

/** Always-full transform-prop object (react-konva only rewrites props that are
 *  present, so zeros must be explicit to reset). */
export function tiltLayerProps(imgW: number, imgH: number): XformProps {
  const cx = imgW / 2, cy = imgH / 2;
  return {
    rotation: TILT_ROTATION_DEG,
    skewX: 0,
    skewY: TILT_SKEW_Y,
    offsetX: cx,
    offsetY: cy,
    x: cx,
    y: cy,
  };
}

export interface XformProps {
  rotation: number; skewX: number; skewY: number;
  offsetX: number; offsetY: number; x: number; y: number;
}

/** Map a document-space point through a Konva node transform, replicating
 *  Konva's order exactly: translate(x,y) · rotate · skew · translate(-offset).
 *  Konva's skew matrix is x' = x + skewX·y, y' = skewY·x + y. One shared impl
 *  so bounds math, the live render, and overlay anchors can't disagree. */
export function xformPoint(p: { x: number; y: number }, t: XformProps): { x: number; y: number } {
  const vx = p.x - t.offsetX, vy = p.y - t.offsetY;
  const sx = vx + t.skewX * vy, sy = t.skewY * vx + vy;
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return { x: t.x + sx * cos - sy * sin, y: t.y + sx * sin + sy * cos };
}

function transformAABB(r: Bounds, t: XformProps): Bounds {
  const pts = [
    xformPoint({ x: r.x, y: r.y }, t),
    xformPoint({ x: r.x + r.width, y: r.y }, t),
    xformPoint({ x: r.x, y: r.y + r.height }, t),
    xformPoint({ x: r.x + r.width, y: r.y + r.height }, t),
  ];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

// ── composition bounds ───────────────────────────────────────────────────────

function aspectRatio(a: BackdropConfig['aspect']): number | null {
  switch (a) {
    case '1:1':  return 1;
    case '16:9': return 16 / 9;
    case '4:3':  return 4 / 3;
    default:     return null;
  }
}

/** Full composed-artwork rect in image space (content = the wrapped image/crop).
 *  Device box = content + frame insets, expanded to its tilted AABB when tilt
 *  is on, then padded and aspect-fitted. */
export function backdropBounds(contentW: number, contentH: number, b: BackdropConfig): Bounds {
  const ins = frameInsets(b.frame, contentW, contentH);
  let box: Bounds = {
    x: -ins.left,
    y: -ins.top,
    width: contentW + ins.left + ins.right,
    height: contentH + ins.top + ins.bottom,
  };
  if (b.tilt) box = transformAABB(box, tiltLayerProps(contentW, contentH));

  let left = -box.x + b.padding;
  let top = -box.y + b.padding;
  let right = box.x + box.width - contentW + b.padding;
  let bottom = box.y + box.height - contentH + b.padding;

  const target = aspectRatio(b.aspect);
  if (target) {
    const w = contentW + left + right;
    const h = contentH + top + bottom;
    const cur = w / h;
    if (cur < target) {            // too tall — pad sides
      const extra = (h * target - w) / 2;
      left += extra; right += extra;
    } else if (cur > target) {     // too wide — pad top/bottom
      const extra = (w / target - h) / 2;
      top += extra; bottom += extra;
    }
  }
  return { x: -left, y: -top, width: contentW + left + right, height: contentH + top + bottom };
}

/** Konva linear-gradient props for a given fill across `bounds`. */
export function gradientProps(fill: Extract<BackdropFill, { kind: 'gradient' }>, bounds: Bounds) {
  const rad = (fill.angle * Math.PI) / 180;
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  return {
    fillLinearGradientStartPoint: { x: cx - dx * bounds.width / 2, y: cy - dy * bounds.height / 2 },
    fillLinearGradientEndPoint:   { x: cx + dx * bounds.width / 2, y: cy + dy * bounds.height / 2 },
    fillLinearGradientColorStops: [0, fill.from, 1, fill.to],
  };
}
