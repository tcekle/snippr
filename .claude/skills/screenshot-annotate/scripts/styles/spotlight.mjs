// Spotlight. Dims everything except the annotated regions.
//
// The scrim is punched out over each target, so the control keeps its true colour and
// only its surroundings darken — the same correctness rule as the highlighter band.
import { INK } from '../palette.mjs';

export default {
  name: 'spotlight',
  kind: 'clean',
  engine: 'clean',
  seed: 13,
  font: 'cleanBold',
  roughness: 0,
  bowing: 0,
  strokeScale: 1,
  scrim: true,
  scrimOpacity: 0.55,
  labelPlate: false,
  palette: () => ({
    ring: INK.paper,
    leader: INK.paper,
    label: INK.paper,
    scrim: '#0B1220',
    bubbleFill: INK.paper,
    bubbleText: INK.darkInk,
  }),
};
