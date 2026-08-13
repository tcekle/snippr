// Proves the single most likely thing to break: resvg loading the vendored TTFs.
//
// A missing font renders as blank space rather than raising, so "it did not throw"
// proves nothing. This counts rendered ink per text band and fails if any face drew
// nothing. `loadSystemFonts: false` means a broken font path fails here instead of
// silently falling back to whatever the host machine happens to have installed.
//
//   node test/font-path.test.mjs

import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { FONTS, FONT_DIR, resvgFontOptions } from '../scripts/fonts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'font-path.png');

const BACKGROUND = '#F0F4F8';
const LINE_HEIGHT = 90;
const WIDTH = 1200;

const slots = Object.entries(FONTS);
const height = LINE_HEIGHT * slots.length + 40;

const rows = slots
  .map(([slot, font], index) =>
    `<text x="30" y="${70 + index * LINE_HEIGHT}" font-family="${font.family}"` +
    ` font-weight="${font.weight}" font-size="44" fill="#123478">` +
    `${slot}: ${font.family} ${font.weight} — Sign In 0123456789</text>`)
  .join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}">
  <rect width="100%" height="100%" fill="${BACKGROUND}"/>
  ${rows}
</svg>`;

const png = new Resvg(svg, { font: resvgFontOptions() }).render().asPng();
writeFileSync(OUT, png);

const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, channels } = raw.info;

let failures = 0;
slots.forEach(([slot, font], index) =>
{
  const top = 30 + index * LINE_HEIGHT;
  const bottom = top + LINE_HEIGHT - 10;
  let ink = 0;
  for (let y = top; y < bottom; y++)
  {
    for (let x = 0; x < width; x++)
    {
      // Anything appreciably darker than the background is a rendered glyph.
      if (raw.data[(y * width + x) * channels] < 200)
      {
        ink++;
      }
    }
  }

  const passed = ink > 500;
  if (!passed)
  {
    failures++;
  }
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${slot.padEnd(12)} ${font.family} ${font.weight}  ink=${ink}`);
});

console.log(`\nvendored: ${readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).join(', ')}`);
console.log(`wrote ${OUT}`);

if (failures > 0)
{
  console.error(`\n${failures} face(s) rendered no glyphs — check assets/fonts and scripts/fonts.mjs`);
  process.exit(1);
}
console.log('\nAll faces rasterised through explicit fontFiles.');
