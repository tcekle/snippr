import { Group, Rect, Circle } from 'react-konva';
import type { BackdropConfig } from '../types/backdrop';
import { FRAME_BAR_HEIGHT } from '../types/backdrop';
import { backdropBounds, gradientProps } from '../utils/backdropGeometry';

type FillProps =
  | { fill: string }
  | ReturnType<typeof gradientProps>;

export function Backdrop({ b, imgW, imgH }: { b: BackdropConfig; imgW: number; imgH: number }) {
  const bounds = backdropBounds(imgW, imgH, b);
  const bar = FRAME_BAR_HEIGHT[b.frame];
  const r = b.cornerRadius;

  const fillProps: FillProps = b.fill.kind === 'solid'
    ? { fill: b.fill.color }
    : gradientProps(b.fill, bounds);

  return (
    <Group listening={false}>
      {/* backdrop panel */}
      <Rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height}
        cornerRadius={Math.min(20, r + 6)} {...fillProps} />

      {/* drop-shadow card behind the screenshot (+ bar) */}
      {b.shadow && (
        <Rect x={0} y={-bar} width={imgW} height={imgH + bar} cornerRadius={r}
          fill="#ffffff" shadowColor="#000" shadowBlur={40} shadowOpacity={0.35}
          shadowOffsetY={20} />
      )}

      {/* window-frame bar */}
      {b.frame !== 'none' && (
        <>
          <Rect x={0} y={-bar} width={imgW} height={bar}
            cornerRadius={[r, r, 0, 0]} fill="#e9e9ee" />
          <Rect x={0} y={-1} width={imgW} height={1} fill="rgba(0,0,0,0.08)" />
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <Circle key={c} x={16 + i * 18} y={-bar / 2} radius={5.5} fill={c} />
          ))}
          {b.frame === 'browser' && (
            <Rect x={imgW * 0.28} y={-bar / 2 - 10} width={imgW * 0.44} height={20}
              cornerRadius={6} fill="#ffffff" />
          )}
        </>
      )}
    </Group>
  );
}
