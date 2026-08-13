// Highlighter. A translucent band behind each control, never over it.
import { INK } from '../palette.mjs';

export default {
  name: 'highlighter',
  kind: 'sketch',
  engine: 'band',
  seed: 4,
  font: 'highlighter',
  roughness: 1.2,
  bowing: 1.1,
  strokeScale: 0.9,
  bandOpacity: 0.75,
  palette: (onDark) => ({
    band: INK.highlighter,
    leader: onDark ? INK.amberLabelOnDark : INK.darkInk,
    label: onDark ? INK.amberLabelOnDark : INK.darkInk,
  }),
};
