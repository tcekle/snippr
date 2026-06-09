import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../store/editorStore';
import type { SnipprSettings } from '../store/editorStore';

/** On launch, pull persisted settings and apply the saved beautify palette so the
 *  backdrop panel reflects the user's customizations (else the built-in seed). */
export function useSettingsBootstrap() {
  const setBrandPalette = useEditorStore((s) => s.setBrandPalette);
  useEffect(() => {
    invoke<SnipprSettings>('get_settings')
      .then((s) => {
        if (Array.isArray(s.backdropPalette) && s.backdropPalette.length > 0) {
          setBrandPalette(s.backdropPalette);
        }
      })
      .catch(() => { /* plain browser / no backend — keep the seed */ });
  }, [setBrandPalette]);
}
