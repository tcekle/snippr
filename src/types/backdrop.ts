export type BackdropFill =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }; // degrees

export type FrameStyle = 'none' | 'macos' | 'windows' | 'browser';
export type AspectMode = 'auto' | '1:1' | '16:9' | '4:3';

export interface BackdropConfig {
  padding: number;       // uniform padding around the content, native px
  fill: BackdropFill;
  cornerRadius: number;  // screenshot corner radius, native px
  shadow: boolean;
  frame: FrameStyle;
  aspect: AspectMode;
}

export interface BackdropPreset { label: string; fill: BackdropFill; }

/** A named, file-backed beautify palette (see src-tauri/src/palettes.rs). */
export interface Palette { name: string; swatches: BackdropPreset[]; }

// Built-in fallback palette. No brand colors are bundled — the user's own
// palettes live as files in palettes/ beside the exe (see src-tauri/src/palettes.rs).
export const CLASSIC_BACKDROP_PRESETS: BackdropPreset[] = [
  { label: 'Sunset', fill: { kind: 'gradient', from: '#ffd5a8', to: '#a78bfa', angle: 135 } },
  { label: 'Ocean',  fill: { kind: 'gradient', from: '#0ea5e9', to: '#6366f1', angle: 135 } },
  { label: 'Mint',   fill: { kind: 'gradient', from: '#34d399', to: '#0ea5e9', angle: 135 } },
  { label: 'Slate',  fill: { kind: 'solid', color: '#1e1e28' } },
  { label: 'Light',  fill: { kind: 'solid', color: '#f1f1f4' } },
  { label: 'Coral',  fill: { kind: 'gradient', from: '#fb7185', to: '#f59e0b', angle: 135 } },
];

export const DEFAULT_BACKDROP: BackdropConfig = {
  padding: 64,
  fill: { kind: 'gradient', from: '#1e293b', to: '#0ea5e9', angle: 135 },
  cornerRadius: 14,
  shadow: true,
  frame: 'browser',
  aspect: '16:9',
};

export const FRAME_BAR_HEIGHT: Record<FrameStyle, number> = {
  none: 0, macos: 28, windows: 32, browser: 36,
};

// Render a backdrop fill as a CSS background value (swatches, previews).
export function fillToCss(f: BackdropFill): string {
  return f.kind === 'solid' ? f.color : `linear-gradient(${f.angle}deg, ${f.from}, ${f.to})`;
}

export function fillsEqual(a: BackdropFill, b: BackdropFill): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'solid' && b.kind === 'solid') return a.color === b.color;
  if (a.kind === 'gradient' && b.kind === 'gradient')
    return a.from === b.from && a.to === b.to && a.angle === b.angle;
  return false;
}
