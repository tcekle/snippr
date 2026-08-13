/** Hand-lettered faces for sketch annotations.
 *
 * All three are SIL Open Font License 1.1 — see `src/assets/fonts/OFL.txt`,
 * which ships alongside them because the licence requires it.
 *
 * Canvas text does not wait for webfonts: Konva measures and rasterises with
 * whatever is resolved at draw time, so a label drawn before the face loads is
 * laid out in the fallback and never corrects itself. `whenHandFontsReady`
 * exists so the canvas can force one redraw once they are in.
 */

export const HAND_FONTS = ['Kalam', 'Patrick Hand', 'Architects Daughter'] as const;
export type HandFont = (typeof HAND_FONTS)[number];

/** Default label face — the marker hand the screenshot-annotate skill uses. */
export const HAND_FONT: HandFont = 'Kalam';

/** Resolves once every hand face is usable, or immediately where the Font
 *  Loading API is missing (older WebView2, and the plain-browser demo path). */
export function whenHandFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return Promise.all(
    HAND_FONTS.map((f) => document.fonts.load(`16px "${f}"`).catch(() => undefined)),
  ).then(() => undefined);
}
