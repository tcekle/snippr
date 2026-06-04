import React, { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useEditorStore } from '../store/editorStore';

// The usual defaults (iOS system palette) — the last grid tile opens the custom picker
const PRESET_COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff',
  '#5856d6', '#af52de', '#ff2d55', '#ffffff', '#000000',
];

export function PropertiesPanel() {
  const { strokeColor, strokeWidth, fontSize, activeTool, setStrokeColor, setStrokeWidth, setFontSize } = useEditorStore();
  const isPreset = PRESET_COLORS.includes(strokeColor);
  // Auto-open when the current color is already a custom one
  const [customOpen, setCustomOpen] = useState(() => !isPreset);

  const showFontSize = activeTool === 'text';
  const showPixelSize = activeTool === 'pixelate';

  return (
    <div style={{
      padding: '12px 14px', overflow: 'auto', flexShrink: 0, maxHeight: '60%',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div>
        <Label>Color</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setStrokeColor(c)}
              title={c}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: 4,
                background: c,
                border: c === strokeColor ? '2px solid var(--color-accent)' : '2px solid transparent',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                cursor: 'pointer', padding: 0,
                outline: 'none',
              }}
            />
          ))}
          {/* Custom color tile — toggles the full picker */}
          <button
            onClick={() => setCustomOpen(!customOpen)}
            title="Custom color…"
            style={{
              width: '100%', aspectRatio: '1', borderRadius: 4,
              background: 'conic-gradient(#ff3b30, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff3b30)',
              border: !isPreset ? '2px solid var(--color-accent)' : '2px solid transparent',
              cursor: 'pointer', padding: 0,
              outline: 'none',
              position: 'relative',
            }}
          >
            {!isPreset && (
              // Show the picked custom color in the tile's center
              <span style={{
                position: 'absolute', inset: 4, borderRadius: 2,
                background: strokeColor,
                border: '1px solid rgba(255,255,255,0.4)',
              }} />
            )}
          </button>
        </div>
        {customOpen && (
          <>
            <div style={{ borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
              <HexColorPicker color={strokeColor} onChange={setStrokeColor} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: strokeColor, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
              <HexColorInput
                color={strokeColor}
                onChange={setStrokeColor}
                prefixed
                style={{
                  width: '100%', minWidth: 0,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: 4,
                  padding: '4px 6px', fontSize: 12, fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
          </>
        )}
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
