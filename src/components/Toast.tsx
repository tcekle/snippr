import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastMessage {
  id: string;
  text: string;
  error?: boolean;
  action?: ToastAction;
}

// Options object form — a boolean second arg is back-compat shorthand for { error: true/false }
interface ToastOpts {
  error?: boolean;
  durationMs?: number;
  action?: ToastAction;
}

let toastListeners: ((msgs: ToastMessage[]) => void)[] = [];
let toastMessages: ToastMessage[] = [];

function dismissToast(id: string) {
  toastMessages = toastMessages.filter((m) => m.id !== id);
  toastListeners.forEach((fn) => fn(toastMessages));
}

export function showToast(text: string, opts?: boolean | ToastOpts) {
  // Normalise the second arg: a boolean means { error: <bool> }
  const resolved: ToastOpts = typeof opts === 'boolean' ? { error: opts } : (opts ?? {});
  const { error, action } = resolved;
  // Action toasts linger longer so the user has time to click
  const duration = resolved.durationMs ?? (action ? 8000 : 3000);

  const id = Math.random().toString(36).slice(2);
  toastMessages = [...toastMessages, { id, text, error, action }];
  toastListeners.forEach((fn) => fn(toastMessages));
  setTimeout(() => dismissToast(id), duration);
}

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastListeners.push(setMessages);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== setMessages);
    };
  }, []);

  if (messages.length === 0) return null;

  return createPortal(
    <div style={{
      position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999,
      // Container is pointer-transparent; individual toasts opt-in below
      pointerEvents: 'none',
    }}>
      {messages.map((m) => (
        <div key={m.id} style={{
          background: m.error ? '#7f1d1d' : '#1e293b',
          color: m.error ? '#fca5a5' : '#f3f3f3',
          border: `1px solid ${m.error ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 8, padding: '8px 16px',
          fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 12,
          // Each toast receives pointer events so action buttons are clickable
          pointerEvents: 'auto',
        }}>
          <span>{m.text}</span>
          {m.action && (
            <button
              onClick={() => { m.action!.run(); dismissToast(m.id); }}
              style={{
                background: 'transparent', border: `1px solid var(--color-accent)`,
                color: 'var(--color-accent)', borderRadius: 4,
                padding: '2px 10px', fontSize: 12, cursor: 'pointer',
                fontWeight: 600, flexShrink: 0,
              }}
            >
              {m.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body
  );
}
