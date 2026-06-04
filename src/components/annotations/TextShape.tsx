import { Text } from 'react-konva';
import type { TextAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: TextAnno;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onChange: (partial: Partial<TextAnno>, pushHistory?: boolean) => void;
}

export function TextShape({ anno, editing, onSelect, onEdit, onChange }: Props) {
  if (editing) return null;
  return (
    <Text
      id={anno.id}
      x={anno.x}
      y={anno.y}
      text={anno.text}
      fontSize={anno.fontSize}
      fill={anno.fill}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onEdit}
      onDblTap={onEdit}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        onChange({ x: e.target.x(), y: e.target.y() }, true);
      }}
    />
  );
}
