import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../store/editorStore';
import type { SnipprSettings } from '../store/editorStore';
import { fillToCss, type BackdropPreset, type Palette } from '../types/backdrop';
import { deletePalette, exportPalette, importPalette, refreshPalettes, savePalette } from '../utils/paletteApi';

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useEditorStore();
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
    void refreshPalettes(); // pick up any palette files changed on disk
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
      setSettingsOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

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

            <PalettesManager />
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

// ── Beautify palettes ──────────────────────────────────────────────────────────
// Each palette is a file in palettes/ beside the exe. Changes here (add/rename/
// delete/import/edit swatches) hit disk immediately — independent of the Save
// button, which only persists the app settings above.

const fileSafe = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'palette';

function PalettesManager() {
  const palettes = useEditorStore((s) => s.palettes);
  const [expanded, setExpanded] = useState<string | null>(null);

  const newPalette = async () => {
    const names = new Set(palettes.map((p) => p.name));
    let name = 'New palette';
    for (let n = 2; names.has(name); n++) name = `New palette ${n}`;
    await savePalette({ name, swatches: [] });
    await refreshPalettes();
    setExpanded(name);
  };

  const importOne = async () => {
    const path = await open({ multiple: false, filters: [{ name: 'Palette JSON', extensions: ['json'] }] });
    if (typeof path !== 'string') return;
    try {
      const p = await importPalette(path);
      await refreshPalettes();
      setExpanded(p.name);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <FieldLabel>Beautify Palettes</FieldLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={importOne} style={miniBtn}>Import…</button>
          <button onClick={newPalette} style={miniBtn}>+ New</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
        Stored as files in <code>palettes\</code> next to the app. Changes save automatically.
      </div>

      {palettes.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 0' }}>
          No palettes yet — create one or import a <code>.json</code>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {palettes.map((p) => (
            <PaletteCard
              key={p.name}
              palette={p}
              expanded={expanded === p.name}
              onToggle={() => setExpanded(expanded === p.name ? null : p.name)}
              onRenamed={(name) => setExpanded(name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PaletteCard({ palette, expanded, onToggle, onRenamed }: {
  palette: Palette;
  expanded: boolean;
  onToggle: () => void;
  onRenamed: (name: string) => void;
}) {
  const [name, setName] = useState(palette.name);
  useEffect(() => setName(palette.name), [palette.name]);

  // Live-update the store entry, and (on commit) write the file.
  const onSwatches = (swatches: BackdropPreset[], persist: boolean) => {
    const store = useEditorStore.getState();
    store.setPalettes(store.palettes.map((p) => (p.name === palette.name ? { ...p, swatches } : p)));
    if (persist) savePalette({ name: palette.name, swatches }).catch(console.error);
  };

  const commitName = async () => {
    const next = name.trim();
    if (!next || next === palette.name) { setName(palette.name); return; }
    await savePalette({ name: next, swatches: palette.swatches });
    // Only remove the old file if it maps to a different filename — avoids deleting
    // the just-written file on a case-only rename (Windows FS is case-insensitive).
    if (fileSafe(palette.name).toLowerCase() !== fileSafe(next).toLowerCase()) {
      await deletePalette(palette.name);
    }
    await refreshPalettes();
    onRenamed(next);
  };

  const remove = async () => { await deletePalette(palette.name); await refreshPalettes(); };

  const exportOne = async () => {
    const dest = await save({
      defaultPath: `${fileSafe(palette.name)}.json`,
      filters: [{ name: 'Palette JSON', extensions: ['json'] }],
    });
    if (typeof dest === 'string') await exportPalette(palette.name, dest).catch(console.error);
  };

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px' }}>
        <button onClick={onToggle} style={{
          background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, padding: 0, textAlign: 'left',
        }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 10, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}>▶</span>
          <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{palette.name}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>({palette.swatches.length})</span>
        </button>
        <button onClick={exportOne} style={miniBtn}>Export</button>
        <button onClick={remove} title="Delete palette" style={{ ...miniBtn, color: '#f87171' }}>Delete</button>
      </div>

      {expanded && (
        <div style={{ padding: '0 9px 9px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="Palette name"
            style={{
              background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', borderRadius: 4, padding: '4px 8px', fontSize: 12.5, outline: 'none',
            }}
          />
          <PaletteEditor value={palette.swatches} onChange={onSwatches} />
        </div>
      )}
    </div>
  );
}

/** Swatch list editor. onChange(next, persist): persist=false for live drags,
 *  true when the edit should be written to disk (structural change or input blur). */
function PaletteEditor({ value, onChange }: {
  value: BackdropPreset[];
  onChange: (p: BackdropPreset[], persist: boolean) => void;
}) {
  const at = (i: number, preset: BackdropPreset, persist: boolean) =>
    onChange(value.map((p, idx) => (idx === i ? preset : p)), persist);
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i), true);
  const add = () => onChange([...value, { label: 'New', fill: { kind: 'solid', color: '#6b7280' } }], true);

  const setKind = (i: number, kind: 'solid' | 'gradient') => {
    const p = value[i];
    if (kind === p.fill.kind) return;
    if (kind === 'solid') {
      const color = p.fill.kind === 'gradient' ? p.fill.from : '#6b7280';
      at(i, { ...p, fill: { kind: 'solid', color } }, true);
    } else {
      const from = p.fill.kind === 'solid' ? p.fill.color : '#054BAA';
      at(i, { ...p, fill: { kind: 'gradient', from, to: '#4A90D9', angle: 135 } }, true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {value.map((p, i) => (
        <div key={i} style={{
          background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
          borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 30, height: 22, borderRadius: 4, flexShrink: 0, background: fillToCss(p.fill),
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
            }} />
            <input
              value={p.label}
              onChange={(e) => at(i, { ...p, label: e.target.value }, false)}
              onBlur={() => onChange(value, true)}
              style={{
                flex: 1, minWidth: 0, background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', color: 'var(--color-text)',
                borderRadius: 4, padding: '3px 7px', fontSize: 12, outline: 'none',
              }}
            />
            <KindToggle kind={p.fill.kind} onChange={(k) => setKind(i, k)} />
            <button onClick={() => removeAt(i)} title="Remove swatch" style={{
              width: 22, height: 22, flexShrink: 0, lineHeight: 1,
              background: 'transparent', border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}>×</button>
          </div>

          {p.fill.kind === 'solid' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ColorInput
                value={p.fill.color}
                onInput={(c) => at(i, { ...p, fill: { kind: 'solid', color: c } }, false)}
                onCommit={() => onChange(value, true)}
              />
              <span style={hexLabel}>{p.fill.color}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <ColorInput
                value={p.fill.from}
                onInput={(c) => at(i, { ...p, fill: { ...p.fill, kind: 'gradient', from: c } as BackdropPreset['fill'] }, false)}
                onCommit={() => onChange(value, true)}
              />
              <ColorInput
                value={p.fill.to}
                onInput={(c) => at(i, { ...p, fill: { ...p.fill, kind: 'gradient', to: c } as BackdropPreset['fill'] }, false)}
                onCommit={() => onChange(value, true)}
              />
              <span style={{ ...hexLabel, marginLeft: 'auto' }}>angle</span>
              <input
                type="number" min={0} max={360}
                value={p.fill.angle}
                onChange={(e) => {
                  const angle = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                  at(i, { ...p, fill: { ...p.fill, kind: 'gradient', angle } as BackdropPreset['fill'] }, false);
                }}
                onBlur={() => onChange(value, true)}
                style={{
                  width: 52, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text)', borderRadius: 4, padding: '3px 6px', fontSize: 12, outline: 'none',
                }}
              />
            </div>
          )}
        </div>
      ))}

      <button onClick={add} style={{
        width: '100%', background: 'transparent', color: 'var(--color-text)',
        border: '1px dashed var(--color-border)', borderRadius: 6, padding: '5px 0',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        + Add swatch
      </button>
    </div>
  );
}

function KindToggle({ kind, onChange }: { kind: 'solid' | 'gradient'; onChange: (k: 'solid' | 'gradient') => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--color-surface)', borderRadius: 5, padding: 2, flexShrink: 0 }}>
      {(['solid', 'gradient'] as const).map((k) => {
        const on = k === kind;
        return (
          <button key={k} onClick={() => onChange(k)} title={k === 'solid' ? 'Solid color' : 'Gradient'} style={{
            border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
            background: on ? 'var(--color-accent)' : 'transparent', color: on ? '#fff' : 'var(--color-text-muted)',
          }}>
            {k === 'solid' ? 'Solid' : 'Grad'}
          </button>
        );
      })}
    </div>
  );
}

function ColorInput({ value, onInput, onCommit }: { value: string; onInput: (c: string) => void; onCommit: () => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onInput(e.target.value)}
      onBlur={onCommit}
      style={{
        width: 34, height: 24, padding: 0, flexShrink: 0, cursor: 'pointer',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4,
      }}
    />
  );
}

const hexLabel: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace',
};

const miniBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-border)',
  color: 'var(--color-text-muted)', borderRadius: 5, padding: '3px 9px',
  fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
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
