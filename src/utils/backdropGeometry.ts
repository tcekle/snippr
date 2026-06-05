import type { BackdropConfig, BackdropFill } from '../types/backdrop';
import { FRAME_BAR_HEIGHT } from '../types/backdrop';

export interface Bounds { x: number; y: number; width: number; height: number; }

function aspectRatio(a: BackdropConfig['aspect']): number | null {
  switch (a) {
    case '1:1':  return 1;
    case '16:9': return 16 / 9;
    case '4:3':  return 4 / 3;
    default:     return null;
  }
}

/** Full composed-artwork rect in image space (content = the wrapped image/crop). */
export function backdropBounds(contentW: number, contentH: number, b: BackdropConfig): Bounds {
  const bar = FRAME_BAR_HEIGHT[b.frame];
  let left = b.padding, right = b.padding, top = b.padding + bar, bottom = b.padding;

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
