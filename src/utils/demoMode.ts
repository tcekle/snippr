// Dev-only demo mode for README screenshots: `http://localhost:1420/?demo=1`
// Generates a fake app-window "screenshot" and loads it with sample annotations.
import { nanoid } from 'nanoid';
import { useEditorStore } from '../store/editorStore';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draw a plausible-looking app window to annotate. */
function drawDemoWindow(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  // Desktop backdrop
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1e3a5f');
  grad.addColorStop(1, '#0f1d2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Window chrome
  const wx = 60, wy = 40, ww = w - 120, wh = h - 100;
  ctx.fillStyle = '#252526';
  roundRect(ctx, wx, wy, ww, wh, 10);
  ctx.fill();
  ctx.fillStyle = '#333333';
  roundRect(ctx, wx, wy, ww, 42, 10);
  ctx.fill();
  ctx.fillRect(wx, wy + 32, ww, 10);

  // Traffic lights + title
  for (const [i, color] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(wx + 24 + i * 22, wy + 21, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#9d9d9d';
  ctx.font = '13px Segoe UI';
  ctx.fillText('Quarterly Report — Dashboard', wx + ww / 2 - 90, wy + 26);

  // Sidebar
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(wx, wy + 42, 190, wh - 42);
  ctx.font = '13px Segoe UI';
  const items = ['Overview', 'Analytics', 'Reports', 'Exports', 'Team', 'Settings'];
  items.forEach((label, i) => {
    if (i === 1) {
      ctx.fillStyle = '#094771';
      ctx.fillRect(wx + 8, wy + 60 + i * 36, 174, 28);
    }
    ctx.fillStyle = i === 1 ? '#ffffff' : '#a0a0a0';
    ctx.fillText(label, wx + 24, wy + 79 + i * 36);
  });

  // Content: heading + text lines
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 22px Segoe UI';
  ctx.fillText('Revenue overview', wx + 220, wy + 90);
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '13px Segoe UI';
  const lines = [
    'Quarterly revenue grew 14% over the previous period, driven by',
    'expansion in the enterprise segment and improved retention.',
    'Conversion from trial accounts remains the primary growth lever.',
  ];
  lines.forEach((t, i) => ctx.fillText(t, wx + 220, wy + 120 + i * 20));

  // Bar chart
  const bars = [62, 84, 71, 96, 120, 105, 140];
  bars.forEach((v, i) => {
    ctx.fillStyle = i === bars.length - 1 ? '#2f81f7' : '#3d5a80';
    ctx.fillRect(wx + 230 + i * 64, wy + 330 - v, 40, v);
  });
  ctx.strokeStyle = '#3d3d3d';
  ctx.beginPath();
  ctx.moveTo(wx + 220, wy + 332);
  ctx.lineTo(wx + 700, wy + 332);
  ctx.stroke();

  // Primary button (annotation target)
  ctx.fillStyle = '#2f81f7';
  roundRect(ctx, wx + ww - 200, wy + 64, 150, 38, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Segoe UI';
  ctx.fillText('Export report', wx + ww - 178, wy + 88);

  // "Sensitive" row to pixelate
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '13px Consolas';
  ctx.fillText('api_key = sk-live-9f8e7d6c5b4a39281706f5e4d3c2b1a0', wx + 220, wy + 392);

  return c;
}

function smallSecondSnip(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 640, 360);
  grad.addColorStop(0, '#3d2a54');
  grad.addColorStop(1, '#1a1226');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 360);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 20px Segoe UI';
  ctx.fillText('Second capture', 240, 180);
  return c;
}

function loadCanvasAsTab(canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob!);
      const img = new Image();
      img.onload = () => {
        useEditorStore.getState().addTab(url, img.naturalWidth, img.naturalHeight, img);
        resolve();
      };
      img.src = url;
    }, 'image/png');
  });
}

let demoLoaded = false;

export async function maybeLoadDemo(): Promise<void> {
  if (!new URLSearchParams(location.search).has('demo')) return;
  if (demoLoaded) return; // StrictMode double-effect guard
  demoLoaded = true;

  await loadCanvasAsTab(smallSecondSnip());
  await loadCanvasAsTab(drawDemoWindow(1200, 700));

  const s = useEditorStore.getState();
  const red = '#ff3b30';
  s.addAnnotation({ id: nanoid(), type: 'rect', x: 990, y: 96, width: 174, height: 60, stroke: red, strokeWidth: 4 });
  s.addAnnotation({ id: nanoid(), type: 'arrow', points: [800, 250, 968, 140], stroke: red, strokeWidth: 4 });
  s.addAnnotation({ id: nanoid(), type: 'text', x: 660, y: 264, text: 'Export lives here', fontSize: 26, fill: red });
  s.addAnnotation({ id: nanoid(), type: 'badge', x: 110, y: 140, number: 1, fill: red, radius: 16 });
  s.addAnnotation({ id: nanoid(), type: 'badge', x: 110, y: 176, number: 2, fill: red, radius: 16 });
  s.addAnnotation({ id: nanoid(), type: 'highlight', points: [282, 196, 660, 196], stroke: '#ffe600', strokeWidth: 4 });
  s.addAnnotation({ id: nanoid(), type: 'shape', shape: 'star', x: 664, y: 160, width: 60, height: 60, stroke: '#ffcc00', strokeWidth: 4 });
  s.addAnnotation({ id: nanoid(), type: 'pixelate', x: 278, y: 412, width: 330, height: 28, pixelSize: 10 });
  s.setSelectedId(null);
}
