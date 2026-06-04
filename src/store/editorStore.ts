import { create } from 'zustand';
import Konva from 'konva';
import type { Annotation, ToolType } from '../types/annotations';

export interface SnipprSettings {
  saveDirectory: string;
  autoSave: boolean;
  copyToClipboard: boolean;
  triggerOnAnyImage: boolean;
  autostart: boolean;
}

interface HistoryEntry {
  annotations: Annotation[];
  cropRect: { x: number; y: number; width: number; height: number } | null;
}

interface ScreenshotState {
  url: string | null;
  width: number;
  height: number;
  imageEl: HTMLImageElement | null;
}

interface ViewState {
  scale: number;
  x: number;
  y: number;
}

interface EditorState {
  screenshot: ScreenshotState;
  annotations: Annotation[];
  selectedId: string | null;
  history: HistoryEntry[];
  future: HistoryEntry[];
  cropRect: { x: number; y: number; width: number; height: number } | null;
  activeTool: ToolType;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  nextBadge: number;
  editingTextId: string | null;
  view: ViewState;
  paused: boolean;
  settingsOpen: boolean;
  stageRef: Konva.Stage | null;
  /** Incremented to ask EditorCanvas (which owns container size) to re-fit the view. */
  fitNonce: number;
}

interface EditorActions {
  setScreenshot: (url: string, w: number, h: number, imageEl: HTMLImageElement) => void;
  addAnnotation: (anno: Annotation) => void;
  updateAnnotation: (id: string, partial: Partial<Annotation>, pushHistory?: boolean) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  setTool: (tool: ToolType) => void;
  setView: (view: Partial<ViewState>) => void;
  setCropRect: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  setSelectedId: (id: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  setPaused: (paused: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setStageRef: (ref: Konva.Stage | null) => void;
  pushHistory: () => void;
  requestFit: () => void;
}

const MAX_HISTORY = 100;

function pushHistoryEntry(state: EditorState): Pick<EditorState, 'history' | 'future'> {
  const entry: HistoryEntry = {
    annotations: [...state.annotations],
    cropRect: state.cropRect,
  };
  const history = [...state.history, entry].slice(-MAX_HISTORY);
  return { history, future: [] };
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  screenshot: { url: null, width: 0, height: 0, imageEl: null },
  annotations: [],
  selectedId: null,
  history: [],
  future: [],
  cropRect: null,
  activeTool: 'select',
  strokeColor: '#ff3b30',
  strokeWidth: 4,
  fontSize: 24,
  nextBadge: 1,
  editingTextId: null,
  view: { scale: 1, x: 0, y: 0 },
  paused: false,
  settingsOpen: false,
  stageRef: null,
  fitNonce: 0,

  setScreenshot: (url, w, h, imageEl) => {
    const prev = get().screenshot;
    if (prev.url && prev.url !== url) {
      URL.revokeObjectURL(prev.url);
    }
    set({
      screenshot: { url, width: w, height: h, imageEl },
      annotations: [],
      history: [],
      future: [],
      cropRect: null,
      nextBadge: 1,
      selectedId: null,
      editingTextId: null,
    });
  },

  pushHistory: () => {
    set((state) => pushHistoryEntry(state));
  },

  addAnnotation: (anno) => {
    set((state) => {
      const histSnap = pushHistoryEntry(state);
      return {
        ...histSnap,
        annotations: [...state.annotations, anno],
      };
    });
  },

  updateAnnotation: (id, partial, pushHistoryFlag = false) => {
    set((state) => {
      const idx = state.annotations.findIndex((a) => a.id === id);
      if (idx < 0) return {};
      const updated = { ...state.annotations[idx], ...partial } as Annotation;
      const annotations = [...state.annotations];
      annotations[idx] = updated;
      const histSnap = pushHistoryFlag ? pushHistoryEntry(state) : {};
      return { ...histSnap, annotations };
    });
  },

  deleteSelected: () => {
    set((state) => {
      if (!state.selectedId) return {};
      const histSnap = pushHistoryEntry(state);
      return {
        ...histSnap,
        annotations: state.annotations.filter((a) => a.id !== state.selectedId),
        selectedId: null,
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.history.length === 0) return {};
      const history = [...state.history];
      const entry = history.pop()!;
      const futureEntry: HistoryEntry = {
        annotations: [...state.annotations],
        cropRect: state.cropRect,
      };
      return {
        history,
        future: [...state.future, futureEntry],
        annotations: entry.annotations,
        cropRect: entry.cropRect,
        selectedId: null,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return {};
      const future = [...state.future];
      const entry = future.pop()!;
      const histEntry: HistoryEntry = {
        annotations: [...state.annotations],
        cropRect: state.cropRect,
      };
      return {
        future,
        history: [...state.history, histEntry],
        annotations: entry.annotations,
        cropRect: entry.cropRect,
        selectedId: null,
      };
    });
  },

  setTool: (tool) => {
    set({ activeTool: tool, selectedId: null, editingTextId: null });
  },

  setView: (view) => {
    set((state) => ({ view: { ...state.view, ...view } }));
  },

  setCropRect: (rect) => {
    set({ cropRect: rect });
  },

  setSelectedId: (id) => {
    set({ selectedId: id });
  },

  setEditingTextId: (id) => {
    set({ editingTextId: id });
  },

  setPaused: (paused) => {
    set({ paused });
  },

  setSettingsOpen: (open) => {
    set({ settingsOpen: open });
  },

  setStrokeColor: (color) => {
    set({ strokeColor: color });
  },

  setStrokeWidth: (width) => {
    set({ strokeWidth: width });
  },

  setFontSize: (size) => {
    set({ fontSize: size });
  },

  setStageRef: (ref) => {
    set({ stageRef: ref });
  },

  requestFit: () => {
    set((state) => ({ fitNonce: state.fitNonce + 1 }));
  },
}));
