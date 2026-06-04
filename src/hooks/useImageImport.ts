import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { addTabFromBlob } from '../utils/loadImageTab';
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
      addTabFromBlob(file).catch(() => showToast('Could not read pasted image', true));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
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
            const paths = p.paths.filter((path) => IMAGE_EXT.test(path));
            if (paths.length === 0) {
              showToast('Drop an image file (png, jpg, gif, bmp, webp)', true);
              return;
            }
            // Sequential: each load stores into the single pending slot and the
            // frontend drains it per snip-captured event before the next file.
            void (async () => {
              for (const path of paths) {
                try {
                  await invoke('load_image_file', { path });
                } catch (err) {
                  showToast(String(err), true);
                }
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
