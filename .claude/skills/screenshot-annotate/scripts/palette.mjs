// Colour tokens.
//
// #054BAA is the only brand-verified value: it is `theme-color` site-wide on dataio.com
// and the exact blue of the PSV logo in the screenshots. Everything else is chosen to sit
// with it. The purple backdrops below were requested but could NOT be confirmed anywhere
// in Data I/O's palette — see references/style-guide.md, "Unresolved".

export const INK = {
  /** Brand reference. Kept for alignment; annotations rarely use it directly, because a
   *  callout in the product's own blue competes with the product's own blue. */
  brand: '#054BAA',
  /** Sketch annotations on light backgrounds. */
  inkBlue: '#123478',
  /** Marker rings. */
  amber: '#BF6F14',
  /** Amber lifts on dark backdrops. */
  amberOnDark: '#CE7A1A',
  amberLabelOnDark: '#F6BA58',
  /** Print-safe and highlighter. */
  darkInk: '#1C202C',
  /** Ground for a label plate. Near-neutral on purpose: this is the ink's own ground
   *  inside a figure that has no backdrop, so a tinted wash would introduce a hue that
   *  appears nowhere else in the picture. */
  plateWash: '#141821',
  highlighter: '#FFCE38',
  paper: '#FFFFFF',
};

/** Measured out of the UI itself — useful for masks and for matching a control's fill. */
export const UI = {
  background: '#F0F4F8',
  inputFill: '#E2E8F0',
  border: '#CBD5E1',
};

/**
 * Backdrop gradients for frame diagrams (§5.6).
 *
 * `dark: true` switches annotations to the lifted amber and tells the renderer the
 * screenshot needs a hairline edge so a light title bar does not bleed into the gradient.
 */
export const BACKDROPS = {
  cool: { from: '#F2F6FB', to: '#C6D5E8', dark: false, note: 'On-brand, safest' },
  warm: { from: '#FAF6F0', to: '#DBD2C6', dark: false, note: 'Good on off-white paper' },
  navy: { from: '#1E3452', to: '#0C1626', dark: true, note: 'Screenshot pops' },
  'violet-brand': { from: '#07307A', to: '#4E288C', dark: true, note: 'Purple, anchored near brand blue' },
  'indigo-violet': { from: '#26164A', to: '#683EA8', dark: true, note: 'Most saturated purple' },
  plum: { from: '#2C1238', to: '#7A3A6A', dark: true, note: 'Magenta lift' },
  aubergine: { from: '#1A102E', to: '#3C2660', dark: true, note: 'Restrained purple' },
  lavender: { from: '#F5F2FC', to: '#CEC2E8', dark: false, note: 'Only purple that prints cleanly' },
};
