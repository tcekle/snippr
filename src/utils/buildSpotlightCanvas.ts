export function buildSpotlightCanvas(
  docW: number, docH: number,
  region: { x: number; y: number; width: number; height: number },
  shape: 'rect' | 'ellipse',
  dim: number, feather: number, invert: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(docW));
  canvas.height = Math.max(1, Math.round(docH));
  const ctx = canvas.getContext('2d')!;

  const path = () => {
    ctx.beginPath();
    if (shape === 'ellipse') {
      ctx.ellipse(region.x + region.width / 2, region.y + region.height / 2,
        Math.max(1, region.width / 2), Math.max(1, region.height / 2), 0, 0, Math.PI * 2);
    } else {
      ctx.rect(region.x, region.y, region.width, region.height);
    }
    ctx.closePath();
  };

  if (!invert) {
    // veil everywhere, then erase the region
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    if (feather > 0) { ctx.shadowColor = '#000'; ctx.shadowBlur = feather; }
    ctx.fillStyle = '#000';
    path(); ctx.fill();
    ctx.restore();
  } else {
    // dim only inside the region
    ctx.save();
    if (feather > 0) { ctx.shadowColor = `rgba(0,0,0,${dim})`; ctx.shadowBlur = feather; }
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    path(); ctx.fill();
    ctx.restore();
  }
  return canvas;
}
