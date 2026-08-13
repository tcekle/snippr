// Font registry.
//
// resvg is handed these files explicitly through `font.fontFiles`. Name-based lookup
// against installed system fonts is deliberately not used: it renders differently on
// every machine and silently falls back to a default face when a name misses, which
// produces a figure that looks fine locally and wrong in CI.
//
// All faces are SIL Open Font License, which permits commercial documentation use.
// Vendored as .ttf rather than pulled from `@fontsource/*` at build time because those
// packages ship only .woff/.woff2 and resvg's font database will not load woff2.
// Sources are the OFL directories of https://github.com/google/fonts.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = path.resolve(HERE, '../assets/fonts');

/**
 * Logical font slots. Styles reference these keys rather than family strings so a face
 * can be swapped in one place.
 *
 * `family` is the name emitted into the SVG `font-family` attribute and must match the
 * family name inside the TTF, because that is how resvg matches a loaded file to a run
 * of text.
 */
export const FONTS = {
  // Plain ink sketch, and the numerals inside numbered bubbles: Kalam's `1` reads as a
  // bare slash at bubble sizes, so digits always come from Patrick Hand.
  hand: { family: 'Patrick Hand', weight: 400, file: 'PatrickHand-Regular.ttf' },
  // Marker rings.
  markerBold: { family: 'Kalam', weight: 700, file: 'Kalam-Bold.ttf' },
  // Numbered-bubble labels.
  marker: { family: 'Kalam', weight: 400, file: 'Kalam-Regular.ttf' },
  // Highlighter.
  highlighter: { family: 'Architects Daughter', weight: 400, file: 'ArchitectsDaughter-Regular.ttf' },
  // The non-sketch clean presets.
  clean: { family: 'Poppins', weight: 400, file: 'Poppins-Regular.ttf' },
  cleanBold: { family: 'Poppins', weight: 600, file: 'Poppins-SemiBold.ttf' },
};

/**
 * Handwriting faces need roughly 20-25% more point size than a grotesque to read at the
 * same visual weight. Styles declare a nominal size; this scales it for the slot in use.
 */
export const FONT_SIZE_SCALE = {
  hand: 1.22,
  markerBold: 1.22,
  marker: 1.22,
  highlighter: 1.25,
  clean: 1,
  cleanBold: 1,
};

/** Absolute paths to every vendored face, for resvg's `font.fontFiles`. */
export function fontFiles()
{
  return Object.values(FONTS).map((font) =>
  {
    const full = path.join(FONT_DIR, font.file);
    if (!existsSync(full))
    {
      throw new Error(
        `Missing vendored font ${font.file}. Expected at ${full}. ` +
        'See assets/fonts/README.md for the download commands.');
    }
    return full;
  });
}

/** resvg options block shared by every rasterisation in this skill. */
export function resvgFontOptions()
{
  return { fontFiles: fontFiles(), loadSystemFonts: false };
}
