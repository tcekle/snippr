// Detect UI element bounds from pixels.
//
// Hardcoded coordinates are the failure mode this exists to prevent: screenshots get
// re-taken at a different window size or device scale and every callout silently drifts
// off its target while the figure still renders "successfully". Everything downstream
// selects elements by description (fill colour, ordering, containment) and resolves the
// pixels here.
//
//   node scripts/measure.mjs <image.png> [--json out.json] [--verify app-shell]
//
// Also imported directly by annotate.mjs — the CLI is for inspecting a new screenshot
// before writing its spec.

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { Command } from 'commander';

/** Perceptual-ish luma, good enough for ranking light/dark. */
function luma(r, g, b)
{
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function parseHex(hex)
{
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b })
{
  // Clamped because callers pass both channel averages and de-quantised bucket centres,
  // and the latter can land just past 255.
  return '#' + [r, g, b]
    .map((value) => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

/** Load to a flat RGB buffer. Alpha is dropped — screenshots are opaque. */
export async function loadImage(file)
{
  const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function medianOf(values)
{
  const sorted = Float64Array.from(values).sort();
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Per-line median colour and the fraction of pixels agreeing with it.
 * `axis` is 'horizontal' for rows (scanning y) or 'vertical' for columns.
 */
function lineProfile(image, axis, tolerance)
{
  const { data, width, height, channels } = image;
  const count = axis === 'horizontal' ? height : width;
  const span = axis === 'horizontal' ? width : height;

  const medians = new Float64Array(count);
  const coverage = new Float64Array(count);
  const sample = new Float64Array(span);

  for (let line = 0; line < count; line++)
  {
    for (let step = 0; step < span; step++)
    {
      const x = axis === 'horizontal' ? step : line;
      const y = axis === 'horizontal' ? line : step;
      const offset = (y * width + x) * channels;
      sample[step] = luma(data[offset], data[offset + 1], data[offset + 2]);
    }

    const median = medianOf(sample);
    let agreeing = 0;
    for (let step = 0; step < span; step++)
    {
      if (Math.abs(sample[step] - median) <= tolerance)
      {
        agreeing++;
      }
    }

    medians[line] = median;
    coverage[line] = agreeing / span;
  }

  return { medians, coverage };
}

/**
 * Find divider lines: a run of lines that is uniform along its length AND measurably
 * darker than what sits a few pixels either side of it.
 *
 * The second half of that test is what stops a large flat panel from being reported as
 * a border — a panel interior is just as uniform as a rule, so uniformity alone finds
 * hundreds of false positives. A divider is specifically a *thin dark band*.
 */
export function detectBorders(image, options = {})
{
  const {
    axis = 'horizontal',
    coverageThreshold = 0.9,
    tolerance = 10,
    prominence = 6,
    gap = 3,
  } = options;

  const { medians, coverage } = lineProfile(image, axis, tolerance);
  const count = medians.length;
  const hits = [];

  for (let line = gap; line < count - gap; line++)
  {
    if (coverage[line] < coverageThreshold)
    {
      continue;
    }

    // Compare against the lightest neighbour on each side, so a 1px rule sitting
    // between two different backgrounds still registers on both sides.
    let lighterBefore = -Infinity;
    let lighterAfter = -Infinity;
    for (let step = 1; step <= gap; step++)
    {
      lighterBefore = Math.max(lighterBefore, medians[line - step]);
      lighterAfter = Math.max(lighterAfter, medians[line + step]);
    }

    const rise = Math.min(lighterBefore, lighterAfter) - medians[line];
    if (rise >= prominence)
    {
      hits.push({ position: line, luma: medians[line], coverage: coverage[line], prominence: rise });
    }
  }

  // Non-maximum suppression: a 2px rule at device scale 2 reports twice. Keep the
  // darkest line of each contiguous run and record how thick the run was.
  const merged = [];
  for (const hit of hits)
  {
    const previous = merged[merged.length - 1];
    if (previous && hit.position - previous.end <= 1)
    {
      previous.end = hit.position;
      previous.thickness = previous.end - previous.start + 1;
      if (hit.luma < previous.luma)
      {
        previous.position = hit.position;
        previous.luma = hit.luma;
        previous.prominence = hit.prominence;
      }
      continue;
    }
    merged.push({ ...hit, start: hit.position, end: hit.position, thickness: 1 });
  }

  return merged.map(({ position, start, end, thickness, luma: value, coverage: cover, prominence: rise }) => ({
    axis,
    position,
    start,
    end,
    thickness,
    luma: Math.round(value * 10) / 10,
    coverage: Math.round(cover * 1000) / 1000,
    prominence: Math.round(rise * 10) / 10,
  }));
}

/**
 * Connected regions of near-uniform colour — input fields, buttons, cards, panels.
 *
 * Colours are bucketed before labelling so antialiasing and subpixel shading don't
 * shatter one control into a hundred fragments.
 */
export function detectSwatches(image, options = {})
{
  const { data, width, height, channels } = image;
  const {
    quantize = 8,
    minArea = Math.max(400, Math.round(width * height * 0.0004)),
    minEdgeRatio = 0.75,
  } = options;

  const pixelCount = width * height;
  const bucket = new Int32Array(pixelCount);
  for (let index = 0; index < pixelCount; index++)
  {
    const offset = index * channels;
    const r = Math.round(data[offset] / quantize);
    const g = Math.round(data[offset + 1] / quantize);
    const b = Math.round(data[offset + 2] / quantize);
    bucket[index] = (r << 16) | (g << 8) | b;
  }

  const labels = new Int32Array(pixelCount).fill(-1);
  const stack = new Int32Array(pixelCount);
  const regions = [];

  for (let seed = 0; seed < pixelCount; seed++)
  {
    if (labels[seed] !== -1)
    {
      continue;
    }

    const target = bucket[seed];
    const label = regions.length;
    let stackSize = 0;
    stack[stackSize++] = seed;
    labels[seed] = label;

    let area = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    while (stackSize > 0)
    {
      const index = stack[--stackSize];
      const x = index % width;
      const y = (index - x) / width;

      area++;
      if (x < minX) { minX = x; }
      if (x > maxX) { maxX = x; }
      if (y < minY) { minY = y; }
      if (y > maxY) { maxY = y; }

      const offset = index * channels;
      sumR += data[offset];
      sumG += data[offset + 1];
      sumB += data[offset + 2];

      if (x > 0 && labels[index - 1] === -1 && bucket[index - 1] === target)
      {
        labels[index - 1] = label;
        stack[stackSize++] = index - 1;
      }
      if (x < width - 1 && labels[index + 1] === -1 && bucket[index + 1] === target)
      {
        labels[index + 1] = label;
        stack[stackSize++] = index + 1;
      }
      if (y > 0 && labels[index - width] === -1 && bucket[index - width] === target)
      {
        labels[index - width] = label;
        stack[stackSize++] = index - width;
      }
      if (y < height - 1 && labels[index + width] === -1 && bucket[index + width] === target)
      {
        labels[index + width] = label;
        stack[stackSize++] = index + width;
      }
    }

    if (area < minArea)
    {
      regions.push(null);
      continue;
    }

    regions.push({
      label,
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area,
      fill: toHex({ r: sumR / area, g: sumG / area, b: sumB / area }),
    });
  }

  const found = [];
  for (const region of regions)
  {
    if (!region)
    {
      continue;
    }

    const boxArea = region.width * region.height;

    // A card is a rectangle with its own controls punched out of it, so its filled
    // fraction can be well under half. Testing the *perimeter* instead identifies a
    // rectangle regardless of what sits inside it.
    let edgeHits = 0;
    let edgeTotal = 0;
    const right = region.x + region.width - 1;
    const bottom = region.y + region.height - 1;
    for (let x = region.x; x <= right; x++)
    {
      edgeTotal += 2;
      if (labels[region.y * width + x] === region.label) { edgeHits++; }
      if (labels[bottom * width + x] === region.label) { edgeHits++; }
    }
    for (let y = region.y; y <= bottom; y++)
    {
      edgeTotal += 2;
      if (labels[y * width + region.x] === region.label) { edgeHits++; }
      if (labels[y * width + right] === region.label) { edgeHits++; }
    }

    const edgeRatio = edgeHits / edgeTotal;
    if (edgeRatio < minEdgeRatio)
    {
      continue;
    }

    found.push({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      right: right + 1,
      bottom: bottom + 1,
      area: region.area,
      fill: region.fill,
      fillRatio: Math.round((region.area / boxArea) * 1000) / 1000,
      edgeRatio: Math.round(edgeRatio * 1000) / 1000,
    });
  }

  return found.sort((a, b) => b.area - a.area);
}

/**
 * Find icons and glyph clusters — anything drawn *on* a control rather than being one.
 *
 * `detectSwatches` cannot see these: an eye toggle is a few dark strokes, not a filled
 * rectangle, so it has almost no uniform area and gets filtered as noise. This masks
 * every pixel far enough from the local background, dilates so the separate strokes of
 * one icon merge into a single blob, then reports the bounding box of the real ink
 * inside each blob.
 *
 * Pass `region` to search inside a control (the reveal toggle lives in the password
 * field); omit it to sweep the whole image.
 */
export function detectInk(image, options = {})
{
  const { data, width, height, channels } = image;
  const {
    region = { x: 0, y: 0, width, height },
    background,
    threshold = 40,
    dilate = 4,
    minArea = 24,
    // Select ink by what colour it IS rather than by differing from the background.
    // The password-rejection message is the only red thing on the My Account form, so
    // "the red ink" identifies it without depending on where it happens to sit — which
    // matters because the message only exists in the error state and shifts the whole
    // form down when it appears.
    matchColour,
    // A control's own rounded corners expose the surface behind it, which reads as ink
    // and lands four blobs in the corners of the search box — the bottom-right one then
    // beats the real icon for "rightmost". Anything touching the boundary of the search
    // region is the region's own edge, not content drawn on it. Turn this off when the
    // region is cropped tight to the thing being measured.
    dropEdgeTouching = true,
  } = options;

  const x0 = Math.max(0, Math.round(region.x));
  const y0 = Math.max(0, Math.round(region.y));
  const x1 = Math.min(width, Math.round(region.x + region.width));
  const y1 = Math.min(height, Math.round(region.y + region.height));
  const boxWidth = x1 - x0;
  const boxHeight = y1 - y0;

  if (boxWidth <= 0 || boxHeight <= 0)
  {
    return [];
  }

  // Default to the most common colour *within the region*, so a control's own fill is
  // treated as background rather than as ink.
  let base = background ? parseHex(background) : null;
  if (!base)
  {
    const counts = new Map();
    for (let y = y0; y < y1; y++)
    {
      for (let x = x0; x < x1; x++)
      {
        const offset = (y * width + x) * channels;
        const key = (data[offset] >> 3 << 10) | (data[offset + 1] >> 3 << 5) | (data[offset + 2] >> 3);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    let bestKey = 0;
    let bestCount = -1;
    for (const [key, count] of counts)
    {
      if (count > bestCount) { bestCount = count; bestKey = key; }
    }
    base = { r: ((bestKey >> 10) & 31) << 3, g: ((bestKey >> 5) & 31) << 3, b: (bestKey & 31) << 3 };
  }

  const wanted = matchColour ? parseHex(matchColour) : null;
  const ink = new Uint8Array(boxWidth * boxHeight);
  for (let y = y0; y < y1; y++)
  {
    for (let x = x0; x < x1; x++)
    {
      const offset = (y * width + x) * channels;
      const reference = wanted ?? base;
      const dr = data[offset] - reference.r;
      const dg = data[offset + 1] - reference.g;
      const db = data[offset + 2] - reference.b;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      // Near the wanted colour when matching one; far from the background otherwise.
      if (wanted ? distance <= threshold : distance > threshold)
      {
        ink[(y - y0) * boxWidth + (x - x0)] = 1;
      }
    }
  }

  // Box dilation, so the outline, pupil and slash of one eye icon become one blob.
  const grown = new Uint8Array(boxWidth * boxHeight);
  for (let y = 0; y < boxHeight; y++)
  {
    for (let x = 0; x < boxWidth; x++)
    {
      if (!ink[y * boxWidth + x])
      {
        continue;
      }
      const top = Math.max(0, y - dilate);
      const bottom = Math.min(boxHeight - 1, y + dilate);
      const left = Math.max(0, x - dilate);
      const right = Math.min(boxWidth - 1, x + dilate);
      for (let ny = top; ny <= bottom; ny++)
      {
        grown.fill(1, ny * boxWidth + left, ny * boxWidth + right + 1);
      }
    }
  }

  const labels = new Int32Array(boxWidth * boxHeight).fill(-1);
  const stack = new Int32Array(boxWidth * boxHeight);
  const clusters = [];

  for (let seed = 0; seed < grown.length; seed++)
  {
    if (!grown[seed] || labels[seed] !== -1)
    {
      continue;
    }

    const label = clusters.length;
    let stackSize = 0;
    stack[stackSize++] = seed;
    labels[seed] = label;

    let inkArea = 0;
    let minX = boxWidth;
    let maxX = -1;
    let minY = boxHeight;
    let maxY = -1;

    while (stackSize > 0)
    {
      const index = stack[--stackSize];
      const x = index % boxWidth;
      const y = (index - x) / boxWidth;

      // Bounds come from the true ink, not the dilated halo, so the reported box is the
      // icon's real extent rather than the icon plus the dilation radius.
      if (ink[index])
      {
        inkArea++;
        if (x < minX) { minX = x; }
        if (x > maxX) { maxX = x; }
        if (y < minY) { minY = y; }
        if (y > maxY) { maxY = y; }
      }

      if (x > 0 && grown[index - 1] && labels[index - 1] === -1) { labels[index - 1] = label; stack[stackSize++] = index - 1; }
      if (x < boxWidth - 1 && grown[index + 1] && labels[index + 1] === -1) { labels[index + 1] = label; stack[stackSize++] = index + 1; }
      if (y > 0 && grown[index - boxWidth] && labels[index - boxWidth] === -1) { labels[index - boxWidth] = label; stack[stackSize++] = index - boxWidth; }
      if (y < boxHeight - 1 && grown[index + boxWidth] && labels[index + boxWidth] === -1) { labels[index + boxWidth] = label; stack[stackSize++] = index + boxWidth; }
    }

    if (inkArea < minArea || maxX < 0)
    {
      clusters.push(null);
      continue;
    }

    if (dropEdgeTouching &&
      (minX === 0 || minY === 0 || maxX === boxWidth - 1 || maxY === boxHeight - 1))
    {
      clusters.push(null);
      continue;
    }

    clusters.push({
      x: x0 + minX,
      y: y0 + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      right: x0 + maxX + 1,
      bottom: y0 + maxY + 1,
      area: inkArea,
    });
  }

  return clusters.filter(Boolean).sort((a, b) => a.x - b.x);
}

/**
 * Largest empty rectangles — regions with nothing drawn in them.
 *
 * This is what lets a label sit in the open space *inside* the frame instead of being
 * pushed out into a margin gutter. A label placed in the empty content area, with a long
 * leader sweeping to its target, reads far better than one pinned beside the target, and
 * it keeps the figure compact.
 *
 * Uses the classic largest-rectangle-in-a-histogram sweep over a binary "is background"
 * grid, then masks each winner out and repeats to get several disjoint regions. The grid
 * is downsampled first: at full resolution this is 5.2M cells for no extra precision,
 * since a label only needs to know roughly where the whitespace is.
 */
export function findEmptyRegions(image, options = {})
{
  const { data, width, height, channels } = image;
  const {
    within,
    background,
    tolerance = 14,
    step = 4,
    count = 4,
    minWidth = 0,
    minHeight = 0,
  } = options;

  const region = within ?? { x: 0, y: 0, width, height };
  const x0 = Math.max(0, Math.round(region.x));
  const y0 = Math.max(0, Math.round(region.y));
  const x1 = Math.min(width, Math.round(region.x + region.width));
  const y1 = Math.min(height, Math.round(region.y + region.height));

  const cols = Math.floor((x1 - x0) / step);
  const rows = Math.floor((y1 - y0) / step);
  if (cols <= 0 || rows <= 0)
  {
    return [];
  }

  const base = background ? parseHex(background) : parseHex(dominantColour(image).hex);
  const empty = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row++)
  {
    for (let col = 0; col < cols; col++)
    {
      const x = x0 + col * step;
      const y = y0 + row * step;
      const offset = (y * width + x) * channels;
      const distance = Math.sqrt(
        (data[offset] - base.r) ** 2 +
        (data[offset + 1] - base.g) ** 2 +
        (data[offset + 2] - base.b) ** 2);
      empty[row * cols + col] = distance <= tolerance ? 1 : 0;
    }
  }

  const found = [];
  const heights = new Int32Array(cols);

  for (let iteration = 0; iteration < count; iteration++)
  {
    heights.fill(0);
    let best = null;

    for (let row = 0; row < rows; row++)
    {
      for (let col = 0; col < cols; col++)
      {
        heights[col] = empty[row * cols + col] ? heights[col] + 1 : 0;
      }

      // Largest rectangle in this row's histogram.
      const stack = [];
      for (let col = 0; col <= cols; col++)
      {
        const currentHeight = col === cols ? 0 : heights[col];
        while (stack.length && heights[stack[stack.length - 1]] >= currentHeight)
        {
          const top = stack.pop();
          const barHeight = heights[top];
          const left = stack.length ? stack[stack.length - 1] + 1 : 0;
          const area = barHeight * (col - left);
          if (barHeight > 0 && (!best || area > best.area))
          {
            best = { area, left, right: col, top: row - barHeight + 1, bottom: row };
          }
        }
        stack.push(col);
      }
    }

    if (!best || best.area === 0)
    {
      break;
    }

    // Blank the winner so the next pass finds a different region.
    for (let row = best.top; row <= best.bottom; row++)
    {
      empty.fill(0, row * cols + best.left, row * cols + best.right);
    }

    const rect = {
      x: x0 + best.left * step,
      y: y0 + best.top * step,
      width: (best.right - best.left) * step,
      height: (best.bottom - best.top + 1) * step,
    };
    if (rect.width >= minWidth && rect.height >= minHeight)
    {
      found.push({ ...rect, area: rect.width * rect.height });
    }
  }

  return found.sort((a, b) => b.area - a.area);
}

/** The most common colour in the image — the page background, in practice. */
export function dominantColour(image, quantize = 8)
{
  const { data, width, height, channels } = image;
  const counts = new Map();
  for (let index = 0; index < width * height; index++)
  {
    const offset = index * channels;
    const key =
      (Math.round(data[offset] / quantize) << 16) |
      (Math.round(data[offset + 1] / quantize) << 8) |
      Math.round(data[offset + 2] / quantize);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts)
  {
    if (count > bestCount)
    {
      bestCount = count;
      bestKey = key;
    }
  }

  // Average the real pixels in the winning bucket rather than reporting the bucket's
  // centre. De-quantising by multiplying the rounded bucket back up is wrong by up to
  // half a step per channel, and it is visible: #F0F4F8 — the PSV app background —
  // comes back as #F0F8F8, which is enough of a green cast to show as a seam when the
  // value is used to fill a figure's label gutter.
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let matched = 0;
  for (let index = 0; index < width * height; index++)
  {
    const offset = index * channels;
    const key =
      (Math.round(data[offset] / quantize) << 16) |
      (Math.round(data[offset + 1] / quantize) << 8) |
      Math.round(data[offset + 2] / quantize);
    if (key === bestKey)
    {
      sumR += data[offset];
      sumG += data[offset + 1];
      sumB += data[offset + 2];
      matched++;
    }
  }

  return {
    hex: toHex({ r: sumR / matched, g: sumG / matched, b: sumB / matched }),
    share: bestCount / (width * height),
  };
}

export async function measure(file, options = {})
{
  const image = await loadImage(file);
  return {
    file,
    width: image.width,
    height: image.height,
    background: dominantColour(image),
    borders: {
      horizontal: detectBorders(image, { ...options, axis: 'horizontal' }),
      vertical: detectBorders(image, { ...options, axis: 'vertical' }),
    },
    swatches: detectSwatches(image, options),
  };
}

// ── Verification fixtures ────────────────────────────────────────────────────
// Measured by hand from the two 2880x1800 reference captures and carried over from the
// handoff. These exist to prove the detector, and are never used as annotation input.

export const FIXTURES = {
  'app-shell': {
    borders: [
      { axis: 'horizontal', position: 79, what: 'title bar bottom' },
      { axis: 'vertical', position: 399, what: 'left nav right' },
      { axis: 'vertical', position: 2794, what: 'activity rail left' },
      { axis: 'horizontal', position: 1754, what: 'status bar top' },
    ],
  },
  'sign-in': {
    swatches: [
      { x: 1022, y: 524, right: 1857, bottom: 1355, what: 'card' },
      { x: 1102, y: 918, right: 1777, bottom: 1011, what: 'username field' },
      { x: 1102, y: 1044, right: 1777, bottom: 1137, what: 'password field' },
      { x: 1102, y: 1186, right: 1777, bottom: 1275, what: 'sign in button' },
    ],
    // Not a swatch — an icon drawn on the password field. Found as the rightmost ink
    // cluster inside that field, which survives the field being resized or moved.
    ink: [
      {
        x: 1720, y: 1079, right: 1751, bottom: 1106,
        what: 'reveal toggle',
        within: { x: 1102, y: 1044, right: 1777, bottom: 1137 },
        pick: 'rightmost',
      },
    ],
  },
};

function verify(report, fixtureName, slack, image)
{
  const fixture = FIXTURES[fixtureName];
  if (!fixture)
  {
    throw new Error(`No fixture "${fixtureName}". Known: ${Object.keys(FIXTURES).join(', ')}`);
  }

  let failures = 0;

  for (const expected of fixture.borders ?? [])
  {
    const candidates = report.borders[expected.axis];
    const hit = candidates.find((border) => Math.abs(border.position - expected.position) <= slack);
    const ok = Boolean(hit);
    if (!ok) { failures++; }
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${expected.axis.padEnd(10)} ${String(expected.position).padStart(5)}  ` +
      `${expected.what.padEnd(20)} ${hit ? `found ${hit.position} (thickness ${hit.thickness})` : 'not found'}`);
  }

  for (const expected of fixture.swatches ?? [])
  {
    const hit = report.swatches.find((swatch) =>
      Math.abs(swatch.x - expected.x) <= slack &&
      Math.abs(swatch.y - expected.y) <= slack &&
      Math.abs(swatch.right - expected.right) <= slack &&
      Math.abs(swatch.bottom - expected.bottom) <= slack);
    const ok = Boolean(hit);
    if (!ok) { failures++; }
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  swatch ${expected.what.padEnd(18)} ` +
      `(${expected.x},${expected.y})-(${expected.right},${expected.bottom})  ` +
      `${hit ? `found ${hit.fill} area ${hit.area}` : 'not found'}`);
  }

  for (const expected of fixture.ink ?? [])
  {
    const within = {
      x: expected.within.x,
      y: expected.within.y,
      width: expected.within.right - expected.within.x,
      height: expected.within.bottom - expected.within.y,
    };
    const clusters = detectInk(image, { region: within });
    const hit = expected.pick === 'rightmost' ? clusters[clusters.length - 1] : clusters[0];
    const ok = Boolean(hit) &&
      Math.abs(hit.x - expected.x) <= slack &&
      Math.abs(hit.y - expected.y) <= slack &&
      Math.abs(hit.right - expected.right) <= slack &&
      Math.abs(hit.bottom - expected.bottom) <= slack;
    if (!ok) { failures++; }
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ink    ${expected.what.padEnd(18)} ` +
      `(${expected.x},${expected.y})-(${expected.right},${expected.bottom})  ` +
      `${hit ? `found (${hit.x},${hit.y})-(${hit.right},${hit.bottom}) of ${clusters.length} cluster(s)` : 'no clusters'}`);
  }

  return failures;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isMain)
{
  const program = new Command();
  program
    .argument('<image>', 'screenshot to measure')
    .option('--json <file>', 'write the full report as JSON')
    .option('--verify <fixture>', 'check against a known fixture (app-shell, sign-in)')
    .option('--slack <px>', 'tolerance for --verify', (value) => Number(value), 2)
    .option('--min-area <px>', 'ignore swatches smaller than this', (value) => Number(value))
    .option('--top <n>', 'how many swatches to print', (value) => Number(value), 12)
    .parse();

  const options = program.opts();
  const [file] = program.args;

  const image = await loadImage(file);
  const report = await measure(file, options.minArea ? { minArea: options.minArea } : {});

  console.log(`${report.file}  ${report.width}x${report.height}  background ${report.background.hex} ` +
    `(${Math.round(report.background.share * 100)}%)`);
  console.log(`borders: ${report.borders.horizontal.length} horizontal, ${report.borders.vertical.length} vertical`);
  console.log(`swatches: ${report.swatches.length}\n`);

  if (options.verify)
  {
    const failures = verify(report, options.verify, options.slack, image);
    if (options.json)
    {
      writeFileSync(options.json, JSON.stringify(report, null, 2));
      console.log(`\nwrote ${options.json}`);
    }
    if (failures > 0)
    {
      console.error(`\n${failures} expectation(s) not met`);
      process.exit(1);
    }
    console.log('\nDetector reproduces the reference bounds.');
  }
  else
  {
    console.log('largest swatches:');
    for (const swatch of report.swatches.slice(0, options.top))
    {
      console.log(
        `  (${swatch.x},${swatch.y})-(${swatch.right},${swatch.bottom})  ` +
        `${swatch.width}x${swatch.height}  ${swatch.fill}  ` +
        `fill ${swatch.fillRatio}  edge ${swatch.edgeRatio}`);
    }
    console.log('\nhorizontal borders:', report.borders.horizontal.map((b) => b.position).join(', '));
    console.log('vertical borders:  ', report.borders.vertical.map((b) => b.position).join(', '));

    if (options.json)
    {
      writeFileSync(options.json, JSON.stringify(report, null, 2));
      console.log(`\nwrote ${options.json}`);
    }
  }
}
