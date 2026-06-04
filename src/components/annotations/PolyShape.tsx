import { Line } from 'react-konva';
import type { ShapeAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import { shapePoints } from '../../utils/shapeGeometry';

interface Props {
  anno: ShapeAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<ShapeAnno>, pushHistory?: boolean) => void;
}

/** Triangle / diamond / star — a closed polygon computed from the bounding box. */
export function PolyShape({ anno, onSelect, onChange }: Props) {
  return (
    <Line
      id={anno.id}
      x={anno.x}
      y={anno.y}
      points={shapePoints(anno.shape, anno.width, anno.height)}
      closed
      stroke={anno.stroke}
      strokeWidth={anno.strokeWidth}
      lineJoin="round"
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
