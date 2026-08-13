// Draw engines shared by the presets.
//
// Each preset module is mostly a parameter set. What differs between them is colour,
// face, seed and which of these engines runs; keeping the engines here is what stops
// nine near-identical copies of the leader-and-label code drifting apart.

/** Corner radius to ring a control with. §5.2: match the control's own radius, and never
 *  use an ellipse — it clips field corners and slices through label text. */
function ringRadius(rect, scale)
{
  return Math.min(rect.height / 2, scale.gap * 1.1);
}

function drawLabel(sketch, placement, { slot, colour, size })
{
  if (!placement.lines.length)
  {
    return;
  }
  sketch.textBlock(placement.lines, placement.anchor, {
    slot,
    size: size ?? placement.fontSize,
    colour,
    anchor: placement.textAnchor,
  });
}

/**
 * The label's own ground.
 *
 * For the case where the pixels under a label cannot carry the ink at any ink value.
 * The dimmed page behind a modal is the worked example: it is a flat mid grey, and mid
 * grey is the worst possible ground — nothing is far from it in luminance, so pure white
 * tops out under the 3:1 floor for large text and every amber in the palette is worse
 * than that. The lever is the ground, not the ink.
 *
 * Drawn in its own pass ahead of the leaders so a leader crossing another label's plate
 * stays on top of it rather than disappearing under it.
 */
function drawPlate(sketch, placement, style, palette, scale)
{
  const plate = placement.plate;
  if (!plate || !placement.lines.length)
  {
    return;
  }

  const fill = plate.fill ?? palette.plateFill;
  if (!fill)
  {
    // Better to stop than to guess. A plate is a ground, and a ground the style has not
    // chosen an ink for produces a label that renders and cannot be read — which is the
    // exact defect the plate exists to fix, arriving silently.
    throw new Error(
      `"${style.name}" has no plateFill/plateInk in its palette, so it cannot draw a ` +
      'label plate. Add both to the style, or set "labelPlate" false on this spec.');
  }

  sketch.plate(plate.rect, {
    fill,
    opacity: plate.opacity ?? palette.plateOpacity ?? 0.82,
    // A pill, not a card: the radius goes to half the height unless the spec says
    // otherwise, which is a shape no control in the app has.
    radius: plate.radius ?? Math.min(plate.rect.height / 2, scale.gap * 1.6),
    hand: plate.hand ?? true,
  });
}

function drawLeader(sketch, placement, { colour, width, headLength, curved = true })
{
  if (!placement.leaderPoints || placement.leaderPoints.length < 2)
  {
    return;
  }
  sketch.arrow(placement.leaderPoints, { colour, width, headLength, curved });
}

/** Ring the control, label it, and join the two. plain-ink and marker-rings. */
export function ringEngine(sketch, layout, style, palette)
{
  const { scale } = layout;
  const strokeWidth = scale.stroke * (style.strokeScale ?? 1);

  for (const placement of layout.placements)
  {
    sketch.ring(placement.ring, {
      radius: ringRadius(placement.rect, scale),
      colour: palette.ring,
      width: strokeWidth,
      start: style.ringStart ?? 0.12,
      travel: style.ringTravel ?? 1.07,
    });
  }

  for (const placement of layout.placements)
  {
    drawPlate(sketch, placement, style, palette, scale);
  }

  for (const placement of layout.placements)
  {
    drawLeader(sketch, placement, {
      colour: palette.leader,
      width: strokeWidth * 0.85,
      headLength: scale.arrowHead,
    });

    // Numbered steps still get a bubble. marker-rings is the house style, so if it
    // ignored `number` any figure using it would silently drop the step numbering the
    // prose depends on — the sign-in figure's 1/2/3 map onto the numbered list in
    // signing-in.md. A callout with no number stays unnumbered, which is what §5.1.5
    // requires for a sub-control the prose folds into another step.
    // Position comes from the layout, which reserved the space for it and started the
    // leader on its far side. Re-deriving it here is how the bubble ends up sitting on
    // top of the ring with the leader hidden underneath.
    if (placement.number != null && placement.bubbleAt)
    {
      sketch.bubble(placement.number, placement.bubbleAt, {
        radius: placement.bubbleRadius,
        fill: palette.bubbleFill ?? 'rgba(255,255,255,0.92)',
        colour: palette.ring,
        textColour: palette.bubbleText ?? palette.ring,
        width: strokeWidth,
        size: placement.bubbleRadius * 1.45,
      });
    }

    // A plated label takes the plate's ink, not the figure's. The figure-wide label
    // colour was chosen for the ground the figure is on; the plate is a different ground.
    drawLabel(sketch, placement, {
      slot: style.font,
      colour: placement.plate
        ? (placement.plate.ink ?? palette.plateInk ?? palette.label)
        : palette.label,
    });
  }
}

/** A highlighter band behind each control, punched out so the control keeps its colour. */
export function bandEngine(sketch, layout, style, palette)
{
  const { scale } = layout;
  const strokeWidth = scale.stroke * (style.strokeScale ?? 1);

  for (const placement of layout.placements)
  {
    const band = {
      x: placement.rect.x - scale.gap * 0.5,
      y: placement.rect.y - scale.gap * 0.25,
      width: placement.rect.width + scale.gap,
      height: placement.rect.height + scale.gap * 0.5,
    };
    // §5.1.3 — the control is punched out of the band's alpha, so the band reads as
    // sitting behind the UI instead of tinting it.
    sketch.bandBehind(band, [placement.rect], {
      fill: palette.band,
      opacity: style.bandOpacity ?? 0.75,
      radius: scale.gap * 0.4,
      holeRadius: ringRadius(placement.rect, scale),
    });
  }

  for (const placement of layout.placements)
  {
    drawLeader(sketch, placement, {
      colour: palette.leader,
      width: strokeWidth * 0.85,
      headLength: scale.arrowHead,
    });
    drawLabel(sketch, placement, { slot: style.font, colour: palette.label });
  }
}

/** A numbered bubble pinned to the control, with the label beside it. */
export function bubbleEngine(sketch, layout, style, palette)
{
  const { scale } = layout;
  const strokeWidth = scale.stroke * (style.strokeScale ?? 1);
  const radius = scale.arrowHead * (style.bubbleScale ?? 0.95);

  for (const placement of layout.placements)
  {
    if (style.ringBubbles !== false)
    {
      sketch.ring(placement.ring, {
        radius: ringRadius(placement.rect, scale),
        colour: palette.ring,
        width: strokeWidth,
        start: style.ringStart ?? 0.2,
        travel: style.ringTravel ?? 1.05,
      });
    }
  }

  for (const placement of layout.placements)
  {
    drawLeader(sketch, placement, {
      colour: palette.leader,
      width: strokeWidth * 0.8,
      headLength: scale.arrowHead * 0.9,
    });

    // An unnumbered callout is deliberate, not an omission: §5.1.5 forbids inventing a
    // step the prose does not have, so a sub-control folded into another step gets a
    // label and no bubble.
    if (placement.number != null)
    {
      const side = placement.textAnchor === 'end' ? 1 : -1;
      const pin = {
        x: placement.anchor.x + side * (radius + scale.gap * 0.35),
        y: placement.anchor.y,
      };
      sketch.bubble(placement.number, pin, {
        radius,
        fill: palette.bubbleFill,
        colour: palette.ring,
        textColour: palette.bubbleText,
        width: strokeWidth,
        size: radius * 1.45,
      });
    }

    drawLabel(sketch, placement, { slot: style.font, colour: palette.label });
  }
}

/** Straight rules and plated labels — the non-sketch presets. */
export function cleanEngine(sketch, layout, style, palette)
{
  const { scale } = layout;
  const strokeWidth = scale.stroke * (style.strokeScale ?? 1);

  if (style.scrim)
  {
    // Dim everything except the targets. Same alpha-punch trick as the highlighter band:
    // the targets keep their true colour, only their surroundings darken.
    sketch.bandBehind(
      { x: 0, y: 0, width: sketch.width, height: sketch.height },
      layout.placements.map((placement) => placement.ring),
      { fill: palette.scrim, opacity: style.scrimOpacity ?? 0.55, radius: 0, holeRadius: scale.gap });
  }

  for (const placement of layout.placements)
  {
    if (style.outline !== false)
    {
      sketch.plate(placement.ring, {
        fill: 'none',
        radius: ringRadius(placement.rect, scale),
        stroke: palette.ring,
        strokeWidth,
      });
    }
  }

  for (const placement of layout.placements)
  {
    drawLeader(sketch, placement, {
      colour: palette.leader,
      width: strokeWidth * 0.8,
      headLength: scale.arrowHead,
      curved: false,
    });

    if (placement.lines.length && style.labelPlate !== false)
    {
      const pad = scale.gap * 0.45;
      sketch.plate({
        x: placement.labelBox.x - pad,
        y: placement.labelBox.y - pad * 0.6,
        width: placement.labelBox.width + pad * 2,
        height: placement.labelBox.height + pad * 1.2,
      }, {
        fill: palette.plate,
        radius: pad,
        stroke: palette.plateBorder,
        strokeWidth: palette.plateBorder ? strokeWidth * 0.5 : 0,
        opacity: style.plateOpacity ?? 1,
      });
    }

    if (placement.number != null && style.numberInline !== false)
    {
      const side = placement.textAnchor === 'end' ? 1 : -1;
      sketch.bubble(placement.number, {
        x: placement.anchor.x + side * (scale.arrowHead + scale.gap * 0.3),
        y: placement.anchor.y,
      }, {
        radius: scale.arrowHead * 0.85,
        fill: palette.bubbleFill,
        colour: palette.ring,
        textColour: palette.bubbleText,
        width: strokeWidth * 0.8,
        size: scale.arrowHead * 1.2,
      });
    }

    drawLabel(sketch, placement, { slot: style.font, colour: palette.label });
  }
}

export const ENGINES = {
  ring: ringEngine,
  band: bandEngine,
  bubble: bubbleEngine,
  clean: cleanEngine,
};
