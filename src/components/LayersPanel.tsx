import { useEditorStore } from '../store/editorStore';
import type { Annotation } from '../types/annotations';

function describe(anno: Annotation): string {
  switch (anno.type) {
    case 'rect':      return 'Rectangle';
    case 'ellipse':   return 'Ellipse';
    case 'arrow':     return 'Arrow';
    case 'line':      return 'Line';
    case 'pen':       return 'Pen';
    case 'highlight': return 'Highlight';
    case 'text':      return anno.text ? `“${anno.text}”` : 'Text';
    case 'badge':     return `Badge ${anno.number}`;
    case 'pixelate':  return 'Pixelate';
    case 'image':     return 'Image';
  }
}

const PV_W = 30;
const PV_H = 20;
const PV_PAD = 3;

/** Scale a points array into the preview box, centered, aspect preserved. Returns [x,y,...]. */
function fitPoints(points: number[], maxPts = 40): number[] {
  // Down-sample long pen strokes
  let pts = points;
  const count = points.length / 2;
  if (count > maxPts) {
    const stride = Math.ceil(count / maxPts);
    const sampled: number[] = [];
    for (let i = 0; i < count; i += stride) {
      sampled.push(points[i * 2], points[i * 2 + 1]);
    }
    // Always keep the final point
    sampled.push(points[points.length - 2], points[points.length - 1]);
    pts = sampled;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((PV_W - 2 * PV_PAD) / spanX, (PV_H - 2 * PV_PAD) / spanY);
  const offX = (PV_W - spanX * scale) / 2;
  const offY = (PV_H - spanY * scale) / 2;
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    out.push((pts[i] - minX) * scale + offX, (pts[i + 1] - minY) * scale + offY);
  }
  return out;
}

function toPolyline(pts: number[]): string {
  const segs: string[] = [];
  for (let i = 0; i < pts.length; i += 2) segs.push(`${pts[i].toFixed(1)},${pts[i + 1].toFixed(1)}`);
  return segs.join(' ');
}

/** Tiny SVG preview drawn from the annotation's real geometry and color. */
function AnnotationPreview({ anno }: { anno: Annotation }) {
  const box = { width: PV_W, height: PV_H, flexShrink: 0 } as const;
  switch (anno.type) {
    case 'rect': {
      const scale = Math.min((PV_W - 2 * PV_PAD) / Math.max(anno.width, 1), (PV_H - 2 * PV_PAD) / Math.max(anno.height, 1));
      const w = Math.max(anno.width * scale, 2);
      const h = Math.max(anno.height * scale, 2);
      return (
        <svg {...box}>
          <rect x={(PV_W - w) / 2} y={(PV_H - h) / 2} width={w} height={h}
            stroke={anno.stroke} strokeWidth={1.5} fill="none" />
        </svg>
      );
    }
    case 'ellipse': {
      const scale = Math.min((PV_W - 2 * PV_PAD) / Math.max(anno.radiusX * 2, 1), (PV_H - 2 * PV_PAD) / Math.max(anno.radiusY * 2, 1));
      return (
        <svg {...box}>
          <ellipse cx={PV_W / 2} cy={PV_H / 2}
            rx={Math.max(anno.radiusX * scale, 1.5)} ry={Math.max(anno.radiusY * scale, 1.5)}
            stroke={anno.stroke} strokeWidth={1.5} fill="none" />
        </svg>
      );
    }
    case 'arrow': {
      const pts = fitPoints(anno.points);
      const n = pts.length;
      const [x2, y2] = [pts[n - 2], pts[n - 1]];
      const [x1, y1] = [pts[n - 4] ?? x2 - 1, pts[n - 3] ?? y2];
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 4;
      const head = (da: number) =>
        `${(x2 - headLen * Math.cos(angle + da)).toFixed(1)},${(y2 - headLen * Math.sin(angle + da)).toFixed(1)}`;
      return (
        <svg {...box}>
          <polyline points={toPolyline(pts)} stroke={anno.stroke} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <polyline points={`${head(-0.5)} ${x2.toFixed(1)},${y2.toFixed(1)} ${head(0.5)}`}
            stroke={anno.stroke} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    case 'line':
    case 'pen':
      return (
        <svg {...box}>
          <polyline points={toPolyline(fitPoints(anno.points))}
            stroke={anno.stroke} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'highlight':
      return (
        <svg {...box}>
          <polyline points={toPolyline(fitPoints(anno.points))}
            stroke={anno.stroke} strokeWidth={5} opacity={0.55} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'text':
      return (
        <svg {...box}>
          <text x={PV_W / 2} y={PV_H / 2 + 4.5} textAnchor="middle"
            fill={anno.fill} fontSize={13} fontWeight={700} fontFamily="serif">T</text>
        </svg>
      );
    case 'badge':
      return (
        <svg {...box}>
          <circle cx={PV_W / 2} cy={PV_H / 2} r={8} fill={anno.fill} />
          <text x={PV_W / 2} y={PV_H / 2 + 3.5} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}>
            {anno.number}
          </text>
        </svg>
      );
    case 'pixelate':
      return (
        <svg {...box}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={PV_W / 2 - 8 + (i % 2) * 8} y={PV_H / 2 - 8 + Math.floor(i / 2) * 8}
              width={8} height={8} fill="#9ca3af" opacity={i % 3 === 0 ? 0.8 : 0.4} />
          ))}
        </svg>
      );
    case 'image': {
      const scale = Math.min((PV_W - 2 * PV_PAD) / Math.max(anno.width, 1), (PV_H - 2 * PV_PAD) / Math.max(anno.height, 1));
      const w = Math.max(anno.width * scale, 2);
      const h = Math.max(anno.height * scale, 2);
      return (
        <svg {...box}>
          <image href={anno.src} x={(PV_W - w) / 2} y={(PV_H - h) / 2} width={w} height={h}
            preserveAspectRatio="xMidYMid slice" />
        </svg>
      );
    }
  }
}

export function LayersPanel() {
  const { annotations, selectedId, selectAnnotation, deleteAnnotation, setEditingTextId } = useEditorStore();

  // Newest (topmost in z-order) first
  const rows = [...annotations].reverse();

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      borderTop: '1px solid var(--color-border)',
    }}>
      <div style={{
        padding: '10px 14px 6px',
        color: 'var(--color-text-muted)', fontSize: 11,
        textTransform: 'uppercase', letterSpacing: 0.8,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Layers</span>
        <span>{annotations.length}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 6px 8px' }}>
        {rows.length === 0 && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 12, padding: '8px 8px' }}>
            No annotations yet
          </div>
        )}
        {rows.map((anno) => {
          const label = describe(anno);
          const selected = anno.id === selectedId;
          return (
            <div
              key={anno.id}
              onClick={() => selectAnnotation(anno.id)}
              onDoubleClick={() => {
                selectAnnotation(anno.id);
                if (anno.type === 'text') setEditingTextId(anno.id);
              }}
              title={anno.type === 'text' ? 'Double-click to edit text' : label}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                background: selected ? 'var(--color-accent)' : 'transparent',
                color: selected ? '#fff' : 'var(--color-text)',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)', borderRadius: 4, flexShrink: 0,
              }}>
                <AnnotationPreview anno={anno} />
              </span>
              <span style={{
                flex: 1, fontSize: 13, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteAnnotation(anno.id); }}
                title="Delete"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: selected ? '#fff' : 'var(--color-text-muted)',
                  fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 4, flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
