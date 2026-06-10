import { useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from './store/editorStore';
import { useScreenshot } from './hooks/useScreenshot';
import { useImageImport } from './hooks/useImageImport';
import { useWatcherState } from './hooks/useWatcherState';
import { useSettingsListener } from './hooks/useSettingsListener';
import { usePaletteBootstrap } from './hooks/usePaletteBootstrap';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { copyAnnotated, saveAnnotatedAs, saveFlatAs } from './utils/exportPng';
import { openImageFile } from './utils/openFile';
import { TopBar } from './components/TopBar';
import { ToolRail } from './components/ToolRail';
import { EditorCanvas } from './components/EditorCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { LayersPanel } from './components/LayersPanel';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { TabsBar } from './components/TabsBar';
import { ToastContainer, showToast } from './components/Toast';

function App() {
  const { screenshot, setView, view } = useEditorStore();

  useScreenshot();
  useWatcherState();
  useSettingsListener();
  usePaletteBootstrap();
  const { isDragging } = useImageImport();

  // Listen for scrolling capture errors emitted by the Rust side
  useEffect(() => {
    const unlisten = listen<{ message: string }>('scroll-capture-error', (event) => {
      showToast(event.payload.message, true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Recording lifecycle results from the Rust side
  useEffect(() => {
    const unlistenSaved = listen<{ path: string; gif?: string | null }>('recording-saved', (event) => {
      const { path, gif } = event.payload;
      // Offer the Studio editor via an action button; path goes to open_studio, not the toast text
      showToast(gif ? 'Recording saved (+ GIF)' : 'Recording saved', {
        action: { label: 'Edit', run: () => { invoke('open_studio', { path }).catch((e) => showToast(String(e), true)); } },
      });
    });
    const unlistenError = listen<{ message: string }>('recording-error', (event) => {
      showToast(event.payload.message, true);
    });
    return () => {
      unlistenSaved.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, []);

  // Tray "Open image…" → run the file-open dialog in the WebView
  useEffect(() => {
    const unlisten = listen('open-file', () => { void openImageFile(); });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // README screenshot helper — only in dev, only with ?demo=1
  useEffect(() => {
    if (import.meta.env.DEV) {
      import('./utils/demoMode').then((m) => m.maybeLoadDemo());
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!screenshot.imageEl) return;
    try {
      await copyAnnotated();
      showToast('Copied to clipboard');
    } catch (e) {
      showToast(`Copy failed: ${String(e)}`, true);
    }
  }, [screenshot.imageEl]);

  const handleSave = useCallback(async () => {
    if (!screenshot.imageEl) return;
    try {
      const path = await saveAnnotatedAs();
      if (path) showToast(`Saved: ${path}`);
    } catch (e) {
      showToast(`Save failed: ${String(e)}`, true);
    }
  }, [screenshot.imageEl]);

  const handleSaveFlat = useCallback(async () => {
    if (!screenshot.imageEl) return;
    try {
      const path = await saveFlatAs();
      if (path) showToast(`Saved flat: ${path}`);
    } catch (e) {
      showToast(`Save failed: ${String(e)}`, true);
    }
  }, [screenshot.imageEl]);

  useKeyboardShortcuts(handleCopy, handleSave, handleSaveFlat);

  const handleFit = useCallback(() => {
    if (!screenshot.imageEl) return;
    // EditorCanvas owns the container size; bump fitNonce so its fit effect re-runs
    useEditorStore.getState().requestFit();
  }, [screenshot.imageEl]);

  const handleZoomIn = useCallback(() => {
    setView({ scale: Math.min(8, view.scale * 1.2) });
  }, [view.scale, setView]);

  const handleZoomOut = useCallback(() => {
    setView({ scale: Math.max(0.1, view.scale / 1.2) });
  }, [view.scale, setView]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      <TopBar onCopy={handleCopy} onSave={handleSave} onSaveFlat={handleSaveFlat} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ToolRail />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TabsBar />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EditorCanvas />
          </div>
          <StatusBar onFit={handleFit} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
        </div>
        <div style={{
          width: 220, display: 'flex', flexDirection: 'column',
          background: 'var(--color-elevated)', borderLeft: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <PropertiesPanel />
          <LayersPanel />
        </div>
      </div>
      {isDragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none',
          border: '3px dashed var(--color-accent)', background: 'rgba(0,120,212,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600,
            color: 'var(--color-text)',
          }}>
            Drop image to open
          </div>
        </div>
      )}
      <SettingsModal />
      <ToastContainer />
    </div>
  );
}

export default App;
