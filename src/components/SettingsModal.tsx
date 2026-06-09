import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../store/editorStore';
import type { SnipprSettings } from '../store/editorStore';
import { fillToCss, type BackdropPreset } from '../types/backdrop';

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen, setCustomPalette } = useEditorStore();
  const [settings, setSettings] = useState<SnipprSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion().then(setVersion).catch(() => { /* plain browser */ });
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    setLoading(true);
    invoke<SnipprSettings>('get_settings')
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const update = <K extends keyof SnipprSettings>(key: K, value: SnipprSettings[K]) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleBrowse = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (dir && typeof dir === 'string') {
      update('saveDirectory', dir);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await invoke('set_settings', { settings });
      // Reflect palette edits in the live backdrop panel without a restart.
      setCustomPalette(settings.backdropPalette ?? []);
      setSettingsOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // null = none defined yet; start the editor empty so the user builds their own.
  const palette = settings?.backdropPalette ?? [];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div style={{
        background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 10, padding: 24, width: 480, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <h2 style={{ color: 'var(--color-text)', margin: '0 0 20px', fontSize: 17, flexShrink: 0 }}>Settings</h2>

        {loading || !settings ? (
          <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 24 }}>Loading…</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            <div>
              <FieldLabel>Save Directory</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={settings.saveDirectory}
                  onChange={(e) => update('saveDirectory', e.target.value)}
                  style={{
                    flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text)', borderRadius: 6, padding: '5px 10px', fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button onClick={handleBrowse} style={secondaryBtn}>Browse</button>
              </div>
            </div>

            <CheckField
              label="Auto-save to directory"
              checked={settings.autoSave}
              onChange={(v) => update('autoSave', v)}
            />
            <CheckField
              label="Copy to clipboard on export"
              checked={settings.copyToClipboard}
              onChange={(v) => update('copyToClipboard', v)}
            />
            <CheckField
              label="Trigger on any image (not just snips)"
              checked={settings.triggerOnAnyImage}
              onChange={(v) => update('triggerOnAnyImage', v)}
            />
            <CheckField
              label="Launch on startup"
              checked={settings.autostart}
              onChange={(v) => update('autostart', v)}
            />

            <PaletteEditor value={palette} onChange={(p) => update('backdropPalette', p)} />
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, marginTop: 20, flexShrink: 0,
        }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            {version ? `snippr v${version}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSettingsOpen(false)} style={secondaryBtn}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !settings}
              style={{
                background: 'var(--color-accent)', color: '#fff', border: 'none',
                borderRadius: 6, padding: '6px 20px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Beautify palette editor ───────────────────────────────────────────────────
// Edits the user's backdrop swatches. Persisted in settings.json (next to the
// exe) — no palette is bundled in the app, so this is where one is defined.

function PaletteEditor({ value, onChange }: { value: BackdropPreset[]; onChange: (p: BackdropPreset[]) => void }) {
  const updateAt = (i: number, preset: BackdropPreset) =>
    onChange(value.map((p, idx) => (idx === i ? preset : p)));
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { label: 'New', fill: { kind: 'solid', color: '#6b7280' } }]);

  const setKind = (i: number, kind: 'solid' | 'gradient') => {
    const p = value[i];
    if (kind === p.fill.kind) return;
    if (kind === 'solid') {
      const color = p.fill.kind === 'gradient' ? p.fill.from : '#6b7280';
      updateAt(i, { ...p, fill: { kind: 'solid', color } });
    } else {
      const from = p.fill.kind === 'solid' ? p.fill.color : '#054BAA';
      updateAt(i, { ...p, fill: { kind: 'gradient', from, to: '#4A90D9', angle: 135 } });
    }
  };

  return (
    <div>
      <FieldLabel>Beautify Palette</FieldLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {value.map((p, i) => (
          <div key={i} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 30, height: 22, borderRadius: 4, flexShrink: 0, background: fillToCss(p.fill),
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
              }} />
              <input
                value={p.label}
                onChange={(e) => updateAt(i, { ...p, label: e.target.value })}
                style={{
                  flex: 1, minWidth: 0, background: 'var(--color-elevated)',
                  border: '1px solid var(--color-border)', color: 'var(--color-text)',
                  borderRadius: 4, padding: '3px 7px', fontSize: 12, outline: 'none',
                }}
              />
              <KindToggle kind={p.fill.kind} onChange={(k) => setKind(i, k)} />
              <button
                onClick={() => removeAt(i)}
                title="Remove swatch"
                style={{
                  width: 22, height: 22, flexShrink: 0, lineHeight: 1,
                  background: 'transparent', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                }}
              >
                ×
              </button>
            </div>

            {p.fill.kind === 'solid' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ColorInput value={p.fill.color} onChange={(c) => updateAt(i, { ...p, fill: { kind: 'solid', color: c } })} />
                <span style={hexLabel}>{p.fill.color}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <ColorInput value={p.fill.from} onChange={(c) => updateAt(i, { ...p, fill: { ...p.fill, kind: 'gradient', from: c } as BackdropPreset['fill'] })} />
                <ColorInput value={p.fill.to} onChange={(c) => updateAt(i, { ...p, fill: { ...p.fill, kind: 'gradient', to: c } as BackdropPreset['fill'] })} />
                <span style={{ ...hexLabel, marginLeft: 'auto' }}>angle</span>
                <input
                  type="number" min={0} max={360}
                  value={p.fill.angle}
                  onChange={(e) => {
                    const angle = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                    updateAt(i, { ...p, fill: { ...p.fill, kind: 'gradient', angle } as BackdropPreset['fill'] });
                  }}
                  style={{
                    width: 52, background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text)', borderRadius: 4, padding: '3px 6px', fontSize: 12, outline: 'none',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {value.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '2px 0 6px' }}>
          No swatches yet — add your palette here (saved to settings.json).
        </div>
      )}

      <button onClick={add} style={{
        marginTop: 8, width: '100%', background: 'transparent', color: 'var(--color-text)',
        border: '1px dashed var(--color-border)', borderRadius: 6, padding: '6px 0',
        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      }}>
        + Add swatch
      </button>
    </div>
  );
}

function KindToggle({ kind, onChange }: { kind: 'solid' | 'gradient'; onChange: (k: 'solid' | 'gradient') => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--color-elevated)', borderRadius: 5, padding: 2, flexShrink: 0 }}>
      {(['solid', 'gradient'] as const).map((k) => {
        const on = k === kind;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            title={k === 'solid' ? 'Solid color' : 'Gradient'}
            style={{
              border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 600,
              cursor: 'pointer', background: on ? 'var(--color-accent)' : 'transparent',
              color: on ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {k === 'solid' ? 'Solid' : 'Grad'}
          </button>
        );
      })}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 34, height: 24, padding: 0, flexShrink: 0, cursor: 'pointer',
        background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: 4,
      }}
    />
  );
}

const hexLabel: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace',
};

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
      />
      <span style={{ color: 'var(--color-text)', fontSize: 13 }}>{label}</span>
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
      {children}
    </div>
  );
}

const secondaryBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', borderRadius: 6, padding: '5px 14px',
  fontSize: 13, cursor: 'pointer',
};
