import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../store/editorStore';
import type { ToolType } from '../types/annotations';

export function useKeyboardShortcuts(onExport: () => Promise<void>) {
  const {
    undo, redo, deleteSelected, setTool, activeTool,
    editingTextId, setEditingTextId, setCropRect, cropRect,
    setSelectedId, selectedId,
  } = useEditorStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return; }
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
    if (ctrl && e.key === 's') { e.preventDefault(); onExport(); return; }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); onExport(); return; }
    if (ctrl && e.key === '0') { e.preventDefault(); useEditorStore.getState().requestFit(); return; }
    if (ctrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      const { view } = useEditorStore.getState();
      useEditorStore.getState().setView({ scale: Math.min(8, view.scale * 1.2) });
      return;
    }
    if (ctrl && e.key === '-') {
      e.preventDefault();
      const { view } = useEditorStore.getState();
      useEditorStore.getState().setView({ scale: Math.max(0.1, view.scale / 1.2) });
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (editingTextId) { setEditingTextId(null); return; }
      if (activeTool === 'crop' && cropRect) { setCropRect(null); return; }
      if (selectedId) { setSelectedId(null); return; }
      invoke('hide_window').catch(console.error);
      return;
    }

    if (e.key === 'Enter' && activeTool === 'crop') {
      e.preventDefault();
      setTool('select');
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
      return;
    }

    const toolMap: Record<string, ToolType> = {
      'v': 'select', 'r': 'rect', 'e': 'ellipse', 'a': 'arrow',
      'l': 'line', 'p': 'pen', 'h': 'highlight', 't': 'text',
      'b': 'badge', 'x': 'pixelate', 'c': 'crop',
    };
    if (!ctrl && toolMap[e.key.toLowerCase()]) {
      setTool(toolMap[e.key.toLowerCase()]);
    }
  }, [undo, redo, deleteSelected, setTool, activeTool, editingTextId, setEditingTextId, setCropRect, cropRect, setSelectedId, selectedId, onExport]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
