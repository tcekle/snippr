import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useEditorStore, type SnipprSettings } from '../store/editorStore';

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

  const { cropRect } = store;
  const img = store.screenshot.imageEl;
  const rect = cropRect ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };

  const dataURL = stage.toDataURL({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    pixelRatio: 1,
    mimeType: 'image/png',
  });

  // Restore view
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
