import { invoke } from '@tauri-apps/api/core';
import type { Palette } from '../types/backdrop';
import { useEditorStore } from '../store/editorStore';

// Thin wrappers over the Rust palette commands (files in palettes/ beside the
// exe). Every mutation is a real file op; refreshPalettes re-reads the folder
// into the store so the backdrop tool and the editor stay in sync with disk.

/** Reload palettes from disk into the store. No-op in a plain browser. */
export async function refreshPalettes(): Promise<void> {
  try {
    const list = await invoke<Palette[]>('list_palettes');
    useEditorStore.getState().setPalettes(list);
  } catch { /* plain browser / no backend */ }
}

export function savePalette(palette: Palette): Promise<void> {
  return invoke('save_palette', { palette });
}

export function deletePalette(name: string): Promise<void> {
  return invoke('delete_palette', { name });
}

export function importPalette(srcPath: string): Promise<Palette> {
  return invoke<Palette>('import_palette', { srcPath });
}

export function exportPalette(name: string, destPath: string): Promise<void> {
  return invoke('export_palette', { name, destPath });
}
