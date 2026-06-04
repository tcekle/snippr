export function buildPixelateCanvas(
  imageEl: HTMLImageElement,
  region: { x: number; y: number; width: number; height: number },
  pixelSize: number
): HTMLCanvasElement {
  const { x, y, width, height } = region;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Draw the region at pixel block size, then scale up
  const blockW = Math.max(1, Math.round(width / pixelSize));
  const blockH = Math.max(1, Math.round(height / pixelSize));

  // Draw small
  ctx.drawImage(imageEl, x, y, width, height, 0, 0, blockW, blockH);
  // Scale up with nearest-neighbor (pixelated)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, blockW, blockH, 0, 0, width, height);

  return canvas;
}
