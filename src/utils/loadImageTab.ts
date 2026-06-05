import { nanoid } from 'nanoid';
import { useEditorStore } from '../store/editorStore';
import { openSceneFromPng } from './sceneRestore';

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function decodeBlob(blob: Blob): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not a decodable image'));
    };
    img.src = url;
  });
}

/** Decode an image blob and open it as a new editor tab. A snippr-embedded PNG
 * restores as a fully editable scene; anything else opens as a flat background. */
export async function addTabFromBlob(blob: Blob): Promise<void> {
  const bytes = await blobBytes(blob);
  if (await openSceneFromPng(bytes)) return;
  const { url, img } = await decodeBlob(blob);
  // Keep the exact source bytes so an editable-PNG save embeds them verbatim
  // (no canvas re-encode → smaller file, lossless base).
  useEditorStore.getState().addTab(url, img.naturalWidth, img.naturalHeight, img, bytes);
}

/** Import an image the user pasted or dropped: it becomes the background of a
 * new tab when nothing is open, otherwise an image layer on the active doc.
 * A scene-bearing PNG always opens as its own editable document (not a layer). */
export async function importImageBlob(blob: Blob): Promise<void> {
  const s = useEditorStore.getState();
  if (await openSceneFromPng(await blobBytes(blob))) return;
  if (!s.screenshot.imageEl) return addTabFromBlob(blob);

  const { url, img } = await decodeBlob(blob);
  // Center on the background, scaled down to at most 80% of it.
  const scale = Math.min(
    1,
    (s.screenshot.width * 0.8) / img.naturalWidth,
    (s.screenshot.height * 0.8) / img.naturalHeight,
  );
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const id = nanoid();
  s.addAnnotation({
    id,
    type: 'image',
    x: Math.round((s.screenshot.width - width) / 2),
    y: Math.round((s.screenshot.height - height) / 2),
    width,
    height,
    imageEl: img,
    src: url,
  });
  s.selectAnnotation(id);
}
