import { useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { ToolType } from '../types/annotations';

export function useKeyboardShortcuts(onCopy: () => Promise<void>, onSave: () => Promise<void>) {
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
    if (ctrl && e.key === 's') { e.preventDefault(); onSave(); return; }
    if (ctrl && e.key === 'c') { e.preventDefault(); onCopy(); return; }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); onCopy(); return; }
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
    if (ctrl && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      const { activeTabId, closeTab } = useEditorStore.getState();
      if (activeTabId) closeTab(activeTabId);
      return;
    }
    if (ctrl && e.key === 'Tab') {
      e.preventDefault();
      const { tabs, activeTabId, switchTab } = useEditorStore.getState();
      if (tabs.length < 2 || !activeTabId) return;
      const idx = tabs.findIndex((t) => t.id === activeTabId);
      const step = e.shiftKey ? -1 : 1;
      const next = tabs[(idx + step + tabs.length) % tabs.length];
      switchTab(next.id);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      // No hide-window fallthrough: mashing Esc must never close the app
      if (editingTextId) { setEditingTextId(null); return; }
      if (activeTool === 'crop' && cropRect) { setCropRect(null); return; }
      if (selectedId) { setSelectedId(null); return; }
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
      'v': 'select', 'r': 'rect', 'e': 'ellipse',
      'l': 'line', 'p': 'pen', 'h': 'highlight', 't': 'text',
      'b': 'badge', 'x': 'pixelate', 'c': 'crop', 'g': 'backdrop', 'o': 'spotlight',
      // Number row for the most-used tools (arrow lives on 3 only)
      '1': 'line', '2': 'rect', '3': 'arrow', '4': 'text', '5': 'pen',
    };
    if (!ctrl && toolMap[e.key.toLowerCase()]) {
      setTool(toolMap[e.key.toLowerCase()]);
    }
  }, [undo, redo, deleteSelected, setTool, activeTool, editingTextId, setEditingTextId, setCropRect, cropRect, setSelectedId, selectedId, onCopy, onSave]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
