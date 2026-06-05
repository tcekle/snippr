// Reopen an editable PNG: detect the embedded `snIp` scene, rebuild the base
// image + ImageAnno bitmaps from its blobs, and restore a fully editable tab
// (annotations, backdrop, crop, board background). Pure browser APIs — no Tauri.
import { useEditorStore } from '../store/editorStore';
import {
  extractSnipChunk,
  parseContainer,
  SCENE_VERSION,
  type SceneContainer,
  type SerialAnnotation,
} from './sceneEmbed';
import type { Annotation } from '../types/annotations';

function blobToImage(
  bytes: Uint8Array,
  mime = 'image/png',
): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

/** Rebuild ImageAnno runtime fields (imageEl/src) from container blobs. A layer
 *  whose blob is missing is dropped rather than failing the whole open. */
async function rehydrateAnnotations(
  serial: SerialAnnotation[],
  c: SceneContainer,
): Promise<Annotation[]> {
  const out: Annotation[] = [];
  for (const a of serial) {
    if (a.type === 'image') {
      const bytes = c.blobs.get(a.blobRef);
      if (!bytes) continue;
      const { url, img } = await blobToImage(bytes);
      out.push({ id: a.id, type: 'image', x: a.x, y: a.y, width: a.width, height: a.height, imageEl: img, src: url });
    } else {
      out.push(a as Annotation);
    }
  }
  return out;
}

/** Open a snippr-embedded PNG as a fully editable tab. Returns false when the
 *  bytes carry no valid/restorable scene (caller falls back to a flat open). */
export async function openSceneFromPng(png: Uint8Array): Promise<boolean> {
  const data = extractSnipChunk(png);
  if (!data) return false;
  let container: SceneContainer | null = null;
  try {
    container = parseContainer(data);
  } catch {
    return false; // malformed manifest → flat fallback
  }
  if (!container) return false;
  const m = container.manifest;
  // Forward-compat: a newer schema we can't fully understand → flat fallback.
  if (m.app !== 'snippr' || m.version > SCENE_VERSION) return false;

  const annotations = await rehydrateAnnotations(m.annotations, container);
  const store = useEditorStore.getState();

  if (m.kind === 'board' || !m.baseRef) {
    store.newBoard({
      width: m.doc.width,
      height: m.doc.height,
      background: m.boardBackground ?? undefined,
    });
  } else {
    const baseBytes = container.blobs.get(m.baseRef);
    if (!baseBytes) return false; // base image missing → can't restore image doc
    const { url, img } = await blobToImage(baseBytes);
    store.addTab(url, img.naturalWidth, img.naturalHeight, img);
  }

  // addTab/newBoard created a clean tab (EMPTY_DOC); patch in the restored state.
  useEditorStore.setState({
    annotations,
    backdrop: m.backdrop,
    cropRect: m.cropRect,
    boardBackground: m.boardBackground,
    history: [],
    future: [],
    selectedId: null,
    editingTextId: null,
  });
  store.requestFit();
  return true;
}
