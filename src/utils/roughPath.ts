import rough from 'roughjs';
import type { Options, OpSet } from 'roughjs/bin/core';

/** Rough.js geometry as SVG path data, for rendering through Konva's `<Path>`.
 *
 * WHY paths and not a canvas: Rough ships a RoughCanvas that draws straight onto
 * a 2D context, but reaching for it would mean punching through Konva's context
 * wrapper inside a `sceneFunc`. The generator has no such dependency — it emits
 * plain op lists — so a shape stays what the rest of this editor assumes it is:
 * declarative data rendered by a react-konva node. Export, hit-testing, caching
 * and the transformer keep working with no special cases.
 *
 * Everything here is generated in LOCAL coordinates (a rect spans 0,0..w,h; an
 * ellipse centres on 0,0) and positioned by Konva. That keeps the wobble stable
 * while a shape is dragged — the ops never regenerate, only the node moves.
 */

const gen = rough.generator();

/** Rough emits one op list per pass; roughness > 0 gives two overlapping passes. */
function opsToPath(sets: OpSet[], want: OpSet['type']): string {
  let d = '';
  for (const set of sets) {
    if (set.type !== want) continue;
    for (const { op, data } of set.ops) {
      if (op === 'move') d += `M${data[0]} ${data[1]}`;
      else if (op === 'lineTo') d += `L${data[0]} ${data[1]}`;
      else if (op === 'bcurveTo') d += `C${data[0]} ${data[1]} ${data[2]} ${data[3]} ${data[4]} ${data[5]}`;
    }
  }
  return d;
}

export interface RoughPaths {
  /** The sketched outline. Always present. */
  stroke: string;
  /** Solid interior, only when a fill colour was asked for. */
  fill: string;
}

function paths(sets: OpSet[]): RoughPaths {
  return {
    stroke: opsToPath(sets, 'path'),
    // 'solid' fills come back as fillPath; hachure styles use fillSketch, which
    // is stroked rather than filled. Only solid is used here.
    fill: opsToPath(sets, 'fillPath'),
  };
}

/** A seed the annotation carries, so the same shape wobbles the same way every
 *  render, every reload, and in the exported PNG. Falls back to a hash of the
 *  annotation id for documents saved before `seed` existed. */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100000;
}

export interface SketchOpts {
  seed: number;
  roughness: number;
  strokeWidth: number;
  stroke?: string;
  fill?: string;
}

/** Matches the marker hand in the screenshot-annotate skill. */
export const DEFAULT_ROUGHNESS = 0.9;

/** Fills in what an annotation may legitimately be missing: `seed` is absent on
 *  documents predating sketch, `roughness` is absent until the user moves the
 *  slider. */
export function sketchOpts(
  anno: { id: string; seed?: number; roughness?: number },
  strokeWidth: number,
  fill?: string,
): SketchOpts {
  return {
    seed: anno.seed ?? seedFromId(anno.id),
    roughness: anno.roughness ?? DEFAULT_ROUGHNESS,
    strokeWidth,
    fill,
  };
}

/** Sketched strokes are thin and wobbly; give them a fat invisible hit region
 *  so they are no harder to grab than the Konva primitives they replace. */
export function hitWidth(strokeWidth: number): number {
  return Math.max(strokeWidth, 12);
}

function baseOptions({ seed, roughness, strokeWidth, fill }: SketchOpts): Options {
  return {
    seed,
    roughness,
    bowing: 1,
    strokeWidth,
    // Rough's wobble amplitude is in absolute pixels (default 2), so a heavy
    // stroke swallows it whole and a 12px "hand-drawn" line comes out looking
    // machine-straight. Scale it with the stroke, holding the default weight of
    // 4 at Rough's own value so light strokes keep the look already tuned.
    maxRandomnessOffset: Math.max(2, strokeWidth * 0.5),
    // Colours are applied by Konva on the resulting node, not baked into the
    // ops — so changing a colour never regenerates geometry.
    stroke: '#000',
    ...(fill ? { fill, fillStyle: 'solid' } : {}),
    // Rough disables its own curve fitting below this; the default (9) visibly
    // straightens small rings.
    curveStepCount: 11,
  };
}

export function roughRect(width: number, height: number, o: SketchOpts): RoughPaths {
  return paths(gen.rectangle(0, 0, width, height, baseOptions(o)).sets);
}

export function roughEllipse(radiusX: number, radiusY: number, o: SketchOpts): RoughPaths {
  return paths(gen.ellipse(0, 0, radiusX * 2, radiusY * 2, baseOptions(o)).sets);
}

export function roughCircle(radius: number, o: SketchOpts): RoughPaths {
  return paths(gen.circle(0, 0, radius * 2, baseOptions(o)).sets);
}

/** Closed polygon from a flat [x,y,x,y,…] list — triangle / diamond / star. */
export function roughPolygon(flat: number[], o: SketchOpts): RoughPaths {
  const pts: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  return paths(gen.polygon(pts, baseOptions(o)).sets);
}

/** Open polyline through every point — the freehand pen and the straight line. */
export function roughPolyline(flat: number[], o: SketchOpts): RoughPaths {
  const pts: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length < 2) return { stroke: '', fill: '' };
  return paths(gen.linearPath(pts, baseOptions(o)).sets);
}

// ── Leaders ────────────────────────────────────────────────────────────────
// A leader sweeps; it does not poke. A straight arrow landing on a control
// reads as part of the UI, where an arc reads as something drawn on top of it.
// `curve` is a signed fraction of the chord length, so the bow keeps its
// proportion when the arrow is resized.

export interface Pt { x: number; y: number }

/** Control point of the quadratic that bows a chord by `curve`. */
export function leaderControl(x1: number, y1: number, x2: number, y2: number, curve: number): Pt {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular, unit length. Sign of `curve` picks the side.
  return { x: mx + (-dy / len) * curve * len, y: my + (dx / len) * curve * len };
}

/** Sampled points along the bowed chord, for Rough (which wants a point list). */
function leaderPoints(x1: number, y1: number, x2: number, y2: number, curve: number, steps = 16): [number, number][] {
  const c = leaderControl(x1, y1, x2, y2, curve);
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * x1 + 2 * u * t * c.x + t * t * x2,
      u * u * y1 + 2 * u * t * c.y + t * t * y2,
    ]);
  }
  return out;
}

/** Direction the head points: the curve's tangent where it lands, which for a
 *  quadratic is simply the vector from the control point to the endpoint. */
export function leaderTangent(x1: number, y1: number, x2: number, y2: number, curve: number): number {
  const c = leaderControl(x1, y1, x2, y2, curve);
  return Math.atan2(y2 - c.y, x2 - c.x);
}

/** The two barbs of an arrowhead, as a flat point list through the tip. */
export function arrowBarbs(x2: number, y2: number, angle: number, length: number, halfWidth: number): number[] {
  const spread = Math.atan2(halfWidth, length);
  const back = Math.hypot(length, halfWidth);
  return [
    x2 - back * Math.cos(angle - spread), y2 - back * Math.sin(angle - spread),
    x2, y2,
    x2 - back * Math.cos(angle + spread), y2 - back * Math.sin(angle + spread),
  ];
}

/** Smooth (non-sketch) bowed leader as SVG path data. */
export function smoothLeaderPath(x1: number, y1: number, x2: number, y2: number, curve: number): string {
  const c = leaderControl(x1, y1, x2, y2, curve);
  return `M${x1} ${y1}Q${c.x} ${c.y} ${x2} ${y2}`;
}

/** Sketched bowed leader. A near-zero bow degenerates to a straight run, which
 *  Rough's curve fitter handles badly — fall back to a linear path there. */
export function roughLeader(x1: number, y1: number, x2: number, y2: number, curve: number, o: SketchOpts): RoughPaths {
  if (Math.abs(curve) < 0.01) {
    return paths(gen.linearPath([[x1, y1], [x2, y2]], baseOptions(o)).sets);
  }
  return paths(gen.curve(leaderPoints(x1, y1, x2, y2, curve), baseOptions(o)).sets);
}
