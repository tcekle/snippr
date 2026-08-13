import { useMemo } from 'react';
import { Line, Path } from 'react-konva';
import type { LineAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import { roughLeader, roughPolyline, smoothLeaderPath, sketchOpts, hitWidth } from '../../utils/roughPath';

interface Props {
  anno: LineAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<LineAnno>, pushHistory?: boolean) => void;
}

export function LineShape({ anno, onSelect, onChange }: Props) {
  const curve = anno.curve ?? 0;
  const bowed = Math.abs(curve) >= 0.01 && anno.points.length === 4;

  const data = useMemo(() => {
    if (!anno.sketch && !bowed) return null;
    const o = sketchOpts(anno, anno.strokeWidth);
    const [x1, y1, x2, y2] = anno.points;
    if (!anno.sketch) return smoothLeaderPath(x1, y1, x2, y2, curve);
    return bowed
      ? roughLeader(x1, y1, x2, y2, curve, o).stroke
      : roughPolyline(anno.points, o).stroke;
  }, [anno.sketch, anno.points, anno.seed, anno.roughness, anno.strokeWidth, anno.id, curve, bowed]);

  const onDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const dx = e.target.x();
    const dy = e.target.y();
    e.target.position({ x: 0, y: 0 });
    onChange({
      points: anno.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
    }, true);
  };

  if (data !== null) {
    return (
      <Path
        id={anno.id}
        data={data}
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
      points={anno.points}
      stroke={anno.stroke}
      strokeWidth={anno.strokeWidth}
      lineCap="round"
      lineJoin="round"
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
    />
  );
}
