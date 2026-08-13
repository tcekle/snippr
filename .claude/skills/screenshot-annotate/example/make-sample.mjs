// Regenerate example/sample-app.png.
//
// The bundle ships the PNG, so you never need to run this. It is here so the demo
// screenshot is reproducible rather than a mystery binary, and so you can see the shapes
// the detector is meant to find.
//
//   node example/make-sample.mjs
//
// READ THIS BEFORE COPYING THE PATTERN. A drawn mock is exactly what a real figure must
// never be — see rule 1.1 in references/style-guide.md. This file is a TEST FIXTURE. It
// exists for one reason: so the install can be proved end to end on a machine that has
// none of your screenshots on it. Nothing in a real manual may be made this way. When you
// make a real figure, capture the real product and point the spec's `source` at that.
//
// WHY THIS SCREEN AND NOT A LOGIN FORM. The first version of this fixture was a sign-in
// card, and it had to be thrown away: a username field, a password field and a Continue
// button are all self-describing, so every callout you can write about them just reads the
// label back to the reader. That is the exact anti-pattern DOCTRINE.md cuts. A device list
// has states, scopes and an unlabelled control on it — things a picture can show but
// cannot explain — so it can carry three callouts that earn their place.

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { resvgFontOptions } from '../scripts/fonts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'sample-app.png');

const WIDTH = 1400;
const HEIGHT = 720;

const PAGE = '#F0F4F8';
const SURFACE = '#FFFFFF';
const RULE = '#CBD5E1';
const TEXT = '#334155';
const MUTED = '#7A8699';

// Each of the three annotated controls carries a fill that appears nowhere else in the
// image, so the demo spec can name it without an index and without a coordinate.
const ICON_BUTTON = '#CBD5E1';
const ADD_BUTTON = '#2563EB';
const CHIP_FAULT = '#FEE2E2';
const CHIP_READY = '#DCFCE7';
const CHIP_OFFLINE = '#E2E8F0';

const NAV_ITEMS = ['Overview', 'Devices', 'Jobs', 'Reports', 'Settings'];
const ACTIVE_NAV = 1;

const ROWS = [
  { name: 'DEV-01', address: '10.0.4.11', status: 'Ready', chip: CHIP_READY, ink: '#15803D', cycles: '1,284' },
  { name: 'DEV-02', address: '10.0.4.12', status: 'Ready', chip: CHIP_READY, ink: '#15803D', cycles: '1,190' },
  { name: 'DEV-03', address: '10.0.4.13', status: 'Fault', chip: CHIP_FAULT, ink: '#B91C1C', cycles: '—' },
  { name: 'DEV-04', address: '10.0.4.14', status: 'Offline', chip: CHIP_OFFLINE, ink: '#64748B', cycles: '0' },
];

/** A line of Poppins, positioned by its baseline. */
function label(x, y, value, { size = 20, fill = TEXT, weight = 400, anchor = 'start' } = {})
{
  return `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
}

/**
 * The circular-arrow glyph on the icon-only button.
 *
 * Deliberately wordless: a control whose meaning a reader cannot get from the picture is
 * exactly what a callout is for, and the demo needs one.
 */
function refreshGlyph(cx, cy, radius)
{
  return `<path d="M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}" ` +
    `fill="none" stroke="${TEXT}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M ${cx - 6} ${cy - radius - 6} L ${cx - 6} ${cy - radius + 6} L ${cx + 7} ${cy - radius} Z" ` +
    `fill="${TEXT}"/>`;
}

const navRows = NAV_ITEMS
  .map((item, index) =>
    label(48, 148 + index * 54, item, { size: 20, fill: index === ACTIVE_NAV ? TEXT : MUTED }))
  .join('\n  ');

// Table geometry.
const CARD = { x: 300, y: 200, width: 1060, height: 420 };
const COL = { name: 340, address: 570, status: 810, cycles: 1320 };
const HEADER_BASELINE = CARD.y + 46;
const HEADER_RULE = CARD.y + 66;
const ROW_HEIGHT = 78;

const headerRow =
  label(COL.name, HEADER_BASELINE, 'Name', { size: 18, fill: MUTED, weight: 600 }) + '\n  ' +
  label(COL.address, HEADER_BASELINE, 'Address', { size: 18, fill: MUTED, weight: 600 }) + '\n  ' +
  label(COL.status, HEADER_BASELINE, 'Status', { size: 18, fill: MUTED, weight: 600 }) + '\n  ' +
  label(COL.cycles, HEADER_BASELINE, 'Cycles', { size: 18, fill: MUTED, weight: 600, anchor: 'end' });

const bodyRows = ROWS
  .map((row, index) =>
  {
    const top = HEADER_RULE + index * ROW_HEIGHT;
    const middle = top + ROW_HEIGHT / 2;
    const baseline = middle + 7;
    const separator = index === 0
      ? ''
      : `<rect x="${CARD.x + 24}" y="${top}" width="${CARD.width - 48}" height="1" fill="#EAEFF5"/>\n  `;
    return separator +
      label(COL.name, baseline, row.name, { size: 20 }) + '\n  ' +
      label(COL.address, baseline, row.address, { size: 20, fill: MUTED }) + '\n  ' +
      `<rect x="${COL.status}" y="${middle - 22}" width="126" height="44" rx="8" fill="${row.chip}"/>` + '\n  ' +
      label(COL.status + 63, baseline - 1, row.status, { size: 18, fill: row.ink, weight: 600, anchor: 'middle' }) + '\n  ' +
      label(COL.cycles, baseline, row.cycles, { size: 20, anchor: 'end' });
  })
  .join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect width="100%" height="100%" fill="${PAGE}"/>

  <!-- title bar, closed by a 1px rule so the panel selector has an edge to find -->
  <rect x="0" y="0" width="${WIDTH}" height="72" fill="${SURFACE}"/>
  <rect x="0" y="72" width="${WIDTH}" height="1" fill="${RULE}"/>
  ${label(32, 46, 'Acme Console', { size: 24, weight: 600 })}
  ${label(WIDTH - 32, 46, 'operator', { size: 19, fill: MUTED, anchor: 'end' })}

  <!-- left navigation, closed by a 1px rule -->
  <rect x="0" y="73" width="260" height="${HEIGHT - 73}" fill="${SURFACE}"/>
  <rect x="260" y="73" width="1" height="${HEIGHT - 73}" fill="${RULE}"/>
  ${navRows}

  <!-- page heading and toolbar -->
  ${label(CARD.x, 148, 'Devices', { size: 30, weight: 600 })}
  <rect x="1036" y="106" width="56" height="56" rx="6" fill="${ICON_BUTTON}"/>
  ${refreshGlyph(1064, 134, 13)}
  <rect x="1150" y="108" width="210" height="52" rx="10" fill="${ADD_BUTTON}"/>
  ${label(1255, 141, '+ Add device', { size: 19, fill: '#FFFFFF', weight: 600, anchor: 'middle' })}

  <!-- the table -->
  <rect x="${CARD.x}" y="${CARD.y}" width="${CARD.width}" height="${CARD.height}" rx="14" fill="${SURFACE}"/>
  ${headerRow}
  <rect x="${CARD.x}" y="${HEADER_RULE}" width="${CARD.width}" height="1" fill="#E3E9F0"/>
  ${bodyRows}
</svg>`;

writeFileSync(OUT, new Resvg(svg, { font: resvgFontOptions() }).render().asPng());
console.log(`wrote ${OUT}  ${WIDTH}x${HEIGHT}`);
