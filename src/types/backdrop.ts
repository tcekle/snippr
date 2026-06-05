export type BackdropFill =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }; // degrees

export type FrameStyle = 'none' | 'macos' | 'browser';
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

// Data I/O brand backdrops (from the corporate style guide).
export const BACKDROP_PRESETS: BackdropPreset[] = [
  { label: 'Navy',   fill: { kind: 'gradient', from: '#0A1628', to: '#054BAA', angle: 135 } }, // default
  { label: 'Blue',   fill: { kind: 'gradient', from: '#054BAA', to: '#4A90D9', angle: 135 } },
  { label: 'Teal',   fill: { kind: 'gradient', from: '#0891B2', to: '#4A90D9', angle: 135 } },
  { label: 'Violet', fill: { kind: 'gradient', from: '#6D28D9', to: '#4A90D9', angle: 135 } },
  { label: 'Dark',   fill: { kind: 'solid', color: '#0A1628' } },
  { label: 'Tint',   fill: { kind: 'solid', color: '#E8F0FC' } },
  { label: 'Paper',  fill: { kind: 'solid', color: '#F8F9FA' } },
  { label: 'Amber',  fill: { kind: 'gradient', from: '#FEB034', to: '#B35D00', angle: 135 } },
];

// The original snippr backdrop palette, kept alongside the brand presets.
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
  fill: BACKDROP_PRESETS[0].fill,
  cornerRadius: 14,
  shadow: true,
  frame: 'browser',
  aspect: '16:9',
};

export const FRAME_BAR_HEIGHT: Record<FrameStyle, number> = {
  none: 0, macos: 28, browser: 36,
};

export function fillsEqual(a: BackdropFill, b: BackdropFill): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'solid' && b.kind === 'solid') return a.color === b.color;
  if (a.kind === 'gradient' && b.kind === 'gradient')
    return a.from === b.from && a.to === b.to && a.angle === b.angle;
  return false;
}
