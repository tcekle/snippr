import Konva from 'konva';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useEditorStore, type SnipprSettings } from '../store/editorStore';
import { backdropBounds } from './backdropGeometry';

const CANVAS_BG = '#181818'; // matches the editor canvas background

/** Image rect grown to cover annotations that spill past the screenshot edges.
 * Requires the stage transform to be reset to identity first. */
function computeExportBounds(stage: Konva.Stage, img: HTMLImageElement) {
  const imgRect = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
  const annoLayer = stage.getLayers()[1];
  if (!annoLayer) return imgRect;
  const a = annoLayer.getClientRect({ relativeTo: stage });
  if (a.width === 0 || a.height === 0) return imgRect;
  const minX = Math.floor(Math.min(0, a.x));
  const minY = Math.floor(Math.min(0, a.y));
  const maxX = Math.ceil(Math.max(imgRect.width, a.x + a.width));
  const maxY = Math.ceil(Math.max(imgRect.height, a.y + a.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Flatten background + annotations to a native-resolution PNG (crop applied). */
function renderAnnotatedPng(): Uint8Array {
  const store = useEditorStore.getState();
  const stage = store.stageRef;
  if (!stage || !store.screenshot.imageEl) throw new Error('No stage or image');

  // Deselect
  store.setSelectedId(null);
  store.setEditingTextId(null);

  // Hide overlay layers (2 = in-progress, 3 = overlay/transformer)
  const layers = stage.getLayers();
  const overlayLayer = layers[3];
  const inProgressLayer = layers[2];
  if (overlayLayer) overlayLayer.visible(false);
  if (inProgressLayer) inProgressLayer.visible(false);

  // Save view, reset transform so export is in native pixels
  const savedView = { ...store.view };
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();

  const { cropRect, backdrop } = store;
  const img = store.screenshot.imageEl;
  // Explicit crop wins; a backdrop sets the padded composition bounds (negative
  // origin, captured correctly post-transform-reset); otherwise grow to include
  // annotations outside the image.
  const rect = cropRect
    ? cropRect
    : backdrop
      ? backdropBounds(img.naturalWidth, img.naturalHeight, backdrop)
      : computeExportBounds(stage, img);

  // Solid canvas-colored backdrop so out-of-image annotations don't sit on
  // transparency (alpha is unreliable through the Windows clipboard)
  const bg = new Konva.Rect({ ...rect, fill: CANVAS_BG, listening: false });
  const bgLayer = stage.getLayers()[0];
  bgLayer.add(bg);
  bg.moveToBottom();
  stage.batchDraw();

  const dataURL = stage.toDataURL({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    pixelRatio: 1,
    mimeType: 'image/png',
  });

  // Restore view
  bg.destroy();
  stage.scale({ x: savedView.scale, y: savedView.scale });
  stage.position({ x: savedView.x, y: savedView.y });
  if (overlayLayer) overlayLayer.visible(true);
  if (inProgressLayer) inProgressLayer.visible(true);
  stage.batchDraw();

  // dataURL → bytes
  const base64 = dataURL.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Copy the annotated image to the clipboard. Window stays open. */
export async function copyAnnotated(): Promise<void> {
  const bytes = renderAnnotatedPng();
  await invoke('copy_annotated', bytes);
}

function timestamp(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Save the annotated image via a Save As dialog. Returns the path, or null if cancelled. */
export async function saveAnnotatedAs(): Promise<string | null> {
  const bytes = renderAnnotatedPng();
  const settings = await invoke<SnipprSettings>('get_settings');
  const target = await save({
    defaultPath: `${settings.saveDirectory}\\snippr_${timestamp()}.png`,
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
  if (!target) return null;
  return await invoke<string>('save_annotated', bytes, {
    headers: { 'save-path': encodeURIComponent(target) },
  });
}
