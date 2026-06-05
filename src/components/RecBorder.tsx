import { useEffect } from 'react';

/**
 * Recording outline window (label `rec-border`).
 *
 * The Rust side creates a transparent, always-on-top, click-through window
 * sized to the capture rect inflated by 3px and positioned at
 * (rect.x - 3, rect.y - 3). We paint a 3px hollow red ring at the window
 * edges; because of that inflation the ring lands just OUTSIDE the captured
 * pixels, so the outline itself is never recorded. Purely visual — nothing
 * interactive, no Tauri invokes.
 */
export function RecBorder() {
  // Neutralize the dark background from index.css (this window is transparent)
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        boxSizing: 'border-box',
        border: '3px solid #e5484d',
        background: 'transparent',
        pointerEvents: 'none',
        // Faint outer hairline so the red reads on light and dark backgrounds
        boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
      }}
    />
  );
}
