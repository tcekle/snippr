import type { ShapeKind, ToolType } from '../types/annotations';

export const SHAPE_KINDS: ShapeKind[] = ['triangle', 'diamond', 'star'];

export function isShapeTool(tool: ToolType): tool is ShapeKind {
  return (SHAPE_KINDS as string[]).includes(tool);
}

/** Closed-polygon points for a shape inscribed in a w×h box, in local coords
 * (offset by the annotation's x/y when rendered). */
export function shapePoints(kind: ShapeKind, w: number, h: number): number[] {
  switch (kind) {
    case 'triangle':
      return [w / 2, 0, w, h, 0, h];
    case 'diamond':
      return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
    case 'star': {
      // 5-point star, tip up, alternating outer/inner radius on an ellipse
      // stretched to the drag box (same as Photoshop's star in a bounds drag).
      const cx = w / 2;
      const cy = h / 2;
      const inner = 0.45;
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 1 : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(cx + Math.cos(a) * cx * r, cy + Math.sin(a) * cy * r);
      }
      return pts;
    }
  }
}
