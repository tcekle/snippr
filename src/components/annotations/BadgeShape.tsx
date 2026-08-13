import { useMemo } from 'react';
import { Group, Circle, Path, Text } from 'react-konva';
import type { BadgeAnno } from '../../types/annotations';
import type { KonvaEventObject } from 'konva/lib/Node';
import { roughCircle, sketchOpts } from '../../utils/roughPath';
import { HAND_FONT } from '../../utils/handFonts';

interface Props {
  anno: BadgeAnno;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<BadgeAnno>, pushHistory?: boolean) => void;
}

export function BadgeShape({ anno, onSelect, onChange }: Props) {
  // Sketch is a rendering change, never a palette change: the badge keeps its
  // fill and its white numeral, and only the edge becomes hand-drawn.
  const sketched = useMemo(
    () => (anno.sketch ? roughCircle(anno.radius, sketchOpts(anno, Math.max(1.5, anno.radius * 0.12), anno.fill)) : null),
    [anno.sketch, anno.radius, anno.seed, anno.roughness, anno.fill, anno.id],
  );

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
      {sketched ? (
        <>
          <Path data={sketched.fill} fill={anno.fill} listening={false} />
          <Path
            data={sketched.stroke}
            stroke={anno.fill}
            strokeWidth={Math.max(1.5, anno.radius * 0.12)}
            lineCap="round"
            lineJoin="round"
          />
          {/* Keeps the interior clickable — the rough paths alone leave a hole. */}
          <Circle radius={anno.radius} fill="transparent" />
        </>
      ) : (
        <Circle radius={anno.radius} fill={anno.fill} />
      )}
      <Text
        text={String(anno.number)}
        fill="white"
        fontStyle="bold"
        fontFamily={anno.sketch ? HAND_FONT : undefined}
        fontSize={anno.radius}
        width={anno.radius * 2}
        height={anno.radius * 2}
        offsetX={anno.radius}
        offsetY={anno.radius}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}
