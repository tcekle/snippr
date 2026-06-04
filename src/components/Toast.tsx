import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ToastMessage {
  id: string;
  text: string;
  error?: boolean;
}

let toastListeners: ((msgs: ToastMessage[]) => void)[] = [];
let toastMessages: ToastMessage[] = [];

export function showToast(text: string, error?: boolean) {
  const id = Math.random().toString(36).slice(2);
  toastMessages = [...toastMessages, { id, text, error }];
  toastListeners.forEach((fn) => fn(toastMessages));
  setTimeout(() => {
    toastMessages = toastMessages.filter((m) => m.id !== id);
    toastListeners.forEach((fn) => fn(toastMessages));
  }, 3000);
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
        }}>
          {m.text}
        </div>
      ))}
    </div>,
    document.body
  );
}
