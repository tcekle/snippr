import React from 'react';
import { HexColorPicker } from 'react-colorful';
import { useEditorStore } from '../store/editorStore';

const PRESET_COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#007aff', '#5856d6', '#ffffff', '#000000',
];

export function PropertiesPanel() {
  const { strokeColor, strokeWidth, fontSize, activeTool, setStrokeColor, setStrokeWidth, setFontSize } = useEditorStore();

  const showFontSize = activeTool === 'text';
  const showPixelSize = activeTool === 'pixelate';

  return (
    <div style={{
      width: 220, padding: '12px 14px', background: 'var(--color-elevated)',
      borderLeft: '1px solid var(--color-border)', overflow: 'auto',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div>
        <Label>Color</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setStrokeColor(c)}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: 4,
                background: c,
                border: c === strokeColor ? '2px solid var(--color-accent)' : '2px solid transparent',
                cursor: 'pointer', padding: 0,
                outline: 'none',
              }}
            />
          ))}
        </div>
        <div style={{ borderRadius: 8, overflow: 'hidden' }}>
          <HexColorPicker color={strokeColor} onChange={setStrokeColor} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: strokeColor, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
          <code style={{ color: 'var(--color-text)', fontSize: 12 }}>{strokeColor}</code>
        </div>
      </div>

      <div>
        <Label>Stroke Width</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range" min={1} max={12} value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--color-accent)' }}
          />
          <span style={{ color: 'var(--color-text)', fontSize: 13, minWidth: 20 }}>{strokeWidth}</span>
        </div>
      </div>

      {showFontSize && (
        <div>
          <Label>Font Size</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range" min={10} max={72} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--color-accent)' }}
            />
            <span style={{ color: 'var(--color-text)', fontSize: 13, minWidth: 24 }}>{fontSize}</span>
          </div>
        </div>
      )}

      {showPixelSize && <PixelSizeControl />}
    </div>
  );
}

function PixelSizeControl() {
  const { selectedId, annotations, updateAnnotation } = useEditorStore();
  const selected = selectedId ? annotations.find((a) => a.id === selectedId) : null;
  const pixelSize = selected?.type === 'pixelate' ? selected.pixelSize : 12;

  return (
    <div>
      <Label>Pixel Size</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range" min={4} max={32} value={pixelSize}
          onChange={(e) => {
            if (selected?.type === 'pixelate') {
              updateAnnotation(selected.id, { pixelSize: Number(e.target.value) }, false);
            }
          }}
          style={{ flex: 1, accentColor: 'var(--color-accent)' }}
        />
        <span style={{ color: 'var(--color-text)', fontSize: 13, minWidth: 24 }}>{pixelSize}</span>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
      {children}
    </div>
  );
}
