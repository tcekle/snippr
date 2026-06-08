import { useEffect, useRef } from 'react';
import { EditorCanvas } from '../components/EditorCanvas';
import { runCliRender } from './runCliRender';

/** Headless render host for `snippr generate`. Mounts the real EditorCanvas in a
 *  hidden Tauri window so the Konva stage exists, then runs the render job once.
 *  The window is never shown; bytes go back to Rust and the process exits. */
export function CliRender() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode double-invoke guard
    started.current = true;
    void runCliRender();
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <EditorCanvas />
    </div>
  );
}
