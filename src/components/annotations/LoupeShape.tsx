import { Image as KonvaImage, Rect, Line } from 'react-konva';
import type { LoupeAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: LoupeAnno;
  imageEl: HTMLImageElement;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<LoupeAnno>, pushHistory?: boolean) => void;
}

export function LoupeShape({ anno, imageEl, onSelect, onChange }: Props) {
  const side = anno.size * anno.zoom;
  const srcCx = anno.srcX + anno.size / 2;
  const srcCy = anno.srcY + anno.size / 2;
  const lensCx = anno.x + side / 2;
  const lensCy = anno.y + side / 2;

  return (
    <>
      {anno.connector && (
        <Line points={[srcCx, srcCy, lensCx, lensCy]}
          stroke={anno.borderColor} strokeWidth={1.5} dash={[5, 4]} listening={false} />
      )}
      {anno.showSource && (
        <Rect x={anno.srcX} y={anno.srcY} width={anno.size} height={anno.size}
          stroke={anno.borderColor} strokeWidth={1.5} dash={[5, 4]} listening={false}
          cornerRadius={anno.shape === 'circle' ? anno.size / 2 : 4} />
      )}
      <KonvaImage
        id={anno.id}
        x={anno.x}
        y={anno.y}
        width={side}
        height={side}
        image={imageEl}
        crop={{ x: anno.srcX, y: anno.srcY, width: anno.size, height: anno.size }}
        cornerRadius={anno.shape === 'circle' ? side / 2 : 6}
        stroke={anno.borderColor}
        strokeWidth={anno.borderWidth}
        shadowColor="#000" shadowBlur={12} shadowOpacity={0.4} shadowOffsetY={4}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e: KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }, true)}
      />
    </>
  );
}
