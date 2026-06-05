import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Rect } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { SpotlightAnno } from '../../types/annotations';
import { buildSpotlightCanvas } from '../../utils/buildSpotlightCanvas';

interface Props {
  anno: SpotlightAnno;
  docW: number; docH: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<SpotlightAnno>, pushHistory?: boolean) => void;
}

export function SpotlightShape({ anno, docW, docH, onSelect, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const veilRef = useRef<Konva.Image | null>(null);

  useEffect(() => {
    const canvas = buildSpotlightCanvas(docW, docH,
      { x: anno.x, y: anno.y, width: anno.width, height: anno.height },
      anno.shape, anno.dim, anno.feather, anno.invert);
    canvasRef.current = canvas;
    if (veilRef.current) { veilRef.current.image(canvas); veilRef.current.getLayer()?.batchDraw(); }
  }, [docW, docH, anno.x, anno.y, anno.width, anno.height, anno.shape, anno.dim, anno.feather, anno.invert]);

  return (
    <>
      {/* the veil — not interactive */}
      <KonvaImage ref={veilRef} x={0} y={0} width={docW} height={docH}
        image={canvasRef.current ?? undefined} listening={false} />
      {/* transparent handle on the lit region — carries the id for select/transform */}
      <Rect
        id={anno.id}
        x={anno.x} y={anno.y} width={anno.width} height={anno.height}
        fill="transparent"
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e: KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }, true)}
      />
    </>
  );
}
