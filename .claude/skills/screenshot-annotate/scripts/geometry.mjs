// Geometry shared by every style preset.
//
// The numbers here are the ones §5.2 of the style guide pins down, and several of them
// were arrived at by getting them wrong first — the arrowhead angle especially.

/** Scale-relative sizing. Everything is derived from canvas width so a figure looks the
 *  same whether it was captured at 1x or at device scale 2. */
export function metrics(canvasWidth)
{
  return {
    // Sized off the FINISHED canvas, so published weight is identical across figures
    // instead of tracking whatever resolution the capture happened to be. Rough.js inks
    // each line twice, so the apparent weight is roughly double this — going heavier
    // than about this stops reading as a drawn line and starts reading as a crayon
    // scribble.
    stroke: canvasWidth / 620,
    arrowHead: canvasWidth / 95,
    // Ring padding is quoted as 9-14px against a 1920px canvas.
    ringPadMin: (9 / 1920) * canvasWidth,
    ringPadMax: (14 / 1920) * canvasWidth,
    gap: (16 / 1920) * canvasWidth,
  };
}

export function inflate(rect, pad)
{
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function centre(rect)
{
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function rectRight(rect) { return rect.x + rect.width; }
export function rectBottom(rect) { return rect.y + rect.height; }

export function unionRect(rects)
{
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map(rectRight));
  const bottom = Math.max(...rects.map(rectBottom));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * A rounded rectangle as an SVG path, four arcs and four lines.
 *
 * Rough.js has to be given a shape with FEW nodes. Handing it a densely sampled outline
 * makes it perturb every one of those samples independently, and the result is a furry
 * caterpillar rather than a drawn rectangle — the wobble has no run-length to it. Nine
 * nodes and real arcs let its own segmenting do the work, which is what produces the
 * clean sketched line the library is known for.
 */
export function roundedRectPath(rect, radius)
{
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const n = (value) => Math.round(value * 100) / 100;

  return [
    `M ${n(rect.x + r)} ${n(rect.y)}`,
    `L ${n(right - r)} ${n(rect.y)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(right)} ${n(rect.y + r)}`,
    `L ${n(right)} ${n(bottom - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(right - r)} ${n(bottom)}`,
    `L ${n(rect.x + r)} ${n(bottom)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(rect.x)} ${n(bottom - r)}`,
    `L ${n(rect.x)} ${n(rect.y + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(rect.x + r)} ${n(rect.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Fit a quadratic through a sampled arc and return it as a three-node SVG path.
 *
 * Same reason as above: the leader is generated as ~25 bezier samples for hit-testing,
 * but drawing those 25 points as a curve gives Rough.js 25 things to wobble. Recovering
 * the single control point that produced them hands it a clean arc instead.
 */
export function quadraticPathThrough(points)
{
  const from = points[0];
  const to = points[points.length - 1];
  const middle = points[Math.floor(points.length / 2)];
  const control = {
    x: 2 * middle.x - (from.x + to.x) / 2,
    y: 2 * middle.y - (from.y + to.y) / 2,
  };
  const n = (value) => Math.round(value * 100) / 100;
  return `M ${n(from.x)} ${n(from.y)} Q ${n(control.x)} ${n(control.y)} ${n(to.x)} ${n(to.y)}`;
}

/**
 * Sample a rounded rectangle's outline uniformly by arc length.
 *
 * Returned as a point list rather than an SVG path because Rough.js produces a far more
 * convincing hand-drawn line from `curve()` through sampled points than from parsing a
 * path with arc commands — and because sampling is what makes partial travel (§5.2
 * "ring overshoot") expressible at all.
 */
export function roundedRectOutline(rect, radius, spacing = 4)
{
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  // Straight runs and quarter-turns, in drawing order from the top-left corner's end.
  const segments = [
    { kind: 'line', from: { x: rect.x + r, y: rect.y }, to: { x: right - r, y: rect.y } },
    { kind: 'arc', cx: right - r, cy: rect.y + r, from: -Math.PI / 2, to: 0 },
    { kind: 'line', from: { x: right, y: rect.y + r }, to: { x: right, y: bottom - r } },
    { kind: 'arc', cx: right - r, cy: bottom - r, from: 0, to: Math.PI / 2 },
    { kind: 'line', from: { x: right - r, y: bottom }, to: { x: rect.x + r, y: bottom } },
    { kind: 'arc', cx: rect.x + r, cy: bottom - r, from: Math.PI / 2, to: Math.PI },
    { kind: 'line', from: { x: rect.x, y: bottom - r }, to: { x: rect.x, y: rect.y + r } },
    { kind: 'arc', cx: rect.x + r, cy: rect.y + r, from: Math.PI, to: Math.PI * 1.5 },
  ];

  const points = [];
  for (const segment of segments)
  {
    if (segment.kind === 'line')
    {
      const dx = segment.to.x - segment.from.x;
      const dy = segment.to.y - segment.from.y;
      const length = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.round(length / spacing));
      for (let step = 0; step < steps; step++)
      {
        const t = step / steps;
        points.push({ x: segment.from.x + dx * t, y: segment.from.y + dy * t });
      }
      continue;
    }

    const sweep = segment.to - segment.from;
    const length = Math.abs(sweep) * r;
    const steps = Math.max(1, Math.round(length / spacing));
    for (let step = 0; step < steps; step++)
    {
      const angle = segment.from + sweep * (step / steps);
      points.push({ x: segment.cx + Math.cos(angle) * r, y: segment.cy + Math.sin(angle) * r });
    }
  }

  return points;
}

/**
 * Take `travel` of the outline (1.06 = once round plus 6%), beginning at `start`.
 *
 * The overshoot is what makes a ring read as drawn by hand: the stroke crosses back over
 * where it began instead of closing exactly, the way a pen does.
 */
export function sliceOutline(points, start = 0, travel = 1.06)
{
  const count = points.length;
  const total = Math.round(count * travel);
  const offset = Math.round(count * start);
  const out = [];
  for (let step = 0; step <= total; step++)
  {
    out.push(points[(offset + step) % count]);
  }
  return out;
}

/**
 * Two barbs from the tip of a shaft.
 *
 * Rough.js draws no arrowheads, so these are drawn as ordinary short strokes. The barb
 * angle is 0.17π off the reversed shaft. 0.42π was tried first and renders as a bracket
 * `⟩` rather than an arrow — the barbs end up nearly perpendicular to the shaft.
 */
export function arrowHead(tip, from, length, angle = 0.17 * Math.PI)
{
  const shaft = Math.atan2(tip.y - from.y, tip.x - from.x);
  const back = shaft + Math.PI;
  return [
    [tip, { x: tip.x + Math.cos(back - angle) * length, y: tip.y + Math.sin(back - angle) * length }],
    [tip, { x: tip.x + Math.cos(back + angle) * length, y: tip.y + Math.sin(back + angle) * length }],
  ];
}

/**
 * A leader that sweeps rather than pokes.
 *
 * A two-point "curve" is a straight line no matter how high Rough.js's bowing is set,
 * so a short direct leader reads as a stubby chevron. Bowing the chord out into an arc
 * and sampling it gives the long graceful pull that makes a callout look drawn rather
 * than computed, and it also buys clearance: the arc leaves the label, travels through
 * open space, and arrives at the target from outside it.
 *
 * `side` is +1 or -1 for which way the arc bows; `pickBow` chooses it.
 */
export function curvedLeader(from, to, { bow = 0.2, side = 1, samples = 24 } = {})
{
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1)
  {
    return [from, to];
  }

  // Control point: the chord midpoint, pushed perpendicular.
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const control = {
    x: midX + (-dy / length) * length * bow * side,
    y: midY + (dx / length) * length * bow * side,
  };

  const points = [];
  for (let step = 0; step <= samples; step++)
  {
    const t = step / samples;
    const inverse = 1 - t;
    points.push({
      x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
      y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
    });
  }
  return points;
}

/** Bow whichever way keeps the arc clear of everything; ties break away from the target. */
export function pickBow(from, to, obstacles, options)
{
  const candidates = [1, -1].map((side) => ({
    side,
    points: curvedLeader(from, to, { ...options, side }),
  }));

  for (const candidate of candidates)
  {
    candidate.hits = pathHits(candidate.points, obstacles);
  }

  candidates.sort((a, b) => a.hits - b.hits);
  return candidates[0];
}

export function segmentIntersectsRect(a, b, rect)
{
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  if (Math.max(a.x, b.x) < left || Math.min(a.x, b.x) > right) { return false; }
  if (Math.max(a.y, b.y) < top || Math.min(a.y, b.y) > bottom) { return false; }

  const inside = (point) => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  if (inside(a) || inside(b)) { return true; }

  const crosses = (p1, p2, p3, p4) =>
  {
    const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(d) < 1e-9) { return false; }
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  const corners = [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: left, y: bottom }],
    [{ x: left, y: bottom }, { x: left, y: top }],
  ];
  return corners.some(([p3, p4]) => crosses(a, b, p3, p4));
}

function pathHits(points, obstacles)
{
  let hits = 0;
  for (let index = 0; index < points.length - 1; index++)
  {
    for (const obstacle of obstacles)
    {
      if (segmentIntersectsRect(points[index], points[index + 1], obstacle))
      {
        hits++;
      }
    }
  }
  return hits;
}

/**
 * Route a leader from a label to a target without crossing anything.
 *
 * §5.1.4 is a hard rule and it is easy to violate by accident: a straight line from a
 * label to the reveal toggle sliced diagonally across the Sign In button. Candidates are
 * tried cheapest-looking first and the first clean one wins; if every candidate is
 * blocked, the least-blocked one is returned so the figure still renders and the caller
 * can warn.
 */
export function routeLeader(from, to, obstacles, options = {})
{
  const { lane = 0 } = options;

  const candidates = [
    [from, to],
    // Out horizontally into a free lane, then in.
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
  ];

  if (lane)
  {
    candidates.push(
      [from, { x: from.x, y: lane }, { x: to.x, y: lane }, to],
      [from, { x: lane, y: from.y }, { x: lane, y: to.y }, to]);
  }

  let best = candidates[0];
  let bestHits = Infinity;
  for (const candidate of candidates)
  {
    const hits = pathHits(candidate, obstacles);
    if (hits === 0)
    {
      return { points: candidate, blocked: false };
    }
    if (hits < bestHits)
    {
      bestHits = hits;
      best = candidate;
    }
  }
  return { points: best, blocked: true };
}

/** A thin rect around a polyline, so a drawn leader becomes an obstacle for later ones. */
export function polylineBounds(points, thickness)
{
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs) - thickness,
    y: Math.min(...ys) - thickness,
    width: Math.max(...xs) - Math.min(...xs) + thickness * 2,
    height: Math.max(...ys) - Math.min(...ys) + thickness * 2,
  };
}
