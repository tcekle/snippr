import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { addTabFromBlob } from './loadImageTab';
import { showToast } from '../components/Toast';

/** File → Open: pick an image (including snippr-embedded editable PNGs) and open
 *  it. A scene-bearing PNG restores as an editable tab; anything else opens flat.
 *  `read_image_file` returns PNG bytes untouched for PNG inputs, so the embedded
 *  `snIp` chunk survives the round trip. */
export async function openImageFile(): Promise<void> {
  try {
    const path = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }],
    });
    if (!path || typeof path !== 'string') return;
    const buf = await invoke<ArrayBuffer>('read_image_file', { path });
    await addTabFromBlob(new Blob([buf], { type: 'image/png' }));
  } catch (e) {
    showToast(`Open failed: ${String(e)}`, true);
  }
}
