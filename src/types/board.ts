export const DEFAULT_BOARD = { width: 1600, height: 900, background: '#ffffff' };

export interface BoardBg { label: string; value: string; }

/** 'transparent' exports with alpha; the panel shows a checkerboard swatch. */
export const BOARD_BACKGROUNDS: BoardBg[] = [
  { label: 'White',       value: '#ffffff' },
  { label: 'Light',       value: '#f1f1f4' },
  { label: 'Dark',        value: '#1e1e28' },
  { label: 'Black',       value: '#0c0c10' },
  { label: 'Transparent', value: 'transparent' },
];

export interface SizePreset { label: string; width: number; height: number; }
export const BOARD_SIZES: SizePreset[] = [
  { label: '16:9', width: 1600, height: 900 },
  { label: '1:1',  width: 1200, height: 1200 },
  { label: 'Page', width: 1240, height: 1754 },
];
