import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { importImageBlob } from '../utils/loadImageTab';
import { isVideoPath, openVideoPath } from '../utils/openFile';
import { showToast } from '../components/Toast';

const IMAGE_EXT = /\.(png|jpe?g|gif|bmp|webp)$/i;

/** Open existing images in the editor: paste (Ctrl+V) and OS file drag-and-drop.
 * Returns whether a drag is currently hovering the window (for drop feedback). */
export function useImageImport() {
  const [isDragging, setIsDragging] = useState(false);

  // Paste: the browser delivers both raw clipboard image data and copied image files.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      importImageBlob(file).catch(() => showToast('Could not read pasted image', true));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  // "Add screenshot" region capture: Rust parks the PNG in the pending slot
  // and emits snapshot-captured; route it through the same import logic as
  // paste/drop (image layer on the current doc, or a new tab's background).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('snapshot-captured', async () => {
          try {
            const buf = await invoke<ArrayBuffer>('get_pending_image');
            if (buf.byteLength === 0) return;
            await importImageBlob(new Blob([buf], { type: 'image/png' }));
          } catch (err) {
            showToast(String(err), true);
          }
        });
        if (disposed) unlisten();
      } catch {
        /* plain-browser dev (README screenshots) — no Tauri */
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // OS file drops arrive via Tauri's drag-drop event, not HTML5 drop events.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          const p = event.payload;
          if (p.type === 'enter') setIsDragging(true);
          else if (p.type === 'leave') setIsDragging(false);
          else if (p.type === 'drop') {
            setIsDragging(false);
            const images = p.paths.filter((path) => IMAGE_EXT.test(path));
            const videos = p.paths.filter(isVideoPath);
            if (images.length === 0 && videos.length === 0) {
              showToast('Drop an image (png, jpg, gif, bmp, webp) or video (mp4, mov, m4v)', true);
              return;
            }
            // Sequential so the first image can become the background and the
            // rest land as layers on top of it. Videos each open a Studio tab.
            void (async () => {
              for (const path of images) {
                try {
                  const buf = await invoke<ArrayBuffer>('read_image_file', { path });
                  await importImageBlob(new Blob([buf], { type: 'image/png' }));
                } catch (err) {
                  showToast(String(err), true);
                }
              }
              for (const path of videos) {
                await openVideoPath(path);
              }
            })();
          }
        });
        if (disposed) unlisten();
      } catch {
        /* plain-browser dev (README screenshots) — no Tauri */
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return { isDragging };
}
