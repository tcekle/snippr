// Render an annotated figure from a spec.
//
//   node scripts/annotate.mjs figures/sign-in.json
//   node scripts/annotate.mjs figures/sign-in.json --style plain-ink --out /tmp/try.png
//   node scripts/annotate.mjs figures/sign-in.json --contact-sheet     # every preset
//
// A spec never contains pixel coordinates for a target — see scripts/select.mjs.

import sharp from 'sharp';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

import { loadImage, measure } from './measure.mjs';
import { resolveTarget } from './select.mjs';
import { layoutFigure } from './layout.mjs';
import { Sketch } from './drawing.mjs';
import { getEngine, getStyle, STYLES } from './styles/index.mjs';
import { composeFigure } from './render.mjs';
import { BACKDROPS } from './palette.mjs';

export async function renderFigure(spec, overrides = {})
{
  const styleName = overrides.style ?? spec.style;
  const style = getStyle(styleName);
  const backdrop = overrides.backdrop ?? spec.backdrop ?? null;

  if (backdrop && !BACKDROPS[backdrop])
  {
    throw new Error(`Unknown backdrop "${backdrop}". Known: ${Object.keys(BACKDROPS).join(', ')}`);
  }

  const source = path.resolve(spec.baseDir ?? '.', spec.source);
  const image = await loadImage(source);
  const report = await measure(source);

  // Resolve every target before laying anything out, so a bad selector fails with a
  // useful message instead of producing a figure with a callout pointing at nothing.
  const callouts = spec.callouts.map((callout, index) =>
  {
    try
    {
      return {
        ...callout,
        rect: resolveTarget(callout.target, report, image),
        labelRect: callout.labelIn ? resolveTarget(callout.labelIn, report, image) : null,
      };
    }
    catch (error)
    {
      throw new Error(`callout[${index}]${callout.label ? ` ("${callout.label}")` : ''}: ${error.message}`);
    }
  });

  const includeRect = spec.cropInclude ? resolveTarget(spec.cropInclude, report, image) : null;
  const layout = layoutFigure({ report, callouts, style, options: { ...spec, backdrop, includeRect } });

  const onDark = Boolean(backdrop && BACKDROPS[backdrop].dark);
  const palette = style.palette(onDark);

  const sketch = new Sketch({
    width: layout.figure.width,
    height: layout.figure.height,
    seed: overrides.seed ?? spec.seed ?? style.seed,
    roughness: style.roughness,
    bowing: style.bowing,
  });

  if (style.fontScale)
  {
    for (const placement of layout.placements)
    {
      placement.fontSize *= style.fontScale;
    }
  }

  getEngine(style)(sketch, layout, style, palette);

  const screenshot = await sharp(source)
    .extract({
      left: layout.cropRect.x,
      top: layout.cropRect.y,
      width: layout.cropRect.width,
      height: layout.cropRect.height,
    })
    .png()
    .toBuffer();

  const png = await composeFigure({
    figure: layout.figure,
    screenshot,
    screenshotSize: { width: layout.cropRect.width, height: layout.cropRect.height },
    offset: { x: layout.margin.left, y: layout.margin.top },
    overlaySvg: sketch.toSvg(),
    backdrop,
    // Only matters when there is a gutter and no backdrop behind it.
    backgroundFill: report.background.hex,
    cornerRadius: overrides.cornerRadius ?? spec.cornerRadius ?? 0,
  });

  return { png, layout, style, report, warnings: layout.warnings };
}

export function loadSpec(file)
{
  const resolved = path.resolve(file);
  const spec = JSON.parse(readFileSync(resolved, 'utf8'));
  spec.baseDir = spec.baseDir ? path.resolve(path.dirname(resolved), spec.baseDir) : path.dirname(resolved);
  return spec;
}

const invokedDirectly = process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/annotate.mjs');

if (invokedDirectly)
{
  const program = new Command();
  program
    .argument('<spec>', 'figure spec JSON')
    .option('--style <name>', 'override the spec style')
    .option('--backdrop <name>', 'override the spec backdrop')
    .option('--out <file>', 'override the spec output path')
    .option('--corner-radius <px>', 'round the screenshot corners', (value) => Number(value))
    .option('--contact-sheet', 'render every style to <out>/<style>.png for comparison')
    .parse();

  const options = program.opts();
  const spec = loadSpec(program.args[0]);

  const write = async (buffer, file) =>
  {
    mkdirSync(path.dirname(file), { recursive: true });
    await sharp(buffer).toFile(file);
    const { width, height } = await sharp(file).metadata();
    console.log(`  ${file}  ${width}x${height}  ${Math.round(statSync(file).size / 1024)} KB`);
  };

  if (options.contactSheet)
  {
    const directory = options.out ?? path.resolve(spec.baseDir, 'contact-sheet');
    console.log(`contact sheet -> ${directory}`);
    for (const name of Object.keys(STYLES))
    {
      const { png, warnings } = await renderFigure(spec, { ...options, style: name });
      await write(png, path.join(directory, `${name}.png`));
      for (const warning of warnings)
      {
        console.warn(`    warning: ${warning}`);
      }
    }
  }
  else
  {
    const { png, layout, style, warnings } = await renderFigure(spec, options);
    const out = options.out ?? path.resolve(spec.baseDir, spec.output);
    console.log(
      `${style.name}${spec.backdrop || options.backdrop ? ` on ${options.backdrop ?? spec.backdrop}` : ''}  ` +
      `crop ${layout.cropRect.width}x${layout.cropRect.height}  ` +
      `margin ${Math.round(layout.margin.top)}/${Math.round(layout.margin.right)}/` +
      `${Math.round(layout.margin.bottom)}/${Math.round(layout.margin.left)}`);
    await write(png, out);
    for (const warning of warnings)
    {
      console.warn(`  warning: ${warning}`);
    }
  }
}
