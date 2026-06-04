import { useCallback } from 'react';
import { useEditorStore } from './store/editorStore';
import { useScreenshot } from './hooks/useScreenshot';
import { useWatcherState } from './hooks/useWatcherState';
import { useSettingsListener } from './hooks/useSettingsListener';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { exportAnnotated } from './utils/exportPng';
import { TopBar } from './components/TopBar';
import { ToolRail } from './components/ToolRail';
import { EditorCanvas } from './components/EditorCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer, showToast } from './components/Toast';

function App() {
  const { screenshot, setView, view } = useEditorStore();

  useScreenshot();
  useWatcherState();
  useSettingsListener();

  const handleExport = useCallback(async () => {
    if (!screenshot.imageEl) return;
    try {
      const path = await exportAnnotated();
      if (path) {
        showToast(`Saved: ${path}`);
      } else {
        showToast('Copied to clipboard');
      }
    } catch (e) {
      showToast(`Export failed: ${String(e)}`, true);
    }
  }, [screenshot.imageEl]);

  useKeyboardShortcuts(handleExport);

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
      <TopBar onExport={handleExport} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ToolRail />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EditorCanvas />
          </div>
          <StatusBar onFit={handleFit} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
        </div>
        <PropertiesPanel />
      </div>
      <SettingsModal />
      <ToastContainer />
    </div>
  );
}

export default App;
