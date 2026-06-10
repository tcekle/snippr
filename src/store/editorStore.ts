import { create } from 'zustand';
import Konva from 'konva';
import { nanoid } from 'nanoid';
import type { Annotation, ToolType, CropRect } from '../types/annotations';
import type { BackdropConfig, Palette } from '../types/backdrop';
import { DEFAULT_BACKDROP } from '../types/backdrop';
import { DEFAULT_BOARD } from '../types/board';

export interface SnipprSettings {
  saveDirectory: string;
  autoSave: boolean;
  copyToClipboard: boolean;
  triggerOnAnyImage: boolean;
  autostart: boolean;
}

interface HistoryEntry {
  annotations: Annotation[];
  cropRect: CropRect | null;
  backdrop: BackdropConfig | null;
}

interface ScreenshotState {
  url: string | null;
  width: number;
  height: number;
  imageEl: HTMLImageElement | null;
  /** The exact bytes this image arrived as (snip/open/restore). Embedded verbatim
   * in editable-PNG export so the base isn't re-encoded (smaller + lossless). */
  originalBytes?: Uint8Array | null;
}

interface ViewState {
  scale: number;
  x: number;
  y: number;
}

/** Everything that belongs to one snip document (parked when its tab is inactive). */
interface DocSnapshot {
  screenshot: ScreenshotState;
  boardBackground: string | null;
  annotations: Annotation[];
  history: HistoryEntry[];
  future: HistoryEntry[];
  cropRect: CropRect | null;
  backdrop: BackdropConfig | null;
  view: ViewState;
}

export interface TabInfo {
  id: string;
  label: string;
  /** Parked document state; null for the active tab (its state lives in the flat fields). */
  doc: DocSnapshot | null;
}

const EMPTY_DOC = {
  screenshot: { url: null, width: 0, height: 0, imageEl: null } as ScreenshotState,
  boardBackground: null as string | null,
  annotations: [] as Annotation[],
  history: [] as HistoryEntry[],
  future: [] as HistoryEntry[],
  cropRect: null as DocSnapshot['cropRect'],
  backdrop: null as BackdropConfig | null,
  selectedId: null as string | null,
  editingTextId: null as string | null,
};

function snapshotActive(state: EditorState): DocSnapshot {
  return {
    screenshot: state.screenshot,
    boardBackground: state.boardBackground,
    annotations: state.annotations,
    history: state.history,
    future: state.future,
    cropRect: state.cropRect,
    backdrop: state.backdrop,
    view: state.view,
  };
}

/** Park the active tab's flat state back into its tab entry. */
function parkActive(state: EditorState): TabInfo[] {
  if (!state.activeTabId) return state.tabs;
  return state.tabs.map((t) =>
    t.id === state.activeTabId ? { ...t, doc: snapshotActive(state) } : t
  );
}

interface EditorState {
  screenshot: ScreenshotState;
  boardBackground: string | null;
  annotations: Annotation[];
  selectedId: string | null;
  history: HistoryEntry[];
  future: HistoryEntry[];
  cropRect: CropRect | null;
  /** Crop aspect-ratio lock (width/height) while the crop tool is active; null = free. Transient (not per-doc). */
  cropAspect: number | null;
  backdrop: BackdropConfig | null;
  activeTool: ToolType;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  editingTextId: string | null;
  view: ViewState;
  paused: boolean;
  settingsOpen: boolean;
  /** Named beautify palettes loaded from the palettes/ folder beside the exe. */
  palettes: Palette[];
  stageRef: Konva.Stage | null;
  /** Incremented to ask EditorCanvas (which owns container size) to re-fit the view. */
  fitNonce: number;
  tabs: TabInfo[];
  activeTabId: string | null;
  nextTabNum: number;
}

interface EditorActions {
  /** New snip arrives: park the current tab (if any) and open a fresh one. */
  addTab: (url: string, w: number, h: number, imageEl: HTMLImageElement, originalBytes?: Uint8Array | null) => void;
  /** Open a fresh blank board tab (no image; page size from opts or defaults). */
  newBoard: (opts?: { width?: number; height?: number; background?: string }) => void;
  setBoardBackground: (color: string) => void;
  setBoardSize: (width: number, height: number) => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  addAnnotation: (anno: Annotation) => void;
  updateAnnotation: (id: string, partial: Partial<Annotation>, pushHistory?: boolean) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  setTool: (tool: ToolType) => void;
  setView: (view: Partial<ViewState>) => void;
  setCropRect: (rect: CropRect | null) => void;
  setCropAspect: (ratio: number | null) => void;
  setBackdrop: (partial: Partial<BackdropConfig>, pushHistory?: boolean) => void;
  removeBackdrop: () => void;
  setSelectedId: (id: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  setPaused: (paused: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setPalettes: (palettes: Palette[]) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setStageRef: (ref: Konva.Stage | null) => void;
  pushHistory: () => void;
  requestFit: () => void;
  /** Select from the layers panel: switches to the select tool and targets the annotation. */
  selectAnnotation: (id: string) => void;
  deleteAnnotation: (id: string) => void;
}

const MAX_HISTORY = 100;

function pushHistoryEntry(state: EditorState): Pick<EditorState, 'history' | 'future'> {
  const entry: HistoryEntry = {
    annotations: [...state.annotations],
    cropRect: state.cropRect,
    backdrop: state.backdrop,
  };
  const history = [...state.history, entry].slice(-MAX_HISTORY);
  return { history, future: [] };
}

export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  screenshot: { url: null, width: 0, height: 0, imageEl: null },
  boardBackground: null,
  annotations: [],
  selectedId: null,
  history: [],
  future: [],
  cropRect: null,
  cropAspect: null,
  backdrop: null,
  activeTool: 'select',
  strokeColor: '#ff3b30',
  strokeWidth: 4,
  fontSize: 24,
  editingTextId: null,
  view: { scale: 1, x: 0, y: 0 },
  paused: false,
  settingsOpen: false,
  palettes: [],
  stageRef: null,
  fitNonce: 0,
  tabs: [],
  activeTabId: null,
  nextTabNum: 1,

  addTab: (url, w, h, imageEl, originalBytes) => {
    set((state) => {
      const tabs = parkActive(state);
      const id = nanoid();
      return {
        tabs: [...tabs, { id, label: `Snip ${state.nextTabNum}`, doc: null }],
        nextTabNum: state.nextTabNum + 1,
        activeTabId: id,
        ...EMPTY_DOC,
        screenshot: { url, width: w, height: h, imageEl, originalBytes: originalBytes ?? null },
      };
    });
  },

  newBoard: (opts) => {
    set((state) => {
      const tabs = parkActive(state);
      const id = nanoid();
      const width = opts?.width ?? DEFAULT_BOARD.width;
      const height = opts?.height ?? DEFAULT_BOARD.height;
      const background = opts?.background ?? DEFAULT_BOARD.background;
      return {
        tabs: [...tabs, { id, label: `Board ${state.nextTabNum}`, doc: null }],
        nextTabNum: state.nextTabNum + 1,
        activeTabId: id,
        ...EMPTY_DOC,
        screenshot: { url: null, width, height, imageEl: null },
        boardBackground: background,
        activeTool: 'pen',
        fitNonce: state.fitNonce + 1, // force re-fit (screenshot.url is null for both empty and board)
      };
    });
  },

  setBoardBackground: (color) => set({ boardBackground: color }),

  setBoardSize: (width, height) =>
    set((state) => ({ screenshot: { ...state.screenshot, width, height }, fitNonce: state.fitNonce + 1 })),

  switchTab: (id) => {
    set((state) => {
      if (id === state.activeTabId) return {};
      const target = state.tabs.find((t) => t.id === id);
      if (!target?.doc) return {};
      const doc = target.doc;
      const tabs = parkActive(state).map((t) => (t.id === id ? { ...t, doc: null } : t));
      return {
        tabs,
        activeTabId: id,
        ...doc,
        selectedId: null,
        editingTextId: null,
      };
    });
  },

  closeTab: (id) => {
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === id);
      if (idx < 0) return {};
      const closing = state.tabs[idx];
      const url = closing.doc ? closing.doc.screenshot.url
        : id === state.activeTabId ? state.screenshot.url : null;
      if (url) URL.revokeObjectURL(url);

      // Release image-layer blobs too (history copies share the same URLs)
      const annos = closing.doc ? closing.doc.annotations
        : id === state.activeTabId ? state.annotations : [];
      for (const a of annos) {
        if (a.type === 'image') URL.revokeObjectURL(a.src);
      }

      const tabs = state.tabs.filter((t) => t.id !== id);
      if (id !== state.activeTabId) return { tabs };

      // Closing the active tab: activate the right neighbor, else left, else empty state
      const neighbor = tabs[idx] ?? tabs[idx - 1];
      if (!neighbor?.doc) {
        return { tabs, activeTabId: null, ...EMPTY_DOC };
      }
      const doc = neighbor.doc;
      return {
        tabs: tabs.map((t) => (t.id === neighbor.id ? { ...t, doc: null } : t)),
        activeTabId: neighbor.id,
        ...doc,
        selectedId: null,
        editingTextId: null,
      };
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
        backdrop: state.backdrop,
      };
      return {
        history,
        future: [...state.future, futureEntry],
        annotations: entry.annotations,
        cropRect: entry.cropRect,
        backdrop: entry.backdrop,
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
        backdrop: state.backdrop,
      };
      return {
        future,
        history: [...state.history, histEntry],
        annotations: entry.annotations,
        cropRect: entry.cropRect,
        backdrop: entry.backdrop,
        selectedId: null,
      };
    });
  },

  setTool: (tool) => {
    set((state) => {
      // Crop and backdrop COMPOSE: the committed crop defines the content rect
      // and the backdrop wraps that. Entering either tool keeps the other's
      // state (crop → beautify is the device-mockup hero-shot workflow).
      let cropRect = state.cropRect;
      let backdrop = state.backdrop;
      if (tool === 'backdrop') {
        if (!backdrop) backdrop = DEFAULT_BACKDROP;
      } else if (tool === 'crop' && !cropRect && state.screenshot.imageEl) {
        // Lightroom-style: entering crop shows a full-image frame to adjust, not a blank draw.
        cropRect = { x: 0, y: 0, width: state.screenshot.width, height: state.screenshot.height };
      }
      return { activeTool: tool, selectedId: null, editingTextId: null, backdrop, cropRect };
    });
  },

  setView: (view) => {
    set((state) => ({ view: { ...state.view, ...view } }));
  },

  setCropRect: (rect) => {
    set({ cropRect: rect });
  },

  setCropAspect: (ratio) => {
    set({ cropAspect: ratio });
  },

  setBackdrop: (partial, pushHistory = true) => {
    set((state) => {
      const base = state.backdrop ?? DEFAULT_BACKDROP;
      const histSnap = pushHistory ? pushHistoryEntry(state) : {};
      // Crop survives: the committed crop is the content rect the backdrop
      // wraps (they compose; the old v1 mutual exclusion lived here).
      return {
        ...histSnap,
        backdrop: { ...base, ...partial },
      };
    });
  },

  removeBackdrop: () => {
    set((state) => ({ ...pushHistoryEntry(state), backdrop: null }));
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

  setPalettes: (palettes) => {
    set({ palettes });
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

  selectAnnotation: (id) => {
    set({ activeTool: 'select', selectedId: id, editingTextId: null });
  },

  deleteAnnotation: (id) => {
    set((state) => {
      const histSnap = pushHistoryEntry(state);
      return {
        ...histSnap,
        annotations: state.annotations.filter((a) => a.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
        editingTextId: state.editingTextId === id ? null : state.editingTextId,
      };
    });
  },
}));
