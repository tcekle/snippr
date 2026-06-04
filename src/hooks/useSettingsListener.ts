import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '../store/editorStore';

export function useSettingsListener() {
  const setSettingsOpen = useEditorStore((s) => s.setSettingsOpen);

  useEffect(() => {
    const unlisten = listen('open-settings', () => {
      setSettingsOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
