import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { addTabFromBlob } from './loadImageTab';
import { useEditorStore } from '../store/editorStore';
import { showToast } from '../components/Toast';

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
/** MF-native containers only: playback uses WebView2 but trim/export decodes
 *  through a Media Foundation SourceReader, so webm etc. would fail at export. */
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v'];

export function isVideoPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.includes(ext);
}

/** Open a recording in an embedded Studio tab. `open_video` grants the asset
 *  protocol access to exactly this file so the <video> tag can stream it. */
export async function openVideoPath(path: string): Promise<void> {
  try {
    await invoke('open_video', { path });
    useEditorStore.getState().addVideoTab(path);
  } catch (e) {
    showToast(`Open failed: ${String(e)}`, true);
  }
}

/** File → Open: pick an image (including snippr-embedded editable PNGs) or a
 *  recording. A scene-bearing PNG restores as an editable tab, other images
 *  open flat, and videos open in a Studio tab. `read_image_file` returns PNG
 *  bytes untouched for PNG inputs, so the embedded `snIp` chunk survives. */
export async function openMediaFile(): Promise<void> {
  try {
    const path = await open({
      multiple: false,
      filters: [
        { name: 'All supported', extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] },
        { name: 'Images', extensions: IMAGE_EXTENSIONS },
        { name: 'Videos', extensions: VIDEO_EXTENSIONS },
      ],
    });
    if (!path || typeof path !== 'string') return;
    if (isVideoPath(path)) {
      await openVideoPath(path);
      return;
    }
    const buf = await invoke<ArrayBuffer>('read_image_file', { path });
    await addTabFromBlob(new Blob([buf], { type: 'image/png' }));
  } catch (e) {
    showToast(`Open failed: ${String(e)}`, true);
  }
}
