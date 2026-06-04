import { useEffect, useRef } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type { PixelateAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { buildPixelateCanvas } from '../../utils/buildPixelateCanvas';

interface Props {
  anno: PixelateAnno;
  imageEl: HTMLImageElement;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<PixelateAnno>, pushHistory?: boolean) => void;
}

export function PixelateShape({ anno, imageEl, onSelect, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodeRef = useRef<Konva.Image | null>(null);

  useEffect(() => {
    if (!imageEl || anno.width <= 0 || anno.height <= 0) return;
    const canvas = buildPixelateCanvas(
      imageEl,
      { x: anno.x, y: anno.y, width: anno.width, height: anno.height },
      anno.pixelSize
    );
    canvasRef.current = canvas;
    if (nodeRef.current) {
      nodeRef.current.image(canvas);
      nodeRef.current.getLayer()?.batchDraw();
    }
  }, [imageEl, anno.x, anno.y, anno.width, anno.height, anno.pixelSize]);

  return (
    <KonvaImage
      id={anno.id}
      ref={nodeRef}
      x={anno.x}
      y={anno.y}
      width={anno.width}
      height={anno.height}
      image={canvasRef.current ?? undefined}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        onChange({ x: e.target.x(), y: e.target.y() }, true);
      }}
    />
  );
}
