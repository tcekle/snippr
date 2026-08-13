// Print safe. Near-black, thin rules, no dependency on hue.
//
// Kept deliberately: greyscale printing and photocopying are real on a shop floor, and
// every other preset degrades to mush there. Do not let every figure depend on colour.
import { INK } from '../palette.mjs';

export default {
  name: 'print-safe',
  kind: 'clean',
  engine: 'clean',
  seed: 14,
  font: 'clean',
  roughness: 0,
  bowing: 0,
  strokeScale: 0.75,
  palette: () => ({
    ring: INK.darkInk,
    leader: INK.darkInk,
    label: INK.darkInk,
    plate: 'rgba(255,255,255,0.95)',
    plateBorder: INK.darkInk,
    bubbleFill: INK.paper,
    bubbleText: INK.darkInk,
  }),
};
