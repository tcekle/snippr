import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../store/editorStore';
import { openImageFile } from '../utils/openFile';

interface Props {
  onCopy: () => Promise<void>;
  onSave: () => Promise<void>;
}

type Fps = 10 | 20 | 30;
const FPS_OPTIONS: Fps[] = [10, 20, 30];
const FPS_KEY = 'snippr.recordFps';

type Format = 'mp4' | 'gif';
const FORMAT_OPTIONS: Format[] = ['mp4', 'gif'];
const FORMAT_KEY = 'snippr.recordFormat';

// Small uppercase section label — mirrors PropertiesPanel's Label treatment.
const SECTION_LABEL_STYLE = {
  color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase',
  letterSpacing: 0.8, padding: '4px 10px 2px',
} as const;

function loadFps(): Fps {
  try {
    const v = Number(localStorage.getItem(FPS_KEY));
    if (FPS_OPTIONS.includes(v as Fps)) return v as Fps;
  } catch { /* localStorage unavailable */ }
  return 20;
}

function loadFormat(): Format {
  try {
    const v = localStorage.getItem(FORMAT_KEY);
    if (FORMAT_OPTIONS.includes(v as Format)) return v as Format;
  } catch { /* localStorage unavailable */ }
  return 'mp4';
}

export function TopBar({ onCopy, onSave }: Props) {
  const { paused, setSettingsOpen, screenshot } = useEditorStore();
  const [fps, setFps] = useState<Fps>(loadFps);
  const [format, setFormat] = useState<Format>(loadFormat);
  const [fpsOpen, setFpsOpen] = useState(false);
  const recordGroupRef = useRef<HTMLDivElement>(null);

  // Persist fps choice
  useEffect(() => {
    try { localStorage.setItem(FPS_KEY, String(fps)); } catch { /* ignore */ }
  }, [fps]);

  // Persist format choice
  useEffect(() => {
    try { localStorage.setItem(FORMAT_KEY, format); } catch { /* ignore */ }
  }, [format]);

  // Close fps popover on outside click / Esc
  useEffect(() => {
    if (!fpsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!recordGroupRef.current?.contains(e.target as Node)) setFpsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFpsOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [fpsOpen]);

  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center',
      padding: '0 16px', background: 'var(--color-elevated)',
      borderBottom: '1px solid var(--color-border)',
      gap: 12, flexShrink: 0,
    }}>
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
        onClick={() => openImageFile()}
        title="Open an image or editable snippr PNG (Ctrl+O)"
        style={{
          background: 'transparent', color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <OpenIcon />
        Open
      </button>

      <button
        onClick={() => invoke('begin_snapshot_selection').catch(console.error)}
        title="Capture a screen region and add it to the current document"
        style={{
          background: 'transparent', color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <AddScreenshotIcon />
        Add screenshot
      </button>

      {/* Record button + fps picker caret share one bordered group */}
      <div ref={recordGroupRef} style={{ position: 'relative', display: 'flex' }}>
        <button
          onClick={() => invoke('begin_recording_selection', { fps, format }).catch(console.error)}
          title={`Record a screen region (${format.toUpperCase()}, ${fps} fps)`}
          style={{
            background: 'transparent', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRight: 'none',
            borderRadius: '6px 0 0 6px', padding: '5px 12px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <RecordIcon />
          Record
        </button>
        <button
          onClick={() => setFpsOpen((o) => !o)}
          title="Choose frame rate"
          style={{
            background: 'transparent', color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: '0 6px 6px 0', padding: '5px 7px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
        >
          <CaretIcon />
        </button>
        {fpsOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 1500,
            display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160,
            background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
            borderRadius: 6, padding: 4, boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          }}>
            {/* Format section — picking a format updates state only, doesn't close or record */}
            <div style={SECTION_LABEL_STYLE}>Format</div>
            {FORMAT_OPTIONS.map((opt) => {
              const active = opt === format;
              return (
                <button
                  key={opt}
                  onClick={() => setFormat(opt)}
                  style={{
                    border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                    background: active ? 'var(--color-accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text)',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div>{opt.toUpperCase()}</div>
                  {opt === 'gif' && (
                    <div style={{
                      fontSize: 11, fontWeight: 400,
                      color: active ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)',
                    }}>
                      also saves the .mp4
                    </div>
                  )}
                </button>
              );
            })}

            {/* Frame rate section — keep existing close-on-pick behavior */}
            <div style={{ ...SECTION_LABEL_STYLE, marginTop: 6 }}>Frame rate</div>
            {FPS_OPTIONS.map((opt) => {
              const active = opt === fps;
              return (
                <button
                  key={opt}
                  onClick={() => { setFps(opt); setFpsOpen(false); }}
                  style={{
                    border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                    background: active ? 'var(--color-accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text)',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {opt} fps
                </button>
              );
            })}
          </div>
        )}
      </div>

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

function RecordIcon() {
  // Red filled recording dot
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" fill="#e11d48" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 1.5h4A1.5 1.5 0 0 1 13 5.5V12a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 1.5 12z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function AddScreenshotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      {/* Selection region */}
      <rect x="1.5" y="1.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Plus in the corner */}
      <path d="M12.5 9.5v6M9.5 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
