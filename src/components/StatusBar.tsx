import React from 'react';
import { useEditorStore } from '../store/editorStore';

interface Props {
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function StatusBar({ onFit, onZoomIn, onZoomOut }: Props) {
  const { screenshot, view, activeTool } = useEditorStore();

  const hints: Record<string, string> = {
    select: 'Click to select · Drag to move',
    rect: 'Drag to draw rectangle',
    ellipse: 'Drag to draw ellipse',
    arrow: 'Drag to draw arrow',
    line: 'Drag to draw line',
    pen: 'Click and drag to draw',
    highlight: 'Drag to highlight',
    text: 'Click to place text · Enter to confirm',
    badge: 'Click to place badge',
    pixelate: 'Drag to pixelate area',
    crop: 'Drag to crop · Enter to confirm · Esc to cancel',
  };

  const hint = hints[activeTool] ?? '';

  return (
    <div style={{
      height: 32, display: 'flex', alignItems: 'center',
      padding: '0 12px', background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)', gap: 16,
      fontSize: 12, color: 'var(--color-text-muted)',
      flexShrink: 0,
    }}>
      {screenshot.imageEl && (
        <span style={{ flexShrink: 0 }}>{screenshot.width} × {screenshot.height}</span>
      )}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {hint}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <IconBtn onClick={onZoomOut} title="Zoom out (Ctrl+-)">–</IconBtn>
        <span style={{ minWidth: 48, textAlign: 'center' }}>{Math.round(view.scale * 100)}%</span>
        <IconBtn onClick={onZoomIn} title="Zoom in (Ctrl+=)">+</IconBtn>
        <IconBtn onClick={onFit} title="Fit to window (Ctrl+0)">Fit</IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent', border: '1px solid var(--color-border)',
        color: 'var(--color-text-muted)', borderRadius: 4, padding: '1px 7px',
        cursor: 'pointer', fontSize: 12, lineHeight: '18px',
      }}
    >
      {children}
    </button>
  );
}
