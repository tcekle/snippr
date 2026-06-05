import React, { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useEditorStore } from '../store/editorStore';
import type { Annotation } from '../types/annotations';
import {
  BACKDROP_PRESETS,
  DEFAULT_BACKDROP,
  fillsEqual,
  type AspectMode,
  type BackdropFill,
  type FrameStyle,
} from '../types/backdrop';

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
  // The backdrop tool has its own fill controls; stroke color/width don't apply there.
  const showAnnotationStyles = activeTool !== 'backdrop';

  return (
    <div style={{
      padding: '12px 14px', overflow: 'auto', flexShrink: 0, maxHeight: '60%',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {showAnnotationStyles && (
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
      )}

      {showAnnotationStyles && (
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
      )}

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

      <PixelSizeControl />
      <BadgeNumberControl />
      <LoupeControls />
      <SpotlightControls />
      <BackdropControls />
    </div>
  );
}

function PixelSizeControl() {
  const { selectedId, annotations, activeTool, updateAnnotation } = useEditorStore();
  const selected = selectedId ? annotations.find((a) => a.id === selectedId) : null;
  // Visible while using the tool, or whenever a pixelate region is selected
  if (activeTool !== 'pixelate' && selected?.type !== 'pixelate') return null;
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

function BadgeNumberControl() {
  const { selectedId, annotations, updateAnnotation } = useEditorStore();
  const selected = selectedId ? annotations.find((a) => a.id === selectedId) : null;
  if (selected?.type !== 'badge') return null;

  const setNumber = (n: number) => {
    updateAnnotation(selected.id, { number: Math.max(1, Math.min(999, Math.round(n) || 1)) }, true);
  };

  return (
    <div>
      <Label>Badge Number</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StepButton label="−" onClick={() => setNumber(selected.number - 1)} />
        <input
          type="number" min={1} max={999} value={selected.number}
          onChange={(e) => setNumber(Number(e.target.value))}
          style={{
            flex: 1, minWidth: 0, textAlign: 'center',
            background: 'var(--color-surface)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 4,
            padding: '4px 6px', fontSize: 13, outline: 'none',
          }}
        />
        <StepButton label="+" onClick={() => setNumber(selected.number + 1)} />
      </div>
    </div>
  );
}

/** Label + pill switch row — reusable inline toggle for boolean properties. */
function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-text)', fontSize: 12.5 }}>{label}</span>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}

function LoupeControls() {
  const { selectedId, annotations, activeTool, updateAnnotation } = useEditorStore();
  const selected = selectedId ? annotations.find((a) => a.id === selectedId) : null;
  const loupe = selected?.type === 'loupe' ? selected : null;
  if (activeTool !== 'loupe' && !loupe) return null;

  const set = (p: Partial<Extract<Annotation, { type: 'loupe' }>>, push = false) => {
    if (loupe) updateAnnotation(loupe.id, p, push);
  };

  return (
    <>
      <div>
        <Label>Magnification</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" min={1} max={6} step={0.5} value={loupe?.zoom ?? 2.5}
            onChange={(e) => set({ zoom: Number(e.target.value) }, false)}
            style={{ flex: 1, accentColor: 'var(--color-accent)' }} />
          <span style={{ fontSize: 13, minWidth: 28, color: 'var(--color-text)' }}>{(loupe?.zoom ?? 2.5)}×</span>
        </div>
      </div>
      <div>
        <Label>Shape</Label>
        <Segmented<'circle' | 'rect'>
          value={loupe?.shape ?? 'circle'}
          options={['circle', 'rect']}
          onChange={(v) => set({ shape: v }, true)}
        />
      </div>
      <div>
        <Label>Border</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" min={0} max={8} value={loupe?.borderWidth ?? 3}
            onChange={(e) => set({ borderWidth: Number(e.target.value) }, false)}
            style={{ flex: 1, accentColor: 'var(--color-accent)' }} />
          <span style={{ fontSize: 13, minWidth: 16, color: 'var(--color-text)' }}>{loupe?.borderWidth ?? 3}</span>
        </div>
      </div>
      <ToggleRow label="Show source outline" on={loupe?.showSource ?? true} onToggle={() => set({ showSource: !loupe?.showSource }, true)} />
      <ToggleRow label="Connector line" on={loupe?.connector ?? true} onToggle={() => set({ connector: !loupe?.connector }, true)} />
    </>
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 26, height: 26, flexShrink: 0,
        background: 'var(--color-surface)', color: 'var(--color-text)',
        border: '1px solid var(--color-border)', borderRadius: 4,
        cursor: 'pointer', fontSize: 14, lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function SpotlightControls() {
  const { selectedId, annotations, activeTool, updateAnnotation } = useEditorStore();
  const selected = selectedId ? annotations.find((a) => a.id === selectedId) : null;
  const sp = selected?.type === 'spotlight' ? selected : null;
  if (activeTool !== 'spotlight' && !sp) return null;

  const set = (p: Partial<Extract<Annotation, { type: 'spotlight' }>>, push = false) => {
    if (sp) updateAnnotation(sp.id, p, push);
  };
  const seg = (opts: string[], val: string, on: (v: string) => void) => (
    <div style={{ display: 'flex', gap: 4, background: 'var(--color-elevated)', borderRadius: 7, padding: 3 }}>
      {opts.map((o) => (
        <button key={o} onClick={() => on(o)} style={{
          flex: 1, border: 'none', cursor: 'pointer', borderRadius: 5, padding: '5px 0',
          fontSize: 11.5, fontWeight: 600,
          background: o.toLowerCase() === val ? 'var(--color-accent)' : 'transparent',
          color: o.toLowerCase() === val ? '#fff' : 'var(--color-text-muted)',
        }}>{o}</button>
      ))}
    </div>
  );

  return (
    <>
      <div>
        <Label>Dim Amount</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" min={0} max={90} value={Math.round((sp?.dim ?? 0.62) * 100)}
            onChange={(e) => set({ dim: Number(e.target.value) / 100 }, false)}
            style={{ flex: 1, accentColor: 'var(--color-accent)' }} />
          <span style={{ fontSize: 13, minWidth: 30 }}>{Math.round((sp?.dim ?? 0.62) * 100)}%</span>
        </div>
      </div>
      <div><Label>Shape</Label>{seg(['Rect', 'Ellipse'], sp?.shape ?? 'rect', (v) => set({ shape: v as 'rect' | 'ellipse' }, true))}</div>
      <div>
        <Label>Feather</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" min={0} max={40} value={sp?.feather ?? 10}
            onChange={(e) => set({ feather: Number(e.target.value) }, false)}
            style={{ flex: 1, accentColor: 'var(--color-accent)' }} />
          <span style={{ fontSize: 13, minWidth: 24 }}>{sp?.feather ?? 10}</span>
        </div>
      </div>
      <ToggleRow label="Invert (dim inside)" on={sp?.invert ?? false} onToggle={() => set({ invert: !sp?.invert }, true)} />
    </>
  );
}

// Render a backdrop fill as a CSS background value.
function fillToCss(f: BackdropFill): string {
  return f.kind === 'solid' ? f.color : `linear-gradient(${f.angle}deg, ${f.from}, ${f.to})`;
}

function BackdropControls() {
  const { backdrop, activeTool, setBackdrop, removeBackdrop } = useEditorStore();
  if (activeTool !== 'backdrop') return null;
  const b = backdrop ?? DEFAULT_BACKDROP;

  return (
    <>
      <div>
        <Label>Backdrop</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {BACKDROP_PRESETS.map((preset, i) => {
            const selected = fillsEqual(b.fill, preset);
            return (
              <button
                key={i}
                onClick={() => setBackdrop({ fill: preset })}
                title="Backdrop"
                style={{
                  width: '100%', aspectRatio: '1.3', borderRadius: 6,
                  background: fillToCss(preset),
                  border: selected ? '2px solid var(--color-accent)' : '2px solid transparent',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
                  cursor: 'pointer', padding: 0, outline: 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <Label>Padding</Label>
        <Slider min={0} max={200} value={b.padding} onChange={(v, commit) => setBackdrop({ padding: v }, commit)} />
      </div>

      <div>
        <Label>Corner Radius</Label>
        <Slider min={0} max={40} value={b.cornerRadius} onChange={(v, commit) => setBackdrop({ cornerRadius: v }, commit)} />
      </div>

      <div>
        <Label>Window Frame</Label>
        <Segmented<FrameStyle>
          value={b.frame}
          options={['none', 'macos', 'browser']}
          onChange={(v) => setBackdrop({ frame: v })}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--color-text)', fontSize: 12.5 }}>Drop shadow</span>
        <Toggle on={b.shadow} onToggle={() => setBackdrop({ shadow: !b.shadow })} />
      </div>

      <div>
        <Label>Aspect</Label>
        <Segmented<AspectMode>
          value={b.aspect}
          options={['auto', '1:1', '16:9', '4:3']}
          onChange={(v) => setBackdrop({ aspect: v })}
        />
      </div>

      <button
        onClick={() => removeBackdrop()}
        style={{
          width: '100%', background: 'transparent', color: 'var(--color-text)',
          border: '1px solid var(--color-border)', borderRadius: 6,
          padding: '7px 0', fontSize: 12.5, fontWeight: 600,
          cursor: 'pointer', outline: 'none',
        }}
      >
        Remove backdrop
      </button>
    </>
  );
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--color-elevated)', borderRadius: 7, padding: 3 }}>
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              flex: 1, borderRadius: 5, padding: '5px 0', fontSize: 11.5, fontWeight: 600,
              background: selected ? 'var(--color-accent)' : 'transparent',
              color: selected ? '#fff' : 'var(--color-text-muted)',
              border: 'none', cursor: 'pointer', outline: 'none',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ min, max, value, onChange }: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number, commit: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="range" min={min} max={max} value={value}
        // Fire continuously without committing — avoids spamming undo history during a drag.
        onChange={(e) => onChange(Number(e.target.value), false)}
        // Commit on release / key-up so the whole drag collapses into a single history entry.
        onPointerUp={(e) => onChange(Number(e.currentTarget.value), true)}
        onKeyUp={(e) => onChange(Number(e.currentTarget.value), true)}
        style={{ flex: 1, accentColor: 'var(--color-accent)' }}
      />
      <span style={{ color: 'var(--color-text)', fontSize: 13, minWidth: 28 }}>{value}</span>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        width: 36, height: 20, flexShrink: 0, borderRadius: 10, padding: 0,
        background: on ? 'var(--color-accent)' : 'var(--color-border)',
        border: 'none', cursor: 'pointer', outline: 'none',
        position: 'relative', transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: on ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}
