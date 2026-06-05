import Konva from 'konva';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useEditorStore, type SnipprSettings } from '../store/editorStore';
import { backdropBounds } from './backdropGeometry';

const CANVAS_BG = '#181818'; // matches the editor canvas background

/** Base box (image, board page, or padded backdrop composition) grown to cover
 * annotations that spill past its edges. Requires the stage transform to be reset
 * to identity first (so getClientRect coords are in document space). */
function computeExportBounds(stage: Konva.Stage, base: { x: number; y: number; width: number; height: number }) {
  const annoLayer = stage.getLayers()[1];
  if (!annoLayer) return base;
  const a = annoLayer.getClientRect({ relativeTo: stage });
  if (a.width === 0 || a.height === 0) return base;
  const minX = Math.floor(Math.min(base.x, a.x));
  const minY = Math.floor(Math.min(base.y, a.y));
  const maxX = Math.ceil(Math.max(base.x + base.width, a.x + a.width));
  const maxY = Math.ceil(Math.max(base.y + base.height, a.y + a.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Flatten background + annotations to a native-resolution PNG (crop applied). */
function renderAnnotatedPng(): Uint8Array {
  const store = useEditorStore.getState();
  const stage = store.stageRef;
  const img = store.screenshot.imageEl;
  const isBoard = store.boardBackground !== null;
  if (!stage || (!img && !isBoard)) throw new Error('No stage or document');

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
  // Base rect comes from the image (screenshot) or the page size (board).
  const base = img
    ? { width: img.naturalWidth, height: img.naturalHeight }
    : { width: store.screenshot.width, height: store.screenshot.height };
  // Base box = the padded backdrop composition (if any) or the image/board page,
  // then grown to wrap annotations that spill outside it — matching the editor.
  // Explicit crop overrides everything. (A board never has a backdrop.)
  const baseRect = backdrop && img
    ? backdropBounds(img.naturalWidth, img.naturalHeight, backdrop)
    : { x: 0, y: 0, width: base.width, height: base.height };
  const rect = cropRect ? cropRect : computeExportBounds(stage, baseRect);

  // Background fill: a transparent board keeps alpha (no fill); any other board
  // fills with its color; a screenshot uses the existing canvas-gray backdrop so
  // out-of-image annotations don't sit on transparency (alpha is unreliable
  // through the Windows clipboard).
  const boardBg = store.boardBackground;
  const fillColor =
    boardBg === 'transparent' ? null :  // keep alpha
    boardBg ? boardBg :                 // board color
    CANVAS_BG;                          // screenshot: existing gray backdrop

  let bgRect: Konva.Rect | null = null;
  if (fillColor) {
    bgRect = new Konva.Rect({ ...rect, fill: fillColor, listening: false });
    const bgLayer = stage.getLayers()[0];
    bgLayer.add(bgRect);
    bgRect.moveToBottom();
    stage.batchDraw();
  }

  const dataURL = stage.toDataURL({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    pixelRatio: 1,
    mimeType: 'image/png',
  });

  // Restore view
  if (bgRect) bgRect.destroy();
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
