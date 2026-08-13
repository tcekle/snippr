// Style registry.

import { ENGINES } from './common.mjs';

import plainInk from './plain-ink.mjs';
import markerRings from './marker-rings.mjs';
import highlighter from './highlighter.mjs';
import numberedBubbles from './numbered-bubbles.mjs';
import numberedLegend from './numbered-legend.mjs';
import inlineArrows from './inline-arrows.mjs';
import spotlight from './spotlight.mjs';
import printSafe from './print-safe.mjs';
import shopFloor from './shop-floor.mjs';

const ALL = [
  plainInk, markerRings, highlighter, numberedBubbles,
  numberedLegend, inlineArrows, spotlight, printSafe, shopFloor,
];

export const STYLES = Object.fromEntries(ALL.map((style) => [style.name, style]));

export const SKETCH_STYLES = ALL.filter((style) => style.kind === 'sketch').map((style) => style.name);
export const CLEAN_STYLES = ALL.filter((style) => style.kind === 'clean').map((style) => style.name);

export function getStyle(name)
{
  const style = STYLES[name];
  if (!style)
  {
    throw new Error(
      `Unknown style "${name}". Sketch: ${SKETCH_STYLES.join(', ')}. Clean: ${CLEAN_STYLES.join(', ')}.`);
  }
  return style;
}

export function getEngine(style)
{
  const engine = ENGINES[style.engine];
  if (!engine)
  {
    throw new Error(`Style "${style.name}" names unknown engine "${style.engine}".`);
  }
  return engine;
}
