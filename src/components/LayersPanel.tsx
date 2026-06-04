import { useEditorStore } from '../store/editorStore';
import type { Annotation } from '../types/annotations';

function describe(anno: Annotation): { glyph: string; label: string } {
  switch (anno.type) {
    case 'rect':      return { glyph: '▭', label: 'Rectangle' };
    case 'ellipse':   return { glyph: '◯', label: 'Ellipse' };
    case 'arrow':     return { glyph: '➔', label: 'Arrow' };
    case 'line':      return { glyph: '╱', label: 'Line' };
    case 'pen':       return { glyph: '✎', label: 'Pen' };
    case 'highlight': return { glyph: '▆', label: 'Highlight' };
    case 'text':      return { glyph: 'T', label: anno.text ? `“${anno.text}”` : 'Text' };
    case 'badge':     return { glyph: '●', label: `Badge ${anno.number}` };
    case 'pixelate':  return { glyph: '▦', label: 'Pixelate' };
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
          const { glyph, label } = describe(anno);
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
              <span style={{ width: 16, textAlign: 'center', fontSize: 12, opacity: 0.85, flexShrink: 0 }}>{glyph}</span>
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
