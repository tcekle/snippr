// Dev-only demo mode for README screenshots: `http://localhost:1420/?demo=1`
// Generates a fake app-window "screenshot" and loads it with sample annotations.
import { nanoid } from 'nanoid';
import { useEditorStore } from '../store/editorStore';
import type { FrameStyle } from '../types/backdrop';

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
  const params = new URLSearchParams(location.search);
  const red = '#ff3b30';

  if (params.has('sketch')) {
    // `?demo=1&sketch=1` — the hand-drawn set: a marker ring on the target, a
    // sweeping leader instead of a straight arrow, and a hand-lettered label.
    const amber = '#ce7a1a';
    s.addAnnotation({ id: nanoid(), type: 'ellipse', x: 1077, y: 126, radiusX: 105, radiusY: 42, stroke: amber, strokeWidth: 4, sketch: true, seed: 21 });
    s.addAnnotation({ id: nanoid(), type: 'arrow', points: [720, 268, 962, 150], stroke: amber, strokeWidth: 4, sketch: true, seed: 8, curve: 0.24 });
    s.addAnnotation({ id: nanoid(), type: 'text', x: 300, y: 250, text: 'Writes a PDF; it does not email it', fontSize: 30, fill: amber, fontFamily: 'Kalam' });
    s.addAnnotation({ id: nanoid(), type: 'badge', x: 110, y: 140, number: 1, fill: amber, radius: 18, sketch: true, seed: 44 });
    s.addAnnotation({ id: nanoid(), type: 'badge', x: 110, y: 176, number: 2, fill: amber, radius: 18, sketch: true, seed: 91 });
    s.addAnnotation({ id: nanoid(), type: 'rect', x: 278, y: 404, width: 336, height: 40, stroke: amber, strokeWidth: 3, sketch: true, seed: 63 });
  } else {
    s.addAnnotation({ id: nanoid(), type: 'rect', x: 990, y: 96, width: 174, height: 60, stroke: red, strokeWidth: 4 });
    s.addAnnotation({ id: nanoid(), type: 'arrow', points: [800, 250, 968, 140], stroke: red, strokeWidth: 4 });
    s.addAnnotation({ id: nanoid(), type: 'text', x: 660, y: 264, text: 'Export lives here', fontSize: 26, fill: red });
    s.addAnnotation({ id: nanoid(), type: 'badge', x: 110, y: 140, number: 1, fill: red, radius: 16 });
    s.addAnnotation({ id: nanoid(), type: 'badge', x: 110, y: 176, number: 2, fill: red, radius: 16 });
    s.addAnnotation({ id: nanoid(), type: 'highlight', points: [282, 196, 660, 196], stroke: '#ffe600', strokeWidth: 4 });
    s.addAnnotation({ id: nanoid(), type: 'shape', shape: 'star', x: 664, y: 160, width: 60, height: 60, stroke: '#ffcc00', strokeWidth: 4 });
    s.addAnnotation({ id: nanoid(), type: 'pixelate', x: 278, y: 412, width: 330, height: 28, pixelSize: 10 });
  }
  s.setSelectedId(null);

  // `?demo=1&backdrop=1` also turns the Beautify backdrop on (default config)
  // and selects the Backdrop tool so its panel section is visible.
  // `&frame=none|macos|windows|browser|laptop|phone` overrides the frame style;
  // `&tilt=1` adds the perspective lean (device mockup look).
  if (params.has('backdrop')) {
    const frames = ['none', 'macos', 'windows', 'browser', 'laptop', 'phone'];
    const f = params.get('frame');
    s.setBackdrop({
      ...(f && frames.includes(f) ? { frame: f as FrameStyle } : {}),
      ...(params.has('tilt') ? { tilt: true } : {}),
    });
    s.setTool('backdrop');
  }

  // `?demo=1&crop=1` commits a center crop (composes with `&backdrop=1`);
  // `&croprot=N` adds a straighten angle in degrees; `&croptool=1` re-enters
  // the crop tool so the adjusting (uncommitted) state is visible.
  if (params.has('crop')) {
    const rot = Number(params.get('croprot') ?? 0);
    s.setCropRect({ x: 140, y: 90, width: 760, height: 470, ...(rot ? { rotation: rot } : {}) });
    if (params.has('croptool')) s.setTool('crop');
    s.requestFit();
  }

  // `?demo=1&zoom=1` drops a Magnifier loupe over a chart detail (circular lens,
  // white border + shadow, dashed source outline + connector) and selects the tool.
  if (params.has('zoom')) {
    s.addAnnotation({
      id: nanoid(), type: 'loupe',
      srcX: 500, srcY: 540, size: 120,
      x: 404, y: 684, zoom: 2.6, shape: 'circle',
      borderColor: '#ffffff', borderWidth: 3,
      showSource: true, connector: true,
    });
    s.setTool('loupe');
    s.requestFit();
  }

  // `?demo=1&video=1` opens an embedded Studio tab on a fake path — outside
  // Tauri the video can't load, but the tab routing + shell layout render.
  if (params.has('video')) {
    s.addVideoTab('C:\\demo\\snippr_recording.mp4');
  }

  // `?demo=1&board=1` opens a blank whiteboard with a small diagram, where one note
  // spills past the right edge of the page — the white page auto-grows around it.
  if (params.has('board')) {
    s.newBoard({ width: 1600, height: 900, background: '#ffffff' });
    const ink = '#1e1e28';
    s.addAnnotation({ id: nanoid(), type: 'text', x: 130, y: 90, text: 'Release plan', fontSize: 46, fill: ink });
    s.addAnnotation({ id: nanoid(), type: 'rect', x: 150, y: 240, width: 300, height: 140, stroke: '#007aff', strokeWidth: 5 });
    s.addAnnotation({ id: nanoid(), type: 'text', x: 205, y: 295, text: 'Design', fontSize: 32, fill: ink });
    s.addAnnotation({ id: nanoid(), type: 'arrow', points: [470, 310, 700, 310], stroke: ink, strokeWidth: 5 });
    s.addAnnotation({ id: nanoid(), type: 'rect', x: 720, y: 240, width: 300, height: 140, stroke: '#34c759', strokeWidth: 5 });
    s.addAnnotation({ id: nanoid(), type: 'text', x: 790, y: 295, text: 'Build', fontSize: 32, fill: ink });
    // Spills past the 1600px page edge → page grows to wrap it.
    s.addAnnotation({ id: nanoid(), type: 'rect', x: 1460, y: 360, width: 360, height: 210, stroke: '#ff3b30', strokeWidth: 6 });
    s.addAnnotation({ id: nanoid(), type: 'text', x: 1500, y: 440, text: 'Ships outside!', fontSize: 30, fill: '#ff3b30' });
    s.setTool('select');
    s.setSelectedId(null);
    s.requestFit();
  }
}
