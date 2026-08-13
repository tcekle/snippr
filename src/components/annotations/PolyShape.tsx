import { useMemo } from 'react';
import { Line, Path } from 'react-konva';
import type { ShapeAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import { shapePoints } from '../../utils/shapeGeometry';
import { roughPolygon, sketchOpts, hitWidth } from '../../utils/roughPath';

interface Props {
  anno: ShapeAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<ShapeAnno>, pushHistory?: boolean) => void;
}

/** Triangle / diamond / star — a closed polygon computed from the bounding box. */
export function PolyShape({ anno, onSelect, onChange }: Props) {
  const points = useMemo(
    () => shapePoints(anno.shape, anno.width, anno.height),
    [anno.shape, anno.width, anno.height],
  );

  const sketched = useMemo(
    () => (anno.sketch ? roughPolygon(points, sketchOpts(anno, anno.strokeWidth)) : null),
    [anno.sketch, points, anno.seed, anno.roughness, anno.strokeWidth, anno.id],
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
    <Line
      id={anno.id}
      x={anno.x}
      y={anno.y}
      points={points}
      closed
      stroke={anno.stroke}
      strokeWidth={anno.strokeWidth}
      lineJoin="round"
      fill="transparent"
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
    />
  );
}
