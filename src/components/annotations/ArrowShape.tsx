import { Arrow } from 'react-konva';
import type { ArrowAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: ArrowAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<ArrowAnno>, pushHistory?: boolean) => void;
}

export function ArrowShape({ anno, onSelect, onChange }: Props) {
  return (
    <Arrow
      id={anno.id}
      points={anno.points}
      stroke={anno.stroke}
      strokeWidth={anno.strokeWidth}
      fill={anno.stroke}
      pointerLength={12}
      pointerWidth={10}
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
