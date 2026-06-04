import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '../store/editorStore';

export function useWatcherState() {
  const setPaused = useEditorStore((s) => s.setPaused);

  useEffect(() => {
    const unlisten = listen<{ paused: boolean }>('watcher-state', (event) => {
      setPaused(event.payload.paused);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
