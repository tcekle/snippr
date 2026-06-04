import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../store/editorStore';
import type { SnipprSettings } from '../store/editorStore';

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useEditorStore();
  const [settings, setSettings] = useState<SnipprSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        borderRadius: 10, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <h2 style={{ color: 'var(--color-text)', margin: '0 0 20px', fontSize: 17 }}>Settings</h2>

        {loading || !settings ? (
          <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 24 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
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
  );
}

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
