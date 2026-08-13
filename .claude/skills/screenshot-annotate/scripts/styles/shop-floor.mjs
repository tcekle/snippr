// Shop floor. Oversized type and heavy strokes, for a figure that will be read at arm's
// length from a machine rather than on a desk.
import { INK } from '../palette.mjs';

export default {
  name: 'shop-floor',
  kind: 'clean',
  engine: 'clean',
  seed: 15,
  font: 'cleanBold',
  roughness: 0,
  bowing: 0,
  strokeScale: 1.8,
  fontScale: 1.35,
  plateOpacity: 1,
  palette: (onDark) => ({
    ring: onDark ? INK.highlighter : INK.brand,
    leader: onDark ? INK.highlighter : INK.brand,
    label: onDark ? INK.darkInk : INK.paper,
    plate: onDark ? INK.highlighter : INK.brand,
    plateBorder: null,
    bubbleFill: onDark ? INK.darkInk : INK.paper,
    bubbleText: onDark ? INK.highlighter : INK.brand,
  }),
};
