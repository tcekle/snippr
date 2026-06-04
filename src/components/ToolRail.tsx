import React from 'react';
import { useEditorStore } from '../store/editorStore';
import type { ToolType } from '../types/annotations';

interface ToolItem {
  tool: ToolType;
  label: string;
  hotkey: string;
  /** Number-row shortcut for the most-used tools (also shown as a corner badge). */
  num?: string;
  icon: React.ReactNode;
}

const TOOLS: ToolItem[] = [
  { tool: 'select', label: 'Select', hotkey: 'V', icon: <SelectIcon /> },
  { tool: 'rect', label: 'Rectangle', hotkey: 'R', num: '2', icon: <RectIcon /> },
  { tool: 'ellipse', label: 'Ellipse', hotkey: 'E', icon: <EllipseIcon /> },
  { tool: 'arrow', label: 'Arrow', hotkey: 'A', num: '3', icon: <ArrowIcon /> },
  { tool: 'line', label: 'Line', hotkey: 'L', num: '1', icon: <LineIcon /> },
  { tool: 'pen', label: 'Pen', hotkey: 'P', num: '5', icon: <PenIcon /> },
  { tool: 'highlight', label: 'Highlight', hotkey: 'H', icon: <HighlightIcon /> },
  { tool: 'text', label: 'Text', hotkey: 'T', num: '4', icon: <TextIcon /> },
  { tool: 'badge', label: 'Badge', hotkey: 'B', icon: <BadgeIcon /> },
  { tool: 'pixelate', label: 'Pixelate', hotkey: 'X', icon: <PixelateIcon /> },
  { tool: 'crop', label: 'Crop', hotkey: 'C', icon: <CropIcon /> },
];

export function ToolRail() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div style={{
      width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 0', gap: 4, background: 'var(--color-elevated)',
      borderRight: '1px solid var(--color-border)', overflow: 'hidden',
    }}>
      {TOOLS.map((item) => (
        <ToolButton
          key={item.tool}
          item={item}
          active={activeTool === item.tool}
          onClick={() => setTool(item.tool)}
        />
      ))}
    </div>
  );
}

function ToolButton({ item, active, onClick }: { item: ToolItem; active: boolean; onClick: () => void }) {
  return (
    <button
      title={`${item.label} (${item.num ? `${item.num} or ${item.hotkey}` : item.hotkey})`}
      onClick={onClick}
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
      {item.num && (
        <span style={{
          position: 'absolute', bottom: 2, right: 4,
          fontSize: 9, lineHeight: 1, opacity: active ? 0.9 : 0.55,
          fontWeight: 600,
        }}>
          {item.num}
        </span>
      )}
    </button>
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
