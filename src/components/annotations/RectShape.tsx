import { useMemo } from 'react';
import { Rect, Path } from 'react-konva';
import type { RectAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import { roughRect, sketchOpts, hitWidth } from '../../utils/roughPath';

interface Props {
  anno: RectAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<RectAnno>, pushHistory?: boolean) => void;
}

export function RectShape({ anno, onSelect, onChange }: Props) {
  const sketched = useMemo(
    () => (anno.sketch ? roughRect(anno.width, anno.height, sketchOpts(anno, anno.strokeWidth)) : null),
    [anno.sketch, anno.width, anno.height, anno.seed, anno.roughness, anno.strokeWidth, anno.id],
  );

  const onDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onChange({ x: e.target.x(), y: e.target.y() }, true);
  };

  if (sketched) {
    return (
      <Path
        id={anno.id}
        x={anno.x}
        y={anno.y}
        data={sketched.stroke}
        stroke={anno.stroke}
        strokeWidth={anno.strokeWidth}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={hitWidth(anno.strokeWidth)}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={onDragEnd}
      />
    );
  }

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
      onDragEnd={onDragEnd}
    />
  );
}
