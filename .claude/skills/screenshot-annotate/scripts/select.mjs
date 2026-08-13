// Resolve a figure spec's element descriptions to pixel rectangles.
//
// This is the layer that keeps §5.1.2 honest. A spec says "the second #E2E8F0 swatch
// from the top" or "the panel above the first horizontal rule", never "(1102, 1044)".
// Re-capture the screenshot at a different window size and the description still finds
// the right thing, where a coordinate would silently point at empty space.

import { detectInk, findEmptyRegions, parseHex } from './measure.mjs';

function colourDistance(a, b)
{
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function contains(outer, inner, slack = 2)
{
  return inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.width <= outer.x + outer.width + slack &&
    inner.y + inner.height <= outer.y + outer.height + slack;
}

/**
 * "Within the card" means the things *inside* the card, not the card as well.
 *
 * Without this the container matches its own filter and takes index 0, so every index in
 * the spec silently shifts by one — the figure still renders, with every ring around the
 * wrong control. Nothing about the output announces the mistake, which is exactly the
 * failure mode selectors exist to avoid.
 */
function isSameRect(a, b, slack = 3)
{
  return Math.abs(a.x - b.x) <= slack &&
    Math.abs(a.y - b.y) <= slack &&
    Math.abs(a.width - b.width) <= slack &&
    Math.abs(a.height - b.height) <= slack;
}

function orderBy(list, order)
{
  const sorted = [...list];
  switch (order)
  {
    case 'top-to-bottom':
      return sorted.sort((a, b) => a.y - b.y || a.x - b.x);
    case 'left-to-right':
      return sorted.sort((a, b) => a.x - b.x || a.y - b.y);
    case 'area-asc':
      return sorted.sort((a, b) => a.area - b.area);
    case 'area-desc':
    default:
      return sorted.sort((a, b) => b.area - a.area);
  }
}

function selectSwatch(query, report, image)
{
  const {
    fill,
    tolerance = 18,
    // Default away from degenerate strips. A bordered input contributes 1px-tall bands
    // of border colour above and below itself, all of them as wide as the field, so a
    // width-only filter over the My Account form matches 30 regions of which 6 are the
    // actual fields — and `index: 1` silently rings a hairline. Anything genuinely
    // 1px is a rule, and rules are found with the `border` selector.
    minWidth = 4,
    minHeight = 4,
    maxWidth = Infinity,
    maxHeight = Infinity,
    within,
    order = 'area-desc',
    index = 0,
  } = query;

  const bounds = within ? resolveTarget(within, report, image) : null;
  const wanted = fill ? parseHex(fill) : null;

  const matches = report.swatches.filter((swatch) =>
  {
    if (swatch.width < minWidth || swatch.height < minHeight) { return false; }
    if (swatch.width > maxWidth || swatch.height > maxHeight) { return false; }
    if (bounds && (!contains(bounds, swatch) || isSameRect(bounds, swatch))) { return false; }
    if (wanted && colourDistance(parseHex(swatch.fill), wanted) > tolerance) { return false; }
    return true;
  });

  const ordered = orderBy(matches, order);
  const hit = ordered[index];
  if (!hit)
  {
    throw new Error(
      `No swatch matched ${JSON.stringify(query)}. ` +
      `${matches.length} candidate(s) passed the filters, wanted index ${index}. ` +
      'Run `node scripts/measure.mjs <image>` to see what is actually there.');
  }
  return { x: hit.x, y: hit.y, width: hit.width, height: hit.height, source: 'swatch', fill: hit.fill };
}

function selectInk(query, report, image)
{
  const {
    within,
    pick = 'largest',
    index = 0,
    order,
    minWidth = 0,
    minHeight = 0,
    maxWidth = Infinity,
    maxHeight = Infinity,
    ...rest
  } = query;
  const region = within ? resolveTarget(within, report, image) : undefined;

  // Size filters drop the incidental: a menu's 1px divider rule is a perfectly good ink
  // cluster and would otherwise take an index slot between the items either side of it.
  let clusters = detectInk(image, { ...rest, region }).filter((cluster) =>
    cluster.width >= minWidth && cluster.height >= minHeight &&
    cluster.width <= maxWidth && cluster.height <= maxHeight);

  if (order)
  {
    clusters = orderBy(clusters, order);
  }

  if (clusters.length === 0)
  {
    throw new Error(
      `No ink clusters matched ${JSON.stringify(query)}. ` +
      'Run `node scripts/measure.mjs <image>` and check the region actually contains ink.');
  }

  let hit;
  switch (pick)
  {
    case 'leftmost': hit = clusters[0]; break;
    case 'rightmost': hit = clusters[clusters.length - 1]; break;
    case 'largest': hit = [...clusters].sort((a, b) => b.area - a.area)[0]; break;
    case 'index': hit = clusters[index]; break;
    default: throw new Error(`Unknown ink pick "${pick}".`);
  }

  if (!hit)
  {
    throw new Error(`Ink pick "${pick}" found nothing among ${clusters.length} cluster(s).`);
  }
  return { x: hit.x, y: hit.y, width: hit.width, height: hit.height, source: 'ink' };
}

function resolveEdge(value, report, axis, side)
{
  if (value === 'edge' || value === undefined)
  {
    if (side === 'start') { return 0; }
    return axis === 'horizontal' ? report.height : report.width;
  }
  if (typeof value === 'number')
  {
    return value;
  }
  if (value.border)
  {
    const { axis: borderAxis = axis, index = 0, from = 'start' } = value.border;
    const list = report.borders[borderAxis];
    if (!list || list.length === 0)
    {
      throw new Error(`No ${borderAxis} borders detected, cannot resolve ${JSON.stringify(value)}.`);
    }
    const ordered = from === 'end' ? [...list].reverse() : list;
    const hit = ordered[index];
    if (!hit)
    {
      throw new Error(
        `Only ${list.length} ${borderAxis} border(s) detected, wanted index ${index} from the ${from}.`);
    }
    // A rule has thickness; a panel abutting it should stop at the rule, not overlap it.
    return side === 'start' ? hit.end + 1 : hit.start;
  }
  throw new Error(`Cannot resolve panel edge ${JSON.stringify(value)}.`);
}

/**
 * A region bounded by detected rules and/or the frame — the title bar, the left nav, the
 * activity rail, the status bar. These have no fill of their own to match on, so they
 * are described by what encloses them.
 */
function selectPanel(query, report)
{
  const left = resolveEdge(query.left, report, 'vertical', 'start');
  const right = resolveEdge(query.right, report, 'vertical', 'end');
  const top = resolveEdge(query.top, report, 'horizontal', 'start');
  const bottom = resolveEdge(query.bottom, report, 'horizontal', 'end');

  if (right <= left || bottom <= top)
  {
    throw new Error(
      `Panel ${JSON.stringify(query)} resolved to an empty box ` +
      `(${left},${top})-(${right},${bottom}).`);
  }
  return { x: left, y: top, width: right - left, height: bottom - top, source: 'panel' };
}

/**
 * Open space to put a label in. `index` walks the regions largest-first; `nearest`
 * instead picks whichever one is closest to another resolved element.
 */
function selectEmpty(query, report, image)
{
  const { within, index = 0, nearest, ...rest } = query;
  const bounds = within ? resolveTarget(within, report, image) : undefined;
  const regions = findEmptyRegions(image, { ...rest, within: bounds });

  if (regions.length === 0)
  {
    throw new Error(`No empty region matched ${JSON.stringify(query)}.`);
  }

  if (nearest)
  {
    const anchor = resolveTarget(nearest, report, image);
    const anchorCentre = { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 };
    const byDistance = [...regions].sort((a, b) =>
      Math.hypot(a.x + a.width / 2 - anchorCentre.x, a.y + a.height / 2 - anchorCentre.y) -
      Math.hypot(b.x + b.width / 2 - anchorCentre.x, b.y + b.height / 2 - anchorCentre.y));
    const hit = byDistance[0];
    return { x: hit.x, y: hit.y, width: hit.width, height: hit.height, source: 'empty' };
  }

  const hit = regions[index];
  if (!hit)
  {
    throw new Error(`Only ${regions.length} empty region(s) found, wanted index ${index}.`);
  }
  return { x: hit.x, y: hit.y, width: hit.width, height: hit.height, source: 'empty' };
}

/**
 * One target spanning several — "Manage Users and Manage Roles", "both password fields".
 *
 * A label like "administrators only" belongs to a pair of adjacent rows, and ringing only
 * one of them says something the prose does not.
 */
function selectUnion(queries, report, image)
{
  const rects = queries.map((query) => resolveTarget(query, report, image));
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x, y, width: right - x, height: bottom - y, source: 'union' };
}

export function resolveTarget(query, report, image)
{
  if (Array.isArray(query))
  {
    const [x, y, width, height] = query;
    return { x, y, width, height, source: 'literal' };
  }
  if (query.union) { return selectUnion(query.union, report, image); }
  if (query.swatch) { return selectSwatch(query.swatch, report, image); }
  if (query.ink) { return selectInk(query.ink, report, image); }
  if (query.panel) { return selectPanel(query.panel, report); }
  if (query.empty) { return selectEmpty(query.empty, report, image); }
  if (query.rect)
  {
    const [x, y, width, height] = query.rect;
    return { x, y, width, height, source: 'literal' };
  }
  throw new Error(
    `Unrecognised target ${JSON.stringify(query)}. ` +
    'Expected one of: swatch, ink, panel, rect.');
}

/** True when a target sits against the frame, which is what forces margin over crop. */
export function touchesFrame(rect, report, slack = 4)
{
  return rect.x <= slack ||
    rect.y <= slack ||
    rect.x + rect.width >= report.width - slack ||
    rect.y + rect.height >= report.height - slack;
}
