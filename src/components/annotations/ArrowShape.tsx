import { useMemo } from 'react';
import { Arrow, Group, Line, Path } from 'react-konva';
import type { ArrowAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  roughLeader, roughPolyline, smoothLeaderPath, leaderTangent, arrowBarbs,
  sketchOpts, hitWidth,
} from '../../utils/roughPath';

interface Props {
  anno: ArrowAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<ArrowAnno>, pushHistory?: boolean) => void;
}

/** Head size tracks the stroke so a heavy leader does not end in a pin. At the
 *  default stroke width of 4 and headScale 1 this reproduces Konva's 12/10
 *  exactly, so an arrow drawn at the default weight is unchanged.
 *
 *  Konva's own pointerLength/pointerWidth are FIXED, which is the bug this
 *  replaces: raise the stroke to 12 and a 12px head vanishes into a 12px-wide
 *  shaft. Head size has to track the stroke to stay readable. */
const headLength = (sw: number, scale: number) => sw * 3 * scale;
const headHalfWidth = (sw: number, scale: number) => sw * 1.25 * scale;

export function ArrowShape({ anno, onSelect, onChange }: Props) {
  const curve = anno.curve ?? 0;
  const bowed = Math.abs(curve) >= 0.01;
  const headScale = anno.headScale ?? 1;

  const geom = useMemo(() => {
    if (!anno.sketch && !bowed) return null;
    const [x1, y1, x2, y2] = anno.points;
    const angle = leaderTangent(x1, y1, x2, y2, curve);
    const barbs = arrowBarbs(x2, y2, angle, headLength(anno.strokeWidth, headScale), headHalfWidth(anno.strokeWidth, headScale));
    if (!anno.sketch) {
      return { shaft: smoothLeaderPath(x1, y1, x2, y2, curve), barbs, sketched: false as const };
    }
    const o = sketchOpts(anno, anno.strokeWidth);
    return {
      shaft: roughLeader(x1, y1, x2, y2, curve, o).stroke,
      // Barbs get their own seeded pass so the head wobbles with the shaft.
      barbPath: roughPolyline(barbs, o).stroke,
      barbs,
      sketched: true as const,
    };
  }, [anno.sketch, anno.points, anno.seed, anno.roughness, anno.strokeWidth, anno.id, curve, bowed, headScale]);

  const onDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const dx = e.target.x();
    const dy = e.target.y();
    e.target.position({ x: 0, y: 0 });
    onChange({
      points: anno.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
    }, true);
  };

  // Plain straight arrow — unchanged.
  if (!geom) {
    return (
      <Arrow
        id={anno.id}
        points={anno.points}
        stroke={anno.stroke}
        strokeWidth={anno.strokeWidth}
        fill={anno.stroke}
        pointerLength={headLength(anno.strokeWidth, headScale)}
        pointerWidth={headHalfWidth(anno.strokeWidth, headScale) * 2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={onDragEnd}
      />
    );
  }

  return (
    <Group
      id={anno.id}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
    >
      <Path
        data={geom.shaft}
        stroke={anno.stroke}
        strokeWidth={anno.strokeWidth}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={hitWidth(anno.strokeWidth)}
      />
      {geom.sketched ? (
        <Path
          data={geom.barbPath}
          stroke={anno.stroke}
          strokeWidth={anno.strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      ) : (
        <Line points={geom.barbs} closed fill={anno.stroke} stroke={anno.stroke} strokeWidth={anno.strokeWidth} lineJoin="round" />
      )}
    </Group>
  );
}
