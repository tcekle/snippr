// Marker rings. Heavier hand than plain-ink, and the preset chosen for the app-shell
// frame diagram.
import { INK } from '../palette.mjs';

export default {
  name: 'marker-rings',
  kind: 'sketch',
  engine: 'ring',
  seed: 21,
  font: 'markerBold',
  roughness: 0.9,
  bowing: 1,
  strokeScale: 1,
  ringStart: 0.14,
  ringTravel: 1.08,
  // Amber collides with the product's own amber (the Not homed indicator, the
  // service-mode banners) — see references/style-guide.md, "Unresolved". Prefer
  // plain-ink on amber-heavy screens until that is settled.
  palette: (onDark) => ({
    ring: onDark ? INK.amberOnDark : INK.amber,
    leader: onDark ? INK.amberOnDark : INK.amber,
    label: onDark ? INK.amberLabelOnDark : INK.amber,
    // Only used where a spec opts a label into a plate. The plate carries the dark
    // ground, so the ink on it is the same lifted amber a dark backdrop already uses —
    // an in-frame plated label and a gutter label on aubergine are then the same
    // ink-on-ground pair, and the figure keeps one hand throughout.
    plateFill: INK.plateWash,
    plateOpacity: 0.82,
    plateInk: INK.amberLabelOnDark,
  }),
};
