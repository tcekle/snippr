// Inline arrows. No rings, no plates — just an arrow and a word. Least intrusive of the
// clean presets, for figures where the UI itself must stay fully legible.
import { INK } from '../palette.mjs';

export default {
  name: 'inline-arrows',
  kind: 'clean',
  engine: 'clean',
  seed: 12,
  font: 'cleanBold',
  roughness: 0,
  bowing: 0,
  strokeScale: 0.9,
  outline: false,
  labelPlate: false,
  numberInline: false,
  palette: (onDark) => ({
    ring: onDark ? INK.amberOnDark : INK.brand,
    leader: onDark ? INK.amberOnDark : INK.brand,
    label: onDark ? INK.amberLabelOnDark : INK.brand,
  }),
};
