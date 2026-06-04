import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../store/editorStore';

interface Props {
  onExport: () => Promise<void>;
}

export function TopBar({ onExport }: Props) {
  const { paused, setSettingsOpen, screenshot } = useEditorStore();

  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center',
      padding: '0 16px', background: 'var(--color-elevated)',
      borderBottom: '1px solid var(--color-border)',
      gap: 12, flexShrink: 0,
    }}>
      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)', letterSpacing: -0.5 }}>
        snippr
      </span>

      {paused && (
        <span style={{
          background: '#f59e0b', color: '#000', fontSize: 11, fontWeight: 600,
          padding: '1px 7px', borderRadius: 10, letterSpacing: 0.5,
        }}>
          PAUSED
        </span>
      )}

      <div style={{ flex: 1 }} />

      {screenshot.imageEl && (
        <button
          onClick={onExport}
          style={{
            background: 'var(--color-accent)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '5px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Export (Ctrl+Enter)"
        >
          Export
        </button>
      )}

      <button
        onClick={() => invoke('open_save_folder').catch(console.error)}
        title="Open save folder"
        style={{
          background: 'transparent', border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)', borderRadius: 6, padding: '4px 10px',
          fontSize: 12, cursor: 'pointer',
        }}
      >
        Open Folder
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        title="Settings"
        style={{
          background: 'transparent', border: 'none',
          color: 'var(--color-text-muted)', cursor: 'pointer',
          width: 32, height: 32, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <GearIcon />
      </button>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
