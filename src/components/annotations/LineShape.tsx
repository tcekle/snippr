import { Line } from 'react-konva';
import type { LineAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: LineAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<LineAnno>, pushHistory?: boolean) => void;
}

export function LineShape({ anno, onSelect, onChange }: Props) {
  return (
    <Line
      id={anno.id}
      points={anno.points}
      stroke={anno.stroke}
      strokeWidth={anno.strokeWidth}
      lineCap="round"
      lineJoin="round"
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        const dx = e.target.x();
        const dy = e.target.y();
        e.target.position({ x: 0, y: 0 });
        onChange({
          points: anno.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
        }, true);
      }}
    />
  );
}
