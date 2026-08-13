// Real text metrics, read from the vendored TTFs.
//
// Label boxes have to be measured rather than guessed: §5.1.4 forbids leaders crossing
// controls or each other, and §5.1.6 requires labels to be vertically centred on the row
// they describe. Both need to know how wide a label actually is. A per-character
// estimate is wrong by enough on handwriting faces — where advance widths vary far more
// than in a grotesque — to put a leader through a button.
//
// opentype.js is the one dependency here beyond the handoff's list. It is pure JS, reads
// the same TTFs resvg is given, and replaces a guess with a measurement.

import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { FONTS, FONT_DIR, FONT_SIZE_SCALE } from './fonts.mjs';

const cache = new Map();

function load(slot)
{
  if (cache.has(slot))
  {
    return cache.get(slot);
  }

  const font = FONTS[slot];
  if (!font)
  {
    throw new Error(`Unknown font slot "${slot}". Known: ${Object.keys(FONTS).join(', ')}`);
  }

  const buffer = readFileSync(path.join(FONT_DIR, font.file));
  // Copy into a standalone ArrayBuffer: Node may hand back a Buffer that is a view into
  // a larger pooled allocation, and opentype would then parse whatever follows it.
  const parsed = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  cache.set(slot, parsed);
  return parsed;
}

/** Point size for a slot, after the handwriting uplift from §5.4. */
export function scaledSize(slot, nominal)
{
  return nominal * (FONT_SIZE_SCALE[slot] ?? 1);
}

export function measureText(text, slot, size)
{
  return load(slot).getAdvanceWidth(text, size);
}

/**
 * Cap height and the vertical offset needed to centre a line of text on a y coordinate.
 *
 * Handwriting faces have wildly asymmetric ascenders and descenders, so centring on
 * (ascender + descender) / 2 leaves the text visibly high. Centring on the cap height
 * of the actual string is what makes a label look level with the row it labels.
 */
export function textBox(text, slot, size)
{
  const font = load(slot);
  const scale = size / font.unitsPerEm;
  const capHeight = (font.tables.os2?.sCapHeight ?? font.ascender * 0.7) * scale;
  return {
    width: font.getAdvanceWidth(text, size),
    capHeight,
    ascender: font.ascender * scale,
    descender: font.descender * scale,
    // Add to a centre-line y to get the SVG text baseline.
    baselineOffset: capHeight / 2,
  };
}

/**
 * Where a laid-out label's ink actually starts and stops, vertically, relative to the
 * anchor `textBlock` centres it on.
 *
 * A label's box is `lines x size x 1.25`, which is line spacing rather than ink: the box
 * clears the top of the tallest glyph by a third of an em and the bottom of the deepest
 * descender by almost nothing. Padding that box gives a plate that looks top-heavy and
 * sits on its own descenders, and on a figure with only ~50px of clear band to put it in,
 * the wasted space at the top is the difference between fitting and not. So the plate
 * hugs the ink, measured off the outline of the actual string in the actual face.
 *
 * Mirrors `Sketch.textBlock` and `Sketch.text`: line n sits `size * lineGap` below its
 * predecessor, and each line's baseline is its centre plus half a cap height.
 */
export function inkExtent(lines, slot, size, lineGap = 1.25)
{
  const font = load(slot);
  const step = size * lineGap;
  const first = -((lines.length - 1) * step) / 2;
  let top = Infinity;
  let bottom = -Infinity;

  lines.forEach((line, index) =>
  {
    if (!line)
    {
      return;
    }
    const baseline = first + index * step + textBox(line, slot, size).baselineOffset;
    const bounds = font.getPath(line, 0, 0, size).getBoundingBox();
    top = Math.min(top, baseline + bounds.y1);
    bottom = Math.max(bottom, baseline + bounds.y2);
  });

  if (!Number.isFinite(top))
  {
    return { top: -size / 2, bottom: size / 2 };
  }
  return { top, bottom };
}

/** Split a label onto at most `maxLines` lines, each no wider than `maxWidth`. */
export function wrapText(text, slot, size, maxWidth, maxLines = 2)
{
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words)
  {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureText(candidate, slot, size) > maxWidth && lines.length < maxLines - 1)
    {
      lines.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }
  if (current)
  {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

/** XML-escape a label before it goes into an SVG <text> element. */
export function escapeText(value)
{
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
