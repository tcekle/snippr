import { useEditorStore } from '../store/editorStore';

export function TabsBar() {
  const { tabs, activeTabId, switchTab, closeTab } = useEditorStore();

  if (tabs.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 2,
      background: 'var(--color-elevated)',
      borderBottom: '1px solid var(--color-border)',
      padding: '4px 6px 0', overflowX: 'auto', flexShrink: 0,
    }}>
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            onAuxClick={(e) => { if (e.button === 1) closeTab(tab.id); }}
            title={tab.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 6px 5px 12px',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer', userSelect: 'none',
              fontSize: 12, whiteSpace: 'nowrap',
              background: active ? '#181818' : 'transparent',
              color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
              borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            {tab.kind === 'video' && (
              <span style={{ fontSize: 9, color: active ? 'var(--color-accent)' : 'inherit' }}>▶</span>
            )}
            <span>{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              title="Close tab (Ctrl+W)"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'inherit', fontSize: 13, lineHeight: 1,
                padding: '2px 4px', borderRadius: 4,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
