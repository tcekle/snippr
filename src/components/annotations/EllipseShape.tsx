import { useMemo } from 'react';
import { Ellipse, Path } from 'react-konva';
import type { EllipseAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import { roughEllipse, sketchOpts, hitWidth } from '../../utils/roughPath';

interface Props {
  anno: EllipseAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<EllipseAnno>, pushHistory?: boolean) => void;
}

/** Sketched, this is the marker ring: the house way to point at a control
 *  without recolouring it. */
export function EllipseShape({ anno, onSelect, onChange }: Props) {
  const sketched = useMemo(
    () => (anno.sketch ? roughEllipse(anno.radiusX, anno.radiusY, sketchOpts(anno, anno.strokeWidth)) : null),
    [anno.sketch, anno.radiusX, anno.radiusY, anno.seed, anno.roughness, anno.strokeWidth, anno.id],
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
      onDragEnd={onDragEnd}
    />
  );
}
