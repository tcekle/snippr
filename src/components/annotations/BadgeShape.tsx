import { Group, Circle, Text } from 'react-konva';
import type { BadgeAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: BadgeAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<BadgeAnno>, pushHistory?: boolean) => void;
}

export function BadgeShape({ anno, onSelect, onChange }: Props) {
  return (
    <Group
      id={anno.id}
      x={anno.x}
      y={anno.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        onChange({ x: e.target.x(), y: e.target.y() }, true);
      }}
    >
      <Circle radius={anno.radius} fill={anno.fill} />
      <Text
        text={String(anno.number)}
        fill="white"
        fontStyle="bold"
        fontSize={anno.radius}
        width={anno.radius * 2}
        height={anno.radius * 2}
        offsetX={anno.radius}
        offsetY={anno.radius}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}
