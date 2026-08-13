// SVG emission. Styles describe what they want; this turns it into elements.
//
// Rough.js supplies the hand-drawn stroke. The prototype hand-rolled that — perpendicular
// noise on resampled paths, each stroke inked twice, tapered wobble at the ends — and all
// of it is `roughness` + `bowing` here, with a `seed` for determinism the noise code
// never had.

import rough from 'roughjs';

import { arrowHead, quadraticPathThrough, roundedRectPath } from './geometry.mjs';
import { escapeText, textBox } from './text.mjs';
import { FONTS } from './fonts.mjs';

const generator = rough.generator();

function attr(value)
{
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

export class Sketch
{
  constructor({ width, height, seed = 1, roughness = 1.1, bowing = 1 })
  {
    this.width = width;
    this.height = height;
    this.baseSeed = seed;
    this.roughness = roughness;
    this.bowing = bowing;
    this.elements = [];
    this.defs = [];
    this.shapeCount = 0;
  }

  /**
   * Rough re-uses one RNG stream per call unless told otherwise. Handing every shape the
   * same seed would give every ring the identical wobble; letting it free-run would make
   * output differ between builds. A counter off a fixed base gives variety *and* byte
   * stability.
   */
  nextSeed()
  {
    return this.baseSeed + (this.shapeCount++ * 7919);
  }

  options(overrides = {})
  {
    return {
      seed: this.nextSeed(),
      roughness: this.roughness,
      bowing: this.bowing,
      // Multi-stroke stays ON. Inking each line twice is the signature of the Rough.js
      // look — it is what reads as a considered sketch rather than one wobbly worm.
      // Disabling it and compensating with a heavier stroke was tried and is exactly
      // what made the figures look childish.
      ...overrides,
    };
  }

  emitDrawable(drawable, { colour, width, dash })
  {
    for (const path of generator.toPaths(drawable))
    {
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
      this.elements.push(
        `<path d="${path.d}" fill="none" stroke="${colour}" ` +
        `stroke-width="${attr(width)}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>`);
    }
  }

  /** Draw an SVG path string. The preferred entry point — see geometry.roundedRectPath. */
  path(d, { colour, width, dash } = {})
  {
    this.emitDrawable(
      generator.path(d, this.options({ stroke: colour, strokeWidth: width })),
      { colour, width, dash });
  }

  polyline(points, { colour, width, dash, curved = true } = {})
  {
    if (points.length < 2)
    {
      return;
    }

    // A long sampled arc is redrawn as a three-node quadratic before it reaches
    // Rough.js. Passing the raw samples makes it perturb every one of them, and the
    // line comes out furry instead of sketched.
    if (curved && points.length >= 5)
    {
      this.path(quadraticPathThrough(points), { colour, width, dash });
      return;
    }

    const list = points.map((point) => [point.x, point.y]);
    const drawable = curved
      ? generator.curve(list, this.options({ stroke: colour, strokeWidth: width }))
      : generator.linearPath(list, this.options({ stroke: colour, strokeWidth: width }));
    this.emitDrawable(drawable, { colour, width, dash });
  }

  line(from, to, options = {})
  {
    this.polyline([from, to], { ...options, curved: false });
  }

  /**
   * A ring around a control. Rounded rectangles, never ellipses — an ellipse around a
   * text field clips its corners and its long axis slices through neighbouring labels.
   *
   * `start` and `travel` produce the overshoot from §5.2: begin somewhere along the
   * perimeter and go round slightly more than once, so the stroke crosses itself the way
   * a real pen does instead of closing dead on its start point.
   */
  ring(rect, { radius = 10, colour, width } = {})
  {
    // Rough.js closes and double-inks the path itself, which already reads as a pen
    // going round twice. The hand-rolled overshoot this used to do — sampling the
    // outline and travelling 107% of the perimeter — is redundant on top of that, and
    // sampling was what made the ring furry in the first place.
    this.path(roundedRectPath(rect, radius), { colour, width });
  }

  ellipse(rect, { colour, width } = {})
  {
    const drawable = generator.ellipse(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width,
      rect.height,
      this.options({ stroke: colour, strokeWidth: width }));
    this.emitDrawable(drawable, { colour, width });
  }

  /** A leader with barbs at the last point. */
  arrow(points, { colour, width, headLength, curved = true } = {})
  {
    this.polyline(points, { colour, width, curved });
    const tip = points[points.length - 1];
    const from = points[points.length - 2] ?? points[0];
    for (const [a, b] of arrowHead(tip, from, headLength))
    {
      this.line(a, b, { colour, width });
    }
  }

  /**
   * A filled rectangle behind something — the clean presets' label plates, and the label
   * plate a sketch figure can opt into when the pixels under a label cannot carry the ink.
   *
   * `hand: true` fills the outline Rough.js drew rather than a geometric rect, so the
   * plate's edge wobbles like the rings around it. That matters: a crisp rounded rect
   * sitting on a screenshot reads as a tooltip belonging to the *product*, which is
   * exactly the confusion a figure must not create. A wobbly one reads as ink.
   */
  plate(rect, { fill, radius = 6, stroke, strokeWidth = 0, opacity = 1, hand = false } = {})
  {
    if (hand)
    {
      const drawable = generator.path(roundedRectPath(rect, radius), this.options({
        fill,
        fillStyle: 'solid',
        stroke: stroke ?? 'none',
        strokeWidth,
      }));
      for (const path of generator.toPaths(drawable))
      {
        const isFill = path.fill && path.fill !== 'none';
        this.elements.push(
          `<path d="${path.d}" fill="${isFill ? path.fill : 'none'}" ` +
          `fill-opacity="${opacity}" stroke="${isFill ? 'none' : (stroke ?? 'none')}" ` +
          `stroke-width="${attr(strokeWidth)}" stroke-linejoin="round"/>`);
      }
      return;
    }

    const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${attr(strokeWidth)}"` : '';
    this.elements.push(
      `<rect x="${attr(rect.x)}" y="${attr(rect.y)}" width="${attr(rect.width)}" ` +
      `height="${attr(rect.height)}" rx="${attr(radius)}" fill="${fill}" ` +
      `fill-opacity="${opacity}"${strokeAttr}/>`);
  }

  /**
   * A translucent band that reads as sitting *behind* the UI.
   *
   * Drawing a highlighter band straight over a control tints it — the Sign In button came
   * out olive-green, so the figure was misrepresenting the product. §5.1.3 makes that a
   * correctness bug, not a cosmetic one. The fix is to punch the control's own rounded
   * rect out of the band's alpha mask.
   */
  bandBehind(band, holes, { fill, opacity = 0.75, radius = 8, holeRadius = 8 } = {})
  {
    const id = `band-${this.shapeCount++}`;
    const cutouts = holes
      .map((hole) =>
        `<rect x="${attr(hole.x)}" y="${attr(hole.y)}" width="${attr(hole.width)}" ` +
        `height="${attr(hole.height)}" rx="${attr(holeRadius)}" fill="black"/>`)
      .join('');
    this.defs.push(
      `<mask id="${id}">` +
      `<rect x="${attr(band.x)}" y="${attr(band.y)}" width="${attr(band.width)}" ` +
      `height="${attr(band.height)}" rx="${attr(radius)}" fill="white"/>` +
      `${cutouts}</mask>`);
    this.elements.push(
      `<rect x="${attr(band.x)}" y="${attr(band.y)}" width="${attr(band.width)}" ` +
      `height="${attr(band.height)}" rx="${attr(radius)}" fill="${fill}" ` +
      `fill-opacity="${opacity}" mask="url(#${id})"/>`);
  }

  /**
   * A line of text, positioned by its centre rather than its baseline.
   *
   * §5.1.6: a label whose baseline is level with a field's centre sits visibly high and
   * reads as belonging to the row above. Centring on cap height fixes that, and cap
   * height has to come from the font because handwriting faces are wildly asymmetric.
   */
  text(value, at, { slot, size, colour, anchor = 'start', weight } = {})
  {
    const font = FONTS[slot];
    const box = textBox(value, slot, size);
    const baseline = at.y + box.baselineOffset;
    this.elements.push(
      `<text x="${attr(at.x)}" y="${attr(baseline)}" font-family="${font.family}" ` +
      `font-size="${attr(size)}" font-weight="${weight ?? font.weight}" fill="${colour}" ` +
      `text-anchor="${anchor}">${escapeText(value)}</text>`);
    return box;
  }

  textBlock(lines, at, { slot, size, colour, anchor = 'start', lineGap = 1.25 } = {})
  {
    const step = size * lineGap;
    const top = at.y - ((lines.length - 1) * step) / 2;
    lines.forEach((line, index) =>
    {
      this.text(line, { x: at.x, y: top + index * step }, { slot, size, colour, anchor });
    });
    return { height: step * lines.length };
  }

  /** A numbered bubble. Numerals always come from Patrick Hand — see fonts.mjs. */
  bubble(number, at, { radius, fill, colour, textColour, width, size } = {})
  {
    const drawable = generator.circle(at.x, at.y, radius * 2, this.options({
      stroke: colour,
      strokeWidth: width,
      fill,
      fillStyle: 'solid',
    }));
    for (const path of generator.toPaths(drawable))
    {
      const isFill = path.fill && path.fill !== 'none';
      this.elements.push(
        `<path d="${path.d}" fill="${isFill ? path.fill : 'none'}" ` +
        `stroke="${isFill ? 'none' : colour}" stroke-width="${attr(width)}" ` +
        'stroke-linecap="round" stroke-linejoin="round"/>');
    }
    this.text(String(number), at, {
      slot: 'hand',
      size: size ?? radius * 1.5,
      colour: textColour,
      anchor: 'middle',
    });
  }

  toSvg()
  {
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" ` +
      `viewBox="0 0 ${this.width} ${this.height}">${defs}${this.elements.join('')}</svg>`;
  }
}
