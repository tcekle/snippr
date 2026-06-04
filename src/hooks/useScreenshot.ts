import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { addTabFromBlob } from '../utils/loadImageTab';

export function useScreenshot() {
  async function loadPendingImage() {
    try {
      const buf = await invoke<ArrayBuffer>('get_pending_image');
      if (!buf || buf.byteLength === 0) return;
      await addTabFromBlob(new Blob([buf], { type: 'image/png' }));
    } catch (e) {
      console.error('Failed to load pending image', e);
    }
  }

  useEffect(() => {
    const unlisten = listen<{ width: number; height: number }>('snip-captured', (_event) => {
      loadPendingImage();
    });
    // Drain any image captured before this listener attached (cold start / dev reload).
    loadPendingImage();
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
