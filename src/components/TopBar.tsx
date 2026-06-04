import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../store/editorStore';

interface Props {
  onCopy: () => Promise<void>;
  onSave: () => Promise<void>;
}

export function TopBar({ onCopy, onSave }: Props) {
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
        <>
          <button
            onClick={onCopy}
            style={{
              background: 'var(--color-accent)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
            title="Copy to clipboard (Ctrl+C)"
          >
            <CopyIcon />
            Copy
          </button>
          <button
            onClick={onSave}
            style={{
              background: 'transparent', color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
            title="Save as… (Ctrl+S)"
          >
            <SaveIcon />
            Save
          </button>
        </>
      )}

      <button
        onClick={() => invoke('begin_scrolling_selection').catch(console.error)}
        title="Scrolling capture"
        style={{
          background: 'transparent', color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <ScrollCaptureIcon />
        Scrolling capture
      </button>

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

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"
        stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h7.8L14 4.7v7.8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5 2v3.5h5V2M5 14v-4.5h6V14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
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

function ScrollCaptureIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      {/* Outer rectangle representing the selection region */}
      <rect x="1.5" y="1.5" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Downward arrow through the bottom, representing scrolling */}
      <path d="M8 8v5.5M5.5 11l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
