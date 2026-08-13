// Rasterise and composite.
//
// Pipeline, per the handoff's architecture:
//   backdrop gradient -> drop shadow -> screenshot (corner-masked) -> annotation overlay
//
// Headless Chrome would also do this, but it is a heavyweight dependency for a few
// hundred SVG paths and it makes CI slow and flaky. resvg + sharp stay fast and
// deterministic.

import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

import { BACKDROPS } from './palette.mjs';
import { resvgFontOptions } from './fonts.mjs';

/**
 * Supersample factor for the annotation layer.
 *
 * Rendering the strokes and handwriting at 2-3x and downsampling is what makes them look
 * smooth rather than aliased. Scaled by canvas size because a 3640x2320 canvas at 3x is
 * roughly 125MB per RGBA layer — the prototype had to drop to 2x there.
 */
export function supersampleFactor(width)
{
  if (width <= 2400) { return 3; }
  if (width <= 3200) { return 2.5; }
  return 2;
}

/** Rasterise an SVG through resvg with the vendored fonts wired in explicitly. */
export function rasterise(svg, targetWidth)
{
  const resvg = new Resvg(svg, {
    font: resvgFontOptions(),
    fitTo: targetWidth ? { mode: 'width', value: Math.round(targetWidth) } : { mode: 'original' },
  });
  return resvg.render().asPng();
}

/**
 * Gradient backdrop for a frame diagram (§5.6).
 *
 * The radial lighten at ~16% height is what stops it reading as a flat ramp — without it
 * a two-stop linear gradient looks like a PowerPoint background.
 */
export function backdropSvg({ width, height, preset })
{
  const backdrop = BACKDROPS[preset];
  if (!backdrop)
  {
    throw new Error(`Unknown backdrop "${preset}". Known: ${Object.keys(BACKDROPS).join(', ')}`);
  }

  // ~118 degrees, expressed as gradient endpoints in object space.
  const radians = (118 * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="ramp" x1="${0.5 - dx}" y1="${0.5 - dy}" x2="${0.5 + dx}" y2="${0.5 + dy}">
        <stop offset="0" stop-color="${backdrop.from}"/>
        <stop offset="1" stop-color="${backdrop.to}"/>
      </linearGradient>
      <radialGradient id="lift" cx="0.5" cy="0.16" r="0.75">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="${backdrop.dark ? 0.18 : 0.55}"/>
        <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#ramp)"/>
    <rect width="100%" height="100%" fill="url(#lift)"/>
  </svg>`;
}

function roundedRectSvg({ width, height, rect, radius, fill })
{
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" ` +
    `rx="${radius}" fill="${fill}"/></svg>`;
}

/**
 * Round the screenshot's corners.
 *
 * This is a cosmetic edit to a real capture — in practice it only clips background
 * pixels, but §5.1.1 makes "never alter the capture" the governing rule, so the radius
 * defaults to 0 and a spec has to opt in.
 */
export async function roundCorners(buffer, { width, height, radius })
{
  if (!radius)
  {
    return buffer;
  }
  const mask = Buffer.from(roundedRectSvg({
    width,
    height,
    rect: { x: 0, y: 0, width, height },
    radius,
    fill: '#FFFFFF',
  }));
  return sharp(buffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}


/** `#RRGGBB` to the object sharp's `create.background` wants. */
function parseFill(hex)
{
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    alpha: 1,
  };
}

/**
 * Assemble the figure.
 *
 * `screenshot` is already cropped; `offset` is where it sits inside the figure, which is
 * non-zero exactly when margin was added for labels.
 */
export async function composeFigure({
  figure,
  screenshot,
  screenshotSize,
  offset,
  overlaySvg,
  backdrop = null,
  backgroundFill = null,
  cornerRadius = 0,
  shadow = true,
})
{
  const layers = [];
  let base;

  if (backdrop)
  {
    base = sharp(rasterise(backdropSvg({ width: figure.width, height: figure.height, preset: backdrop })));

    if (shadow)
    {
      // Blur the window silhouette and drop it behind the screenshot.
      const silhouette = rasterise(roundedRectSvg({
        width: figure.width,
        height: figure.height,
        rect: {
          x: offset.x,
          y: offset.y + figure.width * 0.007,
          width: screenshotSize.width,
          height: screenshotSize.height,
        },
        radius: cornerRadius,
        fill: 'rgba(6,14,28,0.42)',
      }));
      const blurred = await sharp(silhouette)
        .blur(Math.max(1, figure.width * 0.012))
        .png()
        .toBuffer();
      layers.push({ input: blurred, top: 0, left: 0 });
    }
  }
  else
  {
    // Fill the gutter with the capture's own background rather than leaving it
    // transparent. A transparent margin renders white, which puts a hard seam down the
    // side of any screenshot whose background is not pure white — and the PSV app's is
    // #F0F4F8, so the seam shows on every figure that carries a label gutter.
    const fill = backgroundFill ? parseFill(backgroundFill) : { r: 255, g: 255, b: 255, alpha: 0 };
    base = sharp({
      create: { width: figure.width, height: figure.height, channels: 4, background: fill },
    });
  }

  const rounded = await roundCorners(screenshot, {
    width: screenshotSize.width,
    height: screenshotSize.height,
    radius: cornerRadius,
  });
  layers.push({ input: rounded, top: Math.round(offset.y), left: Math.round(offset.x) });

  if (backdrop)
  {
    // Hairline edge, so a light title bar does not bleed into a light gradient.
    const edge = rasterise(`<svg xmlns="http://www.w3.org/2000/svg" width="${figure.width}" height="${figure.height}">
      <rect x="${offset.x + 0.5}" y="${offset.y + 0.5}" width="${screenshotSize.width - 1}" ` +
      `height="${screenshotSize.height - 1}" rx="${cornerRadius}" fill="none" ` +
      `stroke="rgba(15,23,42,0.20)" stroke-width="1"/></svg>`);
    layers.push({ input: edge, top: 0, left: 0 });
  }

  if (overlaySvg)
  {
    const factor = supersampleFactor(figure.width);
    const overlay = await sharp(rasterise(overlaySvg, figure.width * factor))
      .resize(figure.width, figure.height, { kernel: 'lanczos3', fit: 'fill' })
      .png()
      .toBuffer();
    layers.push({ input: overlay, top: 0, left: 0 });
  }

  return base.composite(layers).png({ compressionLevel: 9 }).toBuffer();
}
