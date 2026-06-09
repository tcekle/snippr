import { useEffect } from 'react';
import { refreshPalettes } from '../utils/paletteApi';

/** Load the named palettes from palettes/ at launch so the backdrop tool has them. */
export function usePaletteBootstrap() {
  useEffect(() => { void refreshPalettes(); }, []);
}
