import { useEditorStore } from '../store/editorStore';

/** Decode an image blob and open it as a new editor tab. */
export function addTabFromBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      useEditorStore.getState().addTab(url, img.naturalWidth, img.naturalHeight, img);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not a decodable image'));
    };
    img.src = url;
  });
}
