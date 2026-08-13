// Decide where labels sit, how big the figure is, and how each leader gets to its target.
//
// Two rules from §5 drive almost everything here:
//   §5.2  crop tight; add margin *only* where an annotated region touches the frame
//   §5.1.4 leaders must not cross controls or each other

import {
  inflate,
  metrics as scaleMetrics,
  pickBow,
  polylineBounds,
  routeLeader,
  unionRect,
} from './geometry.mjs';
import { inkExtent, measureText, scaledSize, wrapText } from './text.mjs';
import { touchesFrame } from './select.mjs';

/**
 * Nudge a label off its default position, as a fraction of the figure.
 *
 * A label sitting directly above its target gets a stub of a leader with nowhere to
 * curve. Sliding it along the panel gives the arc a run and makes the figure breathe —
 * `"labelShift": [-0.12, 0]` moves it 12% of the figure width to the left.
 */
function applyShift(anchor, shift, figure)
{
  if (!shift)
  {
    return;
  }
  const [dx = 0, dy = 0] = shift;
  anchor.x += dx * figure.width;
  anchor.y += dy * figure.height;
}

/** Clamp that stays sane when the range is inverted (label wider than the free region). */
function clamp(value, low, high)
{
  if (high < low)
  {
    return (low + high) / 2;
  }
  return Math.min(Math.max(value, low), high);
}

function nearestFrameSide(rect, report, slack = 4)
{
  const distances = [
    { side: 'top', value: rect.y },
    { side: 'left', value: rect.x },
    { side: 'bottom', value: report.height - (rect.y + rect.height) },
    { side: 'right', value: report.width - (rect.x + rect.width) },
  ].sort((a, b) => a.value - b.value);

  return distances[0].value <= slack ? distances[0].side : null;
}

/**
 * A panel spanning the full width can only be labelled above or below it; one spanning
 * the full height only to its left or right. Picking the side by raw distance alone puts
 * the title-bar label off the left edge, where it reads as belonging to the nav.
 */
function preferredSide(rect, report)
{
  const spansWidth = rect.width >= report.width * 0.9;
  const spansHeight = rect.height >= report.height * 0.9;

  if (spansWidth && !spansHeight)
  {
    return rect.y < report.height / 2 ? 'top' : 'bottom';
  }
  if (spansHeight && !spansWidth)
  {
    return rect.x < report.width / 2 ? 'left' : 'right';
  }

  const frameSide = nearestFrameSide(rect, report);
  if (frameSide)
  {
    return frameSide;
  }

  const spaceRight = report.width - (rect.x + rect.width);
  const spaceLeft = rect.x;
  return spaceRight >= spaceLeft ? 'right' : 'left';
}

/**
 * Lay out the figure, sizing strokes and arrowheads to the finished canvas.
 *
 * Every drawing metric — stroke weight, arrowhead length, bubble radius, ring padding —
 * used to be derived from the *capture* width. That is fine while every figure is a
 * full-screen 2880px grab, and badly wrong the moment one is a small crop: a 468px-wide
 * menu detail got a 0.8px stroke where the app-shell figure got 5px, so the same style
 * rendered as spidery hairlines on one figure and confident marker on another.
 *
 * What actually has to stay constant is the weight *as published*, and since the help
 * site scales every figure into the same content column, that means sizing off the
 * finished canvas. The canvas size is not known until the layout has run, so run it
 * twice: once to learn the figure size, then again with the metrics that size implies.
 * A second pass can nudge the margins, so iterate to a fixed point — it converges in two
 * or three rounds and is capped so it always terminates.
 */
export function layoutFigure(input)
{
  let basis = input.report.width;
  let result = layoutOnce(input, basis);

  for (let pass = 0; pass < 3; pass++)
  {
    if (Math.abs(result.figure.width - basis) <= 1)
    {
      break;
    }
    basis = result.figure.width;
    result = layoutOnce(input, basis);
  }

  return result;
}

function layoutOnce({ report, callouts, style, options = {} }, scaleBasis)
{
  const {
    crop = 'auto',
    margin: forcedMargin,
    cropPadding = 0.035,
    maxLabelWidth = 0.28,
  } = options;

  // Strokes and arrowheads scale to the finished canvas; type still scales to the
  // capture, because label size is judged against the UI it sits beside.
  const scale = scaleMetrics(scaleBasis);
  const nominalSize = report.width / 46;
  const slot = style.font;
  // Type is sized off the capture width, which under-sizes it badly on a small crop:
  // a 468px-wide menu detail gets 12px labels, smaller than the body text they sit
  // beside in the article. `fontScale` lets a small figure lift them.
  const fontSize = scaledSize(slot, nominalSize) * (options.fontScale ?? 1);
  const labelLimit = report.width * maxLabelWidth;

  // ── 1. Side and label metrics, still in screenshot coordinates ──────────────
  const placements = callouts.map((callout) =>
  {
    const side = callout.side ?? preferredSide(callout.rect, report);
    const inMargin = Boolean(nearestFrameSide(callout.rect, report)) || callout.margin === true;
    const text = callout.label ?? '';
    const lines = text ? wrapText(text, slot, fontSize, labelLimit, callout.maxLines ?? 2) : [];
    const width = lines.length ? Math.max(...lines.map((line) => measureText(line, slot, fontSize))) : 0;
    const height = lines.length * fontSize * 1.25;
    return { ...callout, side, inMargin, lines, labelWidth: width, labelHeight: height, fontSize };
  });

  // ── 2. Margins, from whatever has to live outside the screenshot ────────────
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };

  // How far a margin leader should travel before it reaches its target. Four arrowheads
  // is long enough to read as a deliberate pointer at any canvas size.
  const leaderRun = options.leaderRun ?? scale.arrowHead * 4;

  // A backdrop only reads as one if the window floats on it. Without a floor here the
  // screenshot runs to the figure's edge on any side that happens to carry no label, and
  // the gradient survives as two stripes rather than a surround.
  if (options.backdrop)
  {
    const floor = options.backdropPadding ?? report.width * 0.045;
    margin.top = floor;
    margin.right = floor;
    margin.bottom = floor;
    margin.left = floor;
  }

  if (forcedMargin)
  {
    Object.assign(margin, forcedMargin);
  }
  else
  {
    for (const placement of placements)
    {
      // A label placed in open space inside the frame needs no gutter, even though its
      // target touches the frame.
      if (!placement.inMargin || placement.labelRect)
      {
        continue;
      }
      // Room for the label AND for the leader to actually travel. Sizing the gutter to
      // the label alone leaves the arrow nowhere to go: the label ends up hard against
      // the ring and the leader degenerates into a stub barb a few pixels long, which
      // reads as a stray tick rather than a pointer. `leaderRun` is the sweep.
      const needed = placement.side === 'left' || placement.side === 'right'
        ? placement.labelWidth + leaderRun + scale.gap * 2
        : placement.labelHeight + leaderRun + scale.gap * 2;
      margin[placement.side] = Math.max(margin[placement.side], needed);
    }
  }

  // ── 3. Crop ─────────────────────────────────────────────────────────────────
  let cropRect;
  if (Array.isArray(crop))
  {
    const [x, y, width, height] = crop;
    cropRect = { x, y, width, height };
  }
  else if (crop === 'none' || placements.some((placement) => placement.inMargin))
  {
    // Nothing to gain from cropping when the annotated regions are the frame itself.
    cropRect = { x: 0, y: 0, width: report.width, height: report.height };
  }
  else
  {
    // Cropping to the targets alone amputates whatever contains them — on the sign-in
    // screen it slices the card in half and the figure reads as a floating fragment with
    // no context. `cropInclude` names a container that must survive the crop.
    const targets = placements.map((placement) => placement.rect);
    if (options.includeRect)
    {
      targets.push(options.includeRect);
    }
    const labelReach = placements.map((placement) =>
    {
      const box = placement.rect;
      const reach = placement.labelWidth + scale.gap * 4;
      return placement.side === 'left'
        ? { x: box.x - reach, y: box.y, width: reach, height: box.height }
        : { x: box.x + box.width, y: box.y, width: reach, height: box.height };
    });
    const pad = report.width * cropPadding;
    const union = inflate(unionRect([...targets, ...labelReach]), pad);
    cropRect = {
      x: Math.max(0, Math.round(union.x)),
      y: Math.max(0, Math.round(union.y)),
      width: Math.min(report.width, Math.round(union.x + union.width)) - Math.max(0, Math.round(union.x)),
      height: Math.min(report.height, Math.round(union.y + union.height)) - Math.max(0, Math.round(union.y)),
    };
  }

  const offset = { x: margin.left - cropRect.x, y: margin.top - cropRect.y };
  const figure = {
    width: Math.round(cropRect.width + margin.left + margin.right),
    height: Math.round(cropRect.height + margin.top + margin.bottom),
  };

  // ── 4. Place labels in figure coordinates ───────────────────────────────────
  const shift = (rect) => ({ ...rect, x: rect.x + offset.x, y: rect.y + offset.y });

  const shiftedRects = placements.map((placement) => shift(placement.rect));

  const laid = placements.map((placement, index) =>
  {
    const rect = shiftedRects[index];

    // Rings must not run into each other. Two different geometries cause that:
    //
    // Panels TILE the frame — the title bar's bottom edge IS the nav's top edge, and the
    // status bar shares its top edge with both the nav and the rail. Inflating those
    // outward turns every shared border into a doubled line and mushes the corners where
    // three panels meet. A region reads just as clearly ringed inside its own bounds.
    //
    // Stacked controls have the same problem in miniature: the sign-in fields sit 36px
    // apart, so a fixed 21px pad on each closes the gap entirely and the rings merge.
    // Capping the pad at the real clearance to the nearest neighbour keeps a visible
    // channel between them whatever the spacing turns out to be.
    const ring = ringAround(rect, shiftedRects, scale);
    let anchor;
    let textAnchor = 'start';

    // `labelIn` places the label in open space inside the frame rather than beside the
    // target. For a frame panel — the nav, the activity rail — hugging the target means
    // hugging the edge of the picture; dropping the label into the empty content area
    // and letting a long leader sweep across to it is what the reference figures do.
    if (placement.labelRect)
    {
      const free = shift(placement.labelRect);
      // Sit in the open space, but at the end of it nearest the target rather than dead
      // centre — a label centred in a large empty region looks adrift and lengthens its
      // own leader for nothing.
      const pad = scale.gap * 1.5;
      const halfWidth = placement.labelWidth / 2 + pad;
      const halfHeight = Math.max(placement.labelHeight, placement.fontSize) / 2 + pad;
      const targetCentre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const nearest = {
        x: clamp(targetCentre.x, free.x + halfWidth, free.x + free.width - halfWidth),
        y: clamp(targetCentre.y, free.y + halfHeight, free.y + free.height - halfHeight),
      };
      const middle = { x: free.x + free.width / 2, y: free.y + free.height / 2 };
      // Lerp between the middle of the open space and the point closest to the target.
      // Pinning it to `nearest` collapses the leader to a stub against the target's edge;
      // sitting at `middle` can look adrift in a large empty area. Leaning toward the
      // target keeps the label associated with it while leaving room for the arc to run.
      const bias = placement.labelBias ?? 0.35;
      anchor = {
        x: middle.x + (nearest.x - middle.x) * bias,
        y: middle.y + (nearest.y - middle.y) * bias,
      };
      textAnchor = 'middle';
      applyShift(anchor, placement.labelShift, figure);
      return {
        ...placement,
        rect,
        ring,
        anchor,
        textAnchor,
        labelBox: {
          x: anchor.x - placement.labelWidth / 2,
          y: anchor.y - placement.labelHeight / 2,
          width: placement.labelWidth,
          height: Math.max(placement.labelHeight, placement.fontSize),
        },
        freeRect: free,
      };
    }

    // A label in a gutter goes to the OUTER end of it, not up against the target. The
    // gutter was sized to hold the label plus a full `leaderRun`, so anchoring at the
    // outer edge spends that space on the leader; anchoring next to the ring instead
    // leaves the arrow with nothing to cross and it collapses to a stub barb.
    const outer = scale.gap * 1.5;

    // A label beside its target has to clear three things, not one: the bubble that sits
    // between it and the target, the leader's run, and a gap at each end. Offsetting by
    // `gap` alone puts a ~58px bubble into a 24px slot, so the bubble lands on top of the
    // ring and the leader disappears underneath it entirely.
    const bubbleRadius = placement.number == null ? 0 : scale.arrowHead * 0.95;
    const bubbleSpan = bubbleRadius ? bubbleRadius * 2 + scale.gap * 0.8 : 0;
    const standoff = scale.gap * 0.6 + bubbleSpan + leaderRun;

    switch (placement.side)
    {
      case 'left':
        anchor = {
          x: placement.inMargin ? outer + placement.labelWidth : ring.x - standoff,
          y: rect.y + rect.height / 2,
        };
        textAnchor = 'end';
        break;
      case 'right':
        anchor = {
          x: placement.inMargin
            ? figure.width - outer - placement.labelWidth
            : ring.x + ring.width + standoff,
          y: rect.y + rect.height / 2,
        };
        break;
      case 'top':
        anchor = {
          x: rect.x + rect.width / 2,
          y: placement.inMargin
            ? outer + placement.labelHeight / 2
            : ring.y - standoff - placement.labelHeight / 2,
        };
        textAnchor = 'middle';
        break;
      case 'bottom':
      default:
        anchor = {
          x: rect.x + rect.width / 2,
          y: placement.inMargin
            ? figure.height - outer - placement.labelHeight / 2
            : ring.y + ring.height + standoff + placement.labelHeight / 2,
        };
        textAnchor = 'middle';
        break;
    }

    // Keep the label inside the figure. Clamping the anchor alone is not enough: with
    // text-anchor start the string grows rightwards from it, so an anchor that is itself
    // in bounds can still run the label off the edge.
    const inset = scale.gap;
    const leftLimit = textAnchor === 'end' ? inset + placement.labelWidth
      : textAnchor === 'middle' ? inset + placement.labelWidth / 2
        : inset;
    const rightLimit = textAnchor === 'start' ? figure.width - inset - placement.labelWidth
      : textAnchor === 'middle' ? figure.width - inset - placement.labelWidth / 2
        : figure.width - inset;
    applyShift(anchor, placement.labelShift, figure);
    anchor.x = Math.min(Math.max(anchor.x, leftLimit), Math.max(leftLimit, rightLimit));
    anchor.y = Math.min(Math.max(anchor.y, inset + placement.labelHeight / 2),
      figure.height - inset - placement.labelHeight / 2);

    const labelBox = {
      x: textAnchor === 'end' ? anchor.x - placement.labelWidth
        : textAnchor === 'middle' ? anchor.x - placement.labelWidth / 2
          : anchor.x,
      y: anchor.y - placement.labelHeight / 2,
      width: placement.labelWidth,
      height: Math.max(placement.labelHeight, placement.fontSize),
    };

    // Where the bubble goes is a layout decision, not a drawing one: the leader has to
    // start on the far side of it. Styles read `bubbleAt` rather than re-deriving it,
    // so the two can't disagree and hide the leader behind the bubble.
    let bubbleAt = null;
    if (bubbleRadius)
    {
      const step = bubbleRadius + scale.gap * 0.4;
      switch (placement.side)
      {
        case 'left': bubbleAt = { x: anchor.x + step, y: anchor.y }; break;
        case 'right': bubbleAt = { x: anchor.x - step, y: anchor.y }; break;
        case 'top': bubbleAt = { x: anchor.x, y: anchor.y + placement.labelHeight / 2 + step }; break;
        default: bubbleAt = { x: anchor.x, y: anchor.y - placement.labelHeight / 2 - step }; break;
      }
    }

    return { ...placement, rect, ring, anchor, textAnchor, labelBox, bubbleAt, bubbleRadius };
  });

  // ── 5. Push overlapping labels apart ────────────────────────────────────────
  for (let outer = 0; outer < laid.length; outer++)
  {
    for (let inner = 0; inner < outer; inner++)
    {
      const a = laid[outer].labelBox;
      const b = laid[inner].labelBox;
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
      if (!overlaps)
      {
        continue;
      }
      const push = (b.y + b.height) - a.y + scale.gap * 0.5;
      laid[outer].labelBox.y += push;
      laid[outer].anchor.y += push;
    }
  }

  // ── 5b. Label plates ────────────────────────────────────────────────────────
  // A plate gives a label its own ground. It exists for the case where the pixels the
  // label lands on cannot carry the ink at any ink value — a mid grey is the worst of
  // them, because nothing is far from it in luminance and lightening the ink is not a
  // lever that reaches. Off unless a spec asks; see SKILL.md.
  //
  // Geometry only here. Which colours a plate takes is the style's business, and is
  // resolved against the palette when it is drawn.
  for (const placement of laid)
  {
    const wanted = placement.labelPlate ?? options.labelPlate ?? false;
    if (!wanted || !placement.lines.length)
    {
      continue;
    }
    const config = wanted === true ? {} : wanted;
    // Padding tracks the type, not the canvas. The plate has to clear the ascenders and
    // descenders of a handwriting face, and those scale with the label — a canvas-derived
    // pad would crop the glyphs on a figure whose labels happen to be small for their
    // frame, which is most crops.
    const padX = placement.fontSize * (config.padX ?? 0.5);
    const padY = placement.fontSize * (config.padY ?? 0.34);
    // Vertically the plate hugs the ink, not the label box: the box is line spacing, so
    // padding it leaves a third of an em of dead air above the caps and almost none under
    // the descenders. See inkExtent in text.mjs.
    const ink = inkExtent(placement.lines, slot, placement.fontSize);
    const rect = {
      x: placement.labelBox.x - padX,
      y: placement.anchor.y + ink.top - padY,
      width: placement.labelBox.width + padX * 2,
      height: (ink.bottom - ink.top) + padY * 2,
    };

    // Keep it inside the figure. The anchor was clamped against the label's own width,
    // which does not know about the plate, so a label already sitting at the inset would
    // otherwise have its plate run off the edge — and the text with it, since the two
    // have to move together to stay centred.
    const inset = scale.gap * 0.5;
    const overflow = Math.min(0, rect.x - inset) +
      Math.max(0, rect.x + rect.width - (figure.width - inset));
    if (overflow !== 0)
    {
      rect.x -= overflow;
      placement.labelBox.x -= overflow;
      placement.anchor.x -= overflow;
    }

    placement.plate = { ...config, rect };
  }

  // ── 6. Leaders ──────────────────────────────────────────────────────────────
  const obstacles = laid.map((placement) => placement.rect);
  const drawn = [];
  const warnings = [];

  for (const placement of laid)
  {
    if (placement.leader === false)
    {
      continue;
    }

    // The leader leaves from the edge of the label that FACES the target. Taking the
    // far edge instead draws the line straight back through its own text.
    //
    // When the callout is numbered, the bubble sits in that gap, so the leader has to
    // start beyond the bubble — starting at the label edge buries the whole shaft under
    // the bubble and leaves only the barb showing.
    // A plated label's footprint is the plate, not the type inside it — start the leader
    // at the plate's edge or it launches from under the plate and loses its first inch.
    const box = placement.plate?.rect ?? placement.labelBox;
    const target = {
      x: placement.ring.x + placement.ring.width / 2,
      y: placement.ring.y + placement.ring.height / 2,
    };
    const from = placement.bubbleAt
      ? exitPoint({
        x: placement.bubbleAt.x - placement.bubbleRadius,
        y: placement.bubbleAt.y - placement.bubbleRadius,
        width: placement.bubbleRadius * 2,
        height: placement.bubbleRadius * 2,
      }, target, scale.gap * 0.35)
      : exitPoint(box, target, scale.gap * 0.45);

    // Aim at the ring, not the control, so the barb stops outside the element.
    const to = aimPoint(placement.ring, from, placement.aimSlide ?? 1.2);

    // A control that *encloses* this one cannot be an obstacle for it: the reveal toggle
    // sits inside the password field, so every possible leader to the toggle ends inside
    // the field and no route can ever be clean. Skipping enclosing rects is what keeps
    // §5.1.4 a meaningful check rather than a warning that always fires.
    const others = obstacles.filter((rect) =>
      rect !== placement.rect && !enclosesRect(rect, placement.rect));
    const blockers = [...others, ...drawn];

    // Prefer a swept arc. Only fall back to the elbow router when no bow direction is
    // clean — an elbow is legible but mechanical, and the arc is the house look.
    // Bow as a fraction of length sags proportionally, so a long run swings far out of
    // its lane. With several labels stacked in one gutter pointing at rows stacked in the
    // same order, that sag is what makes the leaders cross each other — they should run
    // parallel. Cap the sag in absolute terms so long leaders stay flat and short ones
    // keep their curve.
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const bowFraction = placement.bow ?? Math.min(0.22, (scale.arrowHead * 1.6) / Math.max(span, 1));
    const bow = pickBow(from, to, blockers, { bow: bowFraction });
    let points;
    let blocked = false;

    if (bow.hits === 0)
    {
      points = bow.points;
    }
    else
    {
      const route = routeLeader(from, to, blockers);
      blocked = route.blocked;
      // A blocked elbow is no better than a blocked arc, and the arc looks better.
      points = blocked && bow.hits <= 1 ? bow.points : route.points;
    }

    if (blocked)
    {
      warnings.push(
        `leader for "${placement.label ?? placement.number}" could not avoid every element`);
    }
    drawn.push(polylineBounds(points, scale.stroke * 2));
    placement.leaderPoints = points;
  }

  return { figure, cropRect, margin, offset, placements: laid, scale, fontSize, warnings };
}

/**
 * Where a leader leaves its label: the point on the label's box, plus a small gap, in
 * the direction of the target. Works for a label placed anywhere, which the side-based
 * version could not — a label dropped into open space has no meaningful "side".
 */
function exitPoint(box, target, gap)
{
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const dx = target.x - centre.x;
  const dy = target.y - centre.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6)
  {
    return centre;
  }

  // Scale the direction vector until it lands on the box boundary.
  const halfWidth = box.width / 2 + gap;
  const halfHeight = box.height / 2 + gap;
  const scaleX = Math.abs(dx) > 1e-6 ? halfWidth / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 1e-6 ? halfHeight / Math.abs(dy) : Infinity;
  const t = Math.min(scaleX, scaleY);
  return { x: centre.x + dx * t, y: centre.y + dy * t };
}

/**
 * Fit a ring around a target, padding each of its four edges independently.
 *
 * Padding the whole rect by one figure fails at both extremes. Inflate uniformly and
 * tiled panels drive their rings into each other — the title bar's bottom edge IS the
 * nav's top edge, so every shared border doubles up and the corners mush. Inset
 * uniformly and a thin full-width band gets crushed: the status bar is 48px tall in a
 * 2880px-wide capture, so insetting all four edges pulls both long strokes onto the
 * status text and the "ring" reads as a scribble through the content.
 *
 * Per edge is what actually works. An edge facing a neighbouring target insets just
 * enough to leave a visible channel; an edge facing open space or the frame inflates
 * normally and, on a boundary panel, spills harmlessly into the backdrop margin. The
 * status bar then insets only its top and opens downward, which keeps both strokes off
 * the text.
 */
function ringAround(rect, others, scale)
{
  const wanted = scale.ringPadMax;
  // Positive is outward. Never inset so far that the stroke lands on the content.
  const maxInset = scale.stroke * 1.5;
  const pads = { top: wanted, right: wanted, bottom: wanted, left: wanted };

  const narrow = (edge, gap) =>
  {
    pads[edge] = Math.max(-maxInset, Math.min(pads[edge], gap / 2 - scale.stroke));
  };

  for (const other of others)
  {
    // A nested target (the reveal toggle inside the password field) has no clearance by
    // definition and would otherwise collapse its parent's ring to nothing.
    if (other === rect || enclosesRect(rect, other) || enclosesRect(other, rect))
    {
      continue;
    }

    // Only neighbours that line up on the perpendicular axis constrain an edge. A
    // control off to one side does not limit how far this one's ring may grow upward.
    if (rect.x < other.x + other.width && rect.x + rect.width > other.x)
    {
      if (other.y + other.height <= rect.y)
      {
        narrow('top', rect.y - (other.y + other.height));
      }
      if (other.y >= rect.y + rect.height)
      {
        narrow('bottom', other.y - (rect.y + rect.height));
      }
    }

    if (rect.y < other.y + other.height && rect.y + rect.height > other.y)
    {
      if (other.x + other.width <= rect.x)
      {
        narrow('left', rect.x - (other.x + other.width));
      }
      if (other.x >= rect.x + rect.width)
      {
        narrow('right', other.x - (rect.x + rect.width));
      }
    }
  }

  return {
    x: rect.x - pads.left,
    y: rect.y - pads.top,
    width: rect.width + pads.left + pads.right,
    height: rect.height + pads.top + pads.bottom,
  };
}

function enclosesRect(outer, inner, slack = 2)
{
  return outer.x <= inner.x + slack &&
    outer.y <= inner.y + slack &&
    outer.x + outer.width >= inner.x + inner.width - slack &&
    outer.y + outer.height >= inner.y + inner.height - slack;
}

/**
 * Where on the ring the arrow lands.
 *
 * The nearest point is the wrong answer for a big panel: a label sitting just above a
 * full-width title bar gets a leader that drops straight down for a few pixels, which
 * reads as a tick mark rather than a pointer. Sliding the landing point along the edge,
 * proportionally to how close the label already is, turns it into a diagonal that has
 * room to curve — and it still lands on the panel it names.
 */
function aimPoint(ring, from, slide)
{
  const point = closestPointOnRect(ring, from);
  if (!slide)
  {
    return point;
  }

  const right = ring.x + ring.width;
  const bottom = ring.y + ring.height;
  const centre = { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2 };
  const onHorizontalEdge = Math.abs(point.y - ring.y) < 1 || Math.abs(point.y - bottom) < 1;
  const onVerticalEdge = Math.abs(point.x - ring.x) < 1 || Math.abs(point.x - right) < 1;

  if (onHorizontalEdge && ring.width > ring.height)
  {
    const reach = Math.abs(point.y - from.y) * slide;
    const direction = Math.sign(centre.x - point.x) || 1;
    const travel = Math.min(reach, Math.abs(centre.x - point.x));
    return { x: clamp(point.x + direction * travel, ring.x, right), y: point.y };
  }

  if (onVerticalEdge && ring.height > ring.width)
  {
    const reach = Math.abs(point.x - from.x) * slide;
    const direction = Math.sign(centre.y - point.y) || 1;
    const travel = Math.min(reach, Math.abs(centre.y - point.y));
    return { x: point.x, y: clamp(point.y + direction * travel, ring.y, bottom) };
  }

  return point;
}

function closestPointOnRect(rect, point)
{
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const clampedX = Math.min(Math.max(point.x, rect.x), right);
  const clampedY = Math.min(Math.max(point.y, rect.y), bottom);

  // Snap to whichever edge is nearest, so the leader lands on the ring rather than
  // stopping at a point floating inside it.
  const distances = [
    { value: Math.abs(clampedX - rect.x), point: { x: rect.x, y: clampedY } },
    { value: Math.abs(clampedX - right), point: { x: right, y: clampedY } },
    { value: Math.abs(clampedY - rect.y), point: { x: clampedX, y: rect.y } },
    { value: Math.abs(clampedY - bottom), point: { x: clampedX, y: bottom } },
  ].sort((a, b) => a.value - b.value);

  return distances[0].point;
}
