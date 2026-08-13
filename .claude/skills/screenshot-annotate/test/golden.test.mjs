// Golden-image regression test.
//
// The renderer is deterministic by construction — fixed Rough.js seeds, no RNG, no
// system font lookup — so the same spec must produce the same bytes. That is a stronger
// property than it sounds: it means a figure regenerated in CI six months from now is
// identical to the one in the manual, and it makes any accidental drift (a changed
// default, a bumped dependency, a font resolving differently) fail loudly here instead
// of quietly restyling every figure in the docs.
//
//   node test/golden.test.mjs              check against the recorded goldens
//   node test/golden.test.mjs --update     re-record them (review the diff!)
//
// Rough.js and resvg are pinned to exact versions in package.json for the same reason.
//
// A case whose spec is missing SKIPS rather than fails, so a clone that does not carry the
// figure working set still runs clean. Decide early whether your specs and sources are
// committed: if they are not, a golden only ever protects a working tree that already has
// them, and the prose page describing the figure becomes the only record.
//
// ADDING A CASE. One line per figure you ship. What makes a case worth its bytes is the
// failure it would catch that nothing else would — in the PSV set that was usually a target
// that resolves through a filter chain, because a filter chain keeps resolving long after it
// stops being right, and the figure still renders and still reports success with the ring
// around the neighbouring control. Write the reason as a comment beside the case; the
// original set's are preserved in examples/FIGURES-psv-original.md and are worth skimming
// for the shape of them.

import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { loadSpec, renderFigure } from '../scripts/annotate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.join(HERE, 'golden');
const DIFF_DIR = path.join(HERE, 'diff');
const update = process.argv.includes('--update');

const CASES = [
  { name: 'demo', spec: 'example/demo.json', overrides: {} },
];

// Antialiasing of the same paths is bit-stable here, so the tolerance only needs to
// absorb PNG encoder noise. Anything larger is a real change to the figure.
const THRESHOLD = 0.1;
const MAX_DIFFERING_FRACTION = 0.0002;

mkdirSync(GOLDEN_DIR, { recursive: true });

let failures = 0;
let skipped = 0;

for (const testCase of CASES)
{
  const specPath = path.join(HERE, '..', testCase.spec);

  // The working set is local-only. A missing spec means this figure has not been re-shot
  // on this machine, which is not a failure — see the note at the top of this file.
  if (!existsSync(specPath))
  {
    skipped++;
    continue;
  }

  const spec = loadSpec(specPath);
  const { png } = await renderFigure(spec, testCase.overrides);
  const goldenPath = path.join(GOLDEN_DIR, `${testCase.name}.png`);

  if (update || !existsSync(goldenPath))
  {
    writeFileSync(goldenPath, png);
    console.log(`${update ? 'RECORDED' : 'CREATED '}  ${testCase.name}`);
    continue;
  }

  const actual = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const expected = await sharp(goldenPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  if (actual.info.width !== expected.info.width || actual.info.height !== expected.info.height)
  {
    failures++;
    console.log(
      `FAIL      ${testCase.name}  size changed: ` +
      `${expected.info.width}x${expected.info.height} -> ${actual.info.width}x${actual.info.height}`);
    continue;
  }

  const { width, height } = actual.info;
  const diff = Buffer.alloc(width * height * 4);
  const differing = pixelmatch(actual.data, expected.data, diff, width, height, { threshold: THRESHOLD });
  const fraction = differing / (width * height);
  const passed = fraction <= MAX_DIFFERING_FRACTION;

  if (!passed)
  {
    failures++;
    mkdirSync(DIFF_DIR, { recursive: true });
    const diffPath = path.join(DIFF_DIR, `${testCase.name}.png`);
    await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(diffPath);
    console.log(
      `FAIL      ${testCase.name}  ${differing} px differ ` +
      `(${(fraction * 100).toFixed(4)}%)  -> ${diffPath}`);
    continue;
  }

  console.log(`PASS      ${testCase.name}  ${differing} px differ`);
}

if (failures > 0)
{
  console.error(
    `\n${failures} figure(s) drifted. Look at the diffs above. If the change is intended, ` +
    're-record with `node test/golden.test.mjs --update` and review the image diff in the commit.');
  process.exit(1);
}

if (skipped === CASES.length)
{
  console.log(
    `\nAll ${CASES.length} figure(s) skipped — no specs present on this machine. ` +
    'If the figure working set is gitignored in your project, this is expected on a fresh clone.');
}
else
{
  console.log(
    `\n${CASES.length - skipped} figure(s) stable` +
    `${skipped > 0 ? `, ${skipped} skipped (no spec on this machine)` : ''}.`);
}
