// Numbered bubbles. Numerals come from Patrick Hand even though labels are Kalam:
// Kalam's "1" is a bare vertical slash and reads as punctuation at bubble size.
import { INK } from '../palette.mjs';

export default {
  name: 'numbered-bubbles',
  kind: 'sketch',
  engine: 'bubble',
  seed: 33,
  font: 'marker',
  roughness: 1.25,
  bowing: 1.2,
  strokeScale: 1.05,
  bubbleScale: 1,
  palette: (onDark) => ({
    ring: onDark ? INK.amberOnDark : INK.inkBlue,
    leader: onDark ? INK.amberOnDark : INK.inkBlue,
    label: onDark ? INK.amberLabelOnDark : INK.inkBlue,
    bubbleFill: onDark ? INK.darkInk : INK.paper,
    bubbleText: onDark ? INK.amberLabelOnDark : INK.inkBlue,
  }),
};
