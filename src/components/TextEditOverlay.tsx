import React, { useRef, useEffect } from 'react';
import type Konva from 'konva';
import type { TextAnno } from '../types/annotations';

interface Props {
  anno: TextAnno;
  /** anno.x/y projected into stage/document space (differs when a crop
   *  straighten rotates the annotation layer); falls back to anno.x/y. */
  docPos?: { x: number; y: number };
  stageRef: React.RefObject<Konva.Stage | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  view: { scale: number; x: number; y: number };
  onCommit: (text: string) => void;
}

export function TextEditOverlay({ anno, docPos, view, onCommit, containerRef }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const containerRect = containerRef.current?.getBoundingClientRect();
  const anchor = docPos ?? { x: anno.x, y: anno.y };
  const screenX = anchor.x * view.scale + view.x + (containerRect?.left ?? 0);
  const screenY = anchor.y * view.scale + view.y + (containerRect?.top ?? 0);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(textareaRef.current?.value ?? anno.text);
  };

  return (
    <textarea
      ref={textareaRef}
      defaultValue={anno.text}
      placeholder="Text"
      style={{
        position: 'fixed',
        left: screenX,
        top: screenY,
        fontSize: anno.fontSize * view.scale,
        color: anno.fill,
        background: 'transparent',
        border: '1px dashed rgba(255,255,255,0.4)',
        outline: 'none',
        resize: 'none',
        padding: '2px 4px',
        minWidth: 60,
        minHeight: anno.fontSize * view.scale + 8,
        fontFamily: 'inherit',
        lineHeight: 1.2,
        zIndex: 1000,
        overflow: 'hidden',
      }}
      onKeyDown={(e) => {
        // Esc behaves like clicking outside: commit what's typed
        // (commit of empty text deletes the annotation).
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); commit(); }
      }}
      onBlur={commit}
    />
  );
}
