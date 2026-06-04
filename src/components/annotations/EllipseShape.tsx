import { Ellipse } from 'react-konva';
import type { EllipseAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: EllipseAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<EllipseAnno>, pushHistory?: boolean) => void;
}

export function EllipseShape({ anno, onSelect, onChange }: Props) {
  return (
    <Ellipse
      id={anno.id}
      x={anno.x}
      y={anno.y}
      radiusX={anno.radiusX}
      radiusY={anno.radiusY}
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
