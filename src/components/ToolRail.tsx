import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { ToolType } from '../types/annotations';

interface ToolItem {
  tool: ToolType;
  label: string;
  hotkey?: string;
  /** Number-row shortcut for the most-used tools (also shown as a corner badge). */
  num?: string;
  icon: React.ReactNode;
}

/** One rail button. Multiple variants = Photoshop-style flyout group:
 * the button shows the last-used variant; long-press or right-click reveals the rest. */
interface RailEntry {
  variants: ToolItem[];
}

const RAIL: RailEntry[] = [
  { variants: [{ tool: 'select', label: 'Select', hotkey: 'V', icon: <SelectIcon /> }] },
  // Number-row tools in badge order
  { variants: [{ tool: 'line', label: 'Line', hotkey: 'L', num: '1', icon: <LineIcon /> }] },
  {
    // Shape group — long-press for the variants
    variants: [
      { tool: 'rect', label: 'Rectangle', hotkey: 'R', num: '2', icon: <RectIcon /> },
      { tool: 'ellipse', label: 'Ellipse', hotkey: 'E', icon: <EllipseIcon /> },
      { tool: 'triangle', label: 'Triangle', icon: <TriangleIcon /> },
      { tool: 'diamond', label: 'Diamond', icon: <DiamondIcon /> },
      { tool: 'star', label: 'Star', icon: <StarIcon /> },
    ],
  },
  { variants: [{ tool: 'arrow', label: 'Arrow', hotkey: '3', num: '3', icon: <ArrowIcon /> }] },
  { variants: [{ tool: 'text', label: 'Text', hotkey: 'T', num: '4', icon: <TextIcon /> }] },
  { variants: [{ tool: 'pen', label: 'Pen', hotkey: 'P', num: '5', icon: <PenIcon /> }] },
  { variants: [{ tool: 'highlight', label: 'Highlight', hotkey: 'H', icon: <HighlightIcon /> }] },
  { variants: [{ tool: 'badge', label: 'Badge', hotkey: 'B', icon: <BadgeIcon /> }] },
  { variants: [{ tool: 'pixelate', label: 'Pixelate', hotkey: 'X', icon: <PixelateIcon /> }] },
  { variants: [{ tool: 'crop', label: 'Crop', hotkey: 'C', icon: <CropIcon /> }] },
];

const LONG_PRESS_MS = 350;

interface FlyoutState {
  entryIdx: number;
  top: number;
  left: number;
}

export function ToolRail() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  // Last-used variant per grouped entry, so the button keeps showing it
  // after switching to another tool (Photoshop behavior).
  const [lastVariant, setLastVariant] = useState<Record<number, ToolType>>({});

  // Track variant use driven by keyboard shortcuts too, not only flyout clicks
  useEffect(() => {
    RAIL.forEach((entry, idx) => {
      if (entry.variants.length > 1 && entry.variants.some((v) => v.tool === activeTool)) {
        setLastVariant((prev) => (prev[idx] === activeTool ? prev : { ...prev, [idx]: activeTool }));
      }
    });
  }, [activeTool]);

  // Esc closes the flyout before the global handler can deselect/hide
  useEffect(() => {
    if (!flyout) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setFlyout(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [flyout]);

  const currentVariant = (entry: RailEntry, idx: number): ToolItem => {
    const active = entry.variants.find((v) => v.tool === activeTool);
    if (active) return active;
    const remembered = entry.variants.find((v) => v.tool === lastVariant[idx]);
    return remembered ?? entry.variants[0];
  };

  return (
    <div style={{
      width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 0', gap: 4, background: 'var(--color-elevated)',
      borderRight: '1px solid var(--color-border)', overflow: 'hidden',
    }}>
      {RAIL.map((entry, idx) => {
        const item = currentVariant(entry, idx);
        return (
          <ToolButton
            key={entry.variants[0].tool}
            item={item}
            grouped={entry.variants.length > 1}
            active={entry.variants.some((v) => v.tool === activeTool)}
            onActivate={() => setTool(item.tool)}
            onOpenFlyout={(rect) => {
              if (entry.variants.length < 2) return;
              setFlyout({ entryIdx: idx, top: rect.top, left: rect.right + 6 });
            }}
          />
        );
      })}

      {flyout && (
        <ToolFlyout
          entry={RAIL[flyout.entryIdx]}
          top={flyout.top}
          left={flyout.left}
          activeTool={activeTool}
          onPick={(tool) => {
            setTool(tool);
            setLastVariant((prev) => ({ ...prev, [flyout.entryIdx]: tool }));
            setFlyout(null);
          }}
          onClose={() => setFlyout(null)}
        />
      )}
    </div>
  );
}

function ToolButton({ item, grouped, active, onActivate, onOpenFlyout }: {
  item: ToolItem;
  grouped: boolean;
  active: boolean;
  onActivate: () => void;
  onOpenFlyout: (rect: DOMRect) => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const keys = [item.num, item.hotkey].filter((k, i, a) => k && a.indexOf(k) === i);
  const shortcut = keys.length ? ` (${keys.join(' or ')})` : '';
  const title = grouped
    ? `${item.label}${shortcut} — hold or right-click for more shapes`
    : `${item.label}${shortcut}`;

  return (
    <button
      title={title}
      onPointerDown={(e) => {
        if (!grouped || e.button !== 0) return;
        longPressFired.current = false;
        const rect = e.currentTarget.getBoundingClientRect();
        pressTimer.current = window.setTimeout(() => {
          longPressFired.current = true;
          onOpenFlyout(rect);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onClick={() => {
        // The click after a long-press must not re-activate / close the flyout
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        onActivate();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (grouped) onOpenFlyout(e.currentTarget.getBoundingClientRect());
      }}
      style={{
        width: 40, height: 40, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 6, cursor: 'pointer',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted)',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {item.icon}
      {/* Shortcut label: number-row key if assigned, else the letter key.
       * Grouped buttons keep the bottom-right corner for the flyout caret. */}
      {(item.num ?? item.hotkey) && (
        <span style={{
          position: 'absolute', bottom: 2,
          ...(grouped ? { left: 4 } : { right: 4 }),
          fontSize: 9, lineHeight: 1, opacity: active ? 0.9 : 0.55,
          fontWeight: 600,
        }}>
          {item.num ?? item.hotkey}
        </span>
      )}
      {/* Photoshop-style corner caret: this button hides more tools */}
      {grouped && (
        <span style={{
          position: 'absolute', bottom: 3, right: 3,
          width: 0, height: 0,
          borderRight: '5px solid currentColor',
          borderTop: '5px solid transparent',
          opacity: active ? 0.9 : 0.55,
        }} />
      )}
    </button>
  );
}

function ToolFlyout({ entry, top, left, activeTool, onPick, onClose }: {
  entry: RailEntry;
  top: number;
  left: number;
  activeTool: ToolType;
  onPick: (tool: ToolType) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Click-away backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1499 }}
        onPointerDown={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div style={{
        position: 'fixed', top, left, zIndex: 1500,
        display: 'flex', flexDirection: 'column', gap: 2,
        background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: 4,
        boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
      }}>
        {entry.variants.map((v) => {
          const isActive = v.tool === activeTool;
          return (
            <button
              key={v.tool}
              onClick={() => onPick(v.tool)}
              // Press-drag-release (Photoshop muscle memory) also selects
              onPointerUp={() => onPick(v.tool)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px 6px 8px', border: 'none', borderRadius: 6,
                cursor: 'pointer', whiteSpace: 'nowrap',
                background: isActive ? 'var(--color-accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-text)',
                fontSize: 13, textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ display: 'flex', width: 18, justifyContent: 'center' }}>{v.icon}</span>
              <span style={{ flex: 1 }}>{v.label}</span>
              {(v.num ?? v.hotkey) && (
                <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 600 }}>{v.num ?? v.hotkey}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function SelectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 2l12 7-5 1-3 5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EllipseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <ellipse cx="9" cy="9" rx="7" ry="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TriangleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 3l7 12H2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2l7 7-7 7-7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2l2.06 4.45 4.87.52-3.63 3.28.99 4.79L9 12.6l-4.29 2.44.99-4.79-3.63-3.28 4.87-.52z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <line x1="3" y1="15" x2="15" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="9,3 15,3 15,9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <line x1="3" y1="15" x2="15" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 14 Q7 10 9 9 Q11 8 14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="4" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="6" width="14" height="7" rx="3" fill="currentColor" opacity="0.5" />
      <line x1="5" y1="9.5" x2="13" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <text x="2" y="14" fill="currentColor" fontSize="14" fontWeight="bold" fontFamily="serif">T</text>
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" fill="currentColor" opacity="0.8" />
      <text x="9" y="13" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">1</text>
    </svg>
  );
}

function PixelateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="10" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="2" y="10" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="10" y="10" width="6" height="6" rx="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 2v10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 16V6H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
