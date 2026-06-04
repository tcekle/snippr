import React, { useRef, useEffect } from 'react';
import type Konva from 'konva';
import type { TextAnno } from '../types/annotations';

interface Props {
  anno: TextAnno;
  stageRef: React.RefObject<Konva.Stage | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  view: { scale: number; x: number; y: number };
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function TextEditOverlay({ anno, view, onCommit, onCancel, containerRef }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const containerRect = containerRef.current?.getBoundingClientRect();
  const screenX = anno.x * view.scale + view.x + (containerRect?.left ?? 0);
  const screenY = anno.y * view.scale + view.y + (containerRect?.top ?? 0);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(textareaRef.current?.value ?? anno.text);
  };

  const cancel = () => {
    if (committed.current) return;
    committed.current = true;
    onCancel();
  };

  return (
    <textarea
      ref={textareaRef}
      defaultValue={anno.text}
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
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      }}
      onBlur={commit}
    />
  );
}
