import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

type Phase = 'idle' | 'dragging' | 'capturing';

interface DragRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function normRect(r: DragRect) {
  return {
    left: Math.min(r.startX, r.endX),
    top: Math.min(r.startY, r.endY),
    width: Math.abs(r.endX - r.startX),
    height: Math.abs(r.endY - r.startY),
  };
}

export function RegionSelector() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [drag, setDrag] = useState<DragRect | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'scrolling' | 'snapshot'>('scrolling');
  const overlayRef = useRef<HTMLDivElement>(null);

  // The same overlay hosts both capture flavours; Rust knows which one
  useEffect(() => {
    invoke<'scrolling' | 'snapshot'>('get_selection_mode')
      .then(setMode)
      .catch(console.error);
  }, []);

  // Neutralize the dark background from index.css
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

  // Esc cancels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        invoke('cancel_scrolling_selection').catch(console.error);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setCursor({ x: e.clientX, y: e.clientY });
    if (phase === 'dragging') {
      setDrag((prev) => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'idle') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPhase('dragging');
    setDrag({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY });
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'dragging' || !drag) return;
    const rect = normRect({ ...drag, endX: e.clientX, endY: e.clientY });

    // Stray click — too small
    if (rect.width < 10 || rect.height < 10) {
      setPhase('idle');
      setDrag(null);
      return;
    }

    setPhase('capturing');

    try {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const sf = await win.scaleFactor();

      const x = pos.x + Math.round(rect.left * sf);
      const y = pos.y + Math.round(rect.top * sf);
      const width = Math.max(1, Math.round(rect.width * sf));
      const height = Math.max(1, Math.round(rect.height * sf));

      const cmd = mode === 'snapshot' ? 'capture_snapshot' : 'start_scrolling_capture';
      await invoke(cmd, { x, y, width, height });
    } catch (err) {
      console.error('capture command failed', err);
      // Rust side will also emit scroll-capture-error to main window
    }
  };

  const rect = drag ? normRect(drag) : null;
  const dpr = window.devicePixelRatio || 1;

  return (
    <div
      ref={overlayRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: phase === 'idle' ? 'crosshair' : phase === 'dragging' ? 'crosshair' : 'default',
        userSelect: 'none',
        // During idle, dim whole screen; during drag, the selection rect handles it via box-shadow
        background: phase === 'idle' ? 'rgba(0,0,0,0.35)' : 'transparent',
      }}
    >
      {/* Crosshair guide lines — only in idle phase */}
      {phase === 'idle' && (
        <>
          <div style={{
            position: 'fixed',
            left: cursor.x,
            top: 0,
            width: 1,
            height: '100%',
            background: 'rgba(255,255,255,0.7)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'fixed',
            left: 0,
            top: cursor.y,
            width: '100%',
            height: 1,
            background: 'rgba(255,255,255,0.7)',
            pointerEvents: 'none',
          }} />
        </>
      )}

      {/* Instruction hint — idle state only */}
      {phase === 'idle' && (
        <div style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)',
          color: '#f3f3f3',
          fontSize: 13,
          fontWeight: 500,
          padding: '7px 16px',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.15)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}>
          {mode === 'snapshot'
            ? 'Drag to capture a region — Esc to cancel'
            : 'Drag to select scroll area — Esc to cancel'}
        </div>
      )}

      {/* Selection rectangle — drag phase */}
      {phase === 'dragging' && rect && (
        <div style={{
          position: 'fixed',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          // box-shadow creates the dim effect outside the selection rect
          boxShadow: '0 0 0 100000px rgba(0,0,0,0.35)',
          border: '2px solid var(--color-accent)',
          pointerEvents: 'none',
        }}>
          {/* Size badge */}
          {rect.width > 30 && rect.height > 20 && (
            <div style={{
              position: 'absolute',
              bottom: -28,
              left: 0,
              background: 'rgba(0,0,0,0.8)',
              color: '#f3f3f3',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}>
              {Math.round(rect.width * dpr)} × {Math.round(rect.height * dpr)} px
            </div>
          )}
        </div>
      )}

      {/* Capturing state — brief anti-flash message */}
      {phase === 'capturing' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            color: '#f3f3f3',
            fontSize: 13,
            fontWeight: 500,
            padding: '10px 20px',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.15)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}>
            {mode === 'snapshot'
              ? 'Capturing…'
              : 'Capturing — scroll happens automatically, Esc to stop'}
          </div>
        </div>
      )}
    </div>
  );
}
