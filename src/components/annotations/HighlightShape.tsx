import { Line } from 'react-konva';
import type { HighlightAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: HighlightAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<HighlightAnno>, pushHistory?: boolean) => void;
}

export function HighlightShape({ anno, onSelect, onChange }: Props) {
  return (
    <Line
      id={anno.id}
      points={anno.points}
      stroke={anno.stroke}
      strokeWidth={anno.strokeWidth * 4}
      opacity={0.45}
      lineCap="round"
      lineJoin="round"
      tension={0.5}
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
