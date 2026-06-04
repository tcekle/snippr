import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../store/editorStore';

export async function exportAnnotated(): Promise<string | null> {
  const store = useEditorStore.getState();
  const stage = store.stageRef;
  if (!stage || !store.screenshot.imageEl) throw new Error('No stage or image');

  // Deselect
  store.setSelectedId(null);
  store.setEditingTextId(null);

  // Hide overlay layers (index 3 = overlay layer)
  const layers = stage.getLayers();
  const overlayLayer = layers[3];
  const inProgressLayer = layers[2];
  if (overlayLayer) overlayLayer.visible(false);
  if (inProgressLayer) inProgressLayer.visible(false);

  // Save view
  const savedView = { ...store.view };

  // Reset stage transform for export
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

  // Convert dataURL to Uint8Array
  const base64 = dataURL.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Pass bytes DIRECTLY as the args parameter (Tauri v2 raw invoke)
  const result = await invoke<string | null>('export_annotated', bytes);
  return result;
}
