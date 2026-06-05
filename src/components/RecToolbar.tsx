import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Floating recorder bar (window label `rec-toolbar`). Fills its own window;
 * Rust owns the window lifecycle, so there is no self-close. */
export function RecToolbar() {
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false); // disables both buttons after a click

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const stop = () => {
    if (busy) return;
    setBusy(true);
    invoke('stop_recording').catch(console.error);
  };

  const discard = () => {
    if (busy) return;
    setBusy(true);
    invoke('cancel_recording').catch(console.error);
  };

  return (
    <div
      data-tauri-drag-region
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', height: '100vh', overflow: 'hidden',
        padding: '0 10px',
        background: 'var(--color-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Pulse keyframes — inline styles can't declare @keyframes */}
      <style>{`@keyframes recPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>

      <span style={{
        width: 11, height: 11, borderRadius: '50%', background: '#e11d48',
        flexShrink: 0, animation: 'recPulse 1s ease-in-out infinite',
      }} />

      <span style={{
        fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        color: 'var(--color-text)', minWidth: 42,
      }}>
        {fmt(elapsed)}
      </span>

      <div style={{ flex: 1 }} />

      <button
        onClick={stop}
        disabled={busy}
        title="Stop and save"
        style={{
          background: 'var(--color-accent)', color: '#fff', border: 'none',
          borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        Stop
      </button>

      <button
        onClick={discard}
        disabled={busy}
        title="Discard recording"
        style={{
          background: 'transparent', color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)', borderRadius: 6,
          width: 26, height: 26, fontSize: 15, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
