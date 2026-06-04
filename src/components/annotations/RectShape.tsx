import { Rect } from 'react-konva';
import type { RectAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: RectAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<RectAnno>, pushHistory?: boolean) => void;
}

export function RectShape({ anno, onSelect, onChange }: Props) {
  return (
    <Rect
      id={anno.id}
      x={anno.x}
      y={anno.y}
      width={anno.width}
      height={anno.height}
      stroke={anno.stroke}
      strokeWidth={anno.strokeWidth}
      fill="transparent"
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        onChange({ x: e.target.x(), y: e.target.y() }, true);
      }}
    />
  );
}
