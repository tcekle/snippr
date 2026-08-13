// Numbered legend. Clean geometry, plated labels, one bubble per step.
import { INK } from '../palette.mjs';

export default {
  name: 'numbered-legend',
  kind: 'clean',
  engine: 'clean',
  seed: 11,
  font: 'clean',
  roughness: 0,
  bowing: 0,
  strokeScale: 1,
  palette: (onDark) => ({
    ring: onDark ? INK.amberOnDark : INK.brand,
    leader: onDark ? INK.amberOnDark : INK.brand,
    label: onDark ? INK.paper : INK.darkInk,
    plate: onDark ? 'rgba(28,32,44,0.85)' : 'rgba(255,255,255,0.92)',
    plateBorder: onDark ? INK.amberOnDark : INK.brand,
    bubbleFill: onDark ? INK.amberOnDark : INK.brand,
    bubbleText: onDark ? INK.darkInk : INK.paper,
  }),
};
