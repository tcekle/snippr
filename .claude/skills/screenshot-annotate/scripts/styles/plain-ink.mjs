// Plain ink sketch. The quietest of the sketch presets: one colour, thin line, no fills.
import { INK } from '../palette.mjs';

export default {
  name: 'plain-ink',
  kind: 'sketch',
  engine: 'ring',
  // Fixed so every figure in the manual is drawn by the same "hand" and rebuilds are
  // byte-identical. Never reseed a global RNG; this is passed through to Rough.js.
  seed: 7,
  font: 'hand',
  roughness: 1.1,
  bowing: 1,
  strokeScale: 1,
  ringStart: 0.1,
  ringTravel: 1.06,
  palette: (onDark) => ({
    ring: onDark ? INK.amberOnDark : INK.inkBlue,
    leader: onDark ? INK.amberOnDark : INK.inkBlue,
    label: onDark ? INK.amberLabelOnDark : INK.inkBlue,
  }),
};
