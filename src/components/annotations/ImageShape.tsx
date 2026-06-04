import { Image as KonvaImage } from 'react-konva';
import type { ImageAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  anno: ImageAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<ImageAnno>, pushHistory?: boolean) => void;
}

export function ImageShape({ anno, onSelect, onChange }: Props) {
  return (
    <KonvaImage
      id={anno.id}
      image={anno.imageEl}
      x={anno.x}
      y={anno.y}
      width={anno.width}
      height={anno.height}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        onChange({ x: e.target.x(), y: e.target.y() }, true);
      }}
    />
  );
}
