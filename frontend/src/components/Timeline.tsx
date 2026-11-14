import React from 'react';
import type { GraphEdge } from '../types';

interface TimelineProps {
  edges: GraphEdge[];
  highlightedEdgeIds: string[];
  onHoverEdge: (edgeId: string) => void;
  onLeaveEdge: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  edges,
  highlightedEdgeIds,
  onHoverEdge,
  onLeaveEdge,
}) => {
  if (!edges || edges.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-ink-muted)', fontSize: '12px' }}>
        No transactions in this cluster.
      </div>
    );
  }

  // Sort chronologically
  const sorted = [...edges].sort((a, b) => {
    const tA = a.timestamp || (a.ts ? new Date(a.ts).getTime() : 0);
    const tB = b.timestamp || (b.ts ? new Date(b.ts).getTime() : 0);
    return tA - tB;
  });
  const maxAmount = Math.max(...sorted.map((e) => e.amount), 1);

  return (
    <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-white)', borderRadius: 'var(--radius-card)', border: 'var(--border-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Transaction Timeline</h3>
        <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
          {sorted.length} events ordered chronologically
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {sorted.map((edge, idx) => {
          const edgeId = edge.id || edge.edge_id || `e-${idx}`;
          const isHighlighted = highlightedEdgeIds.includes(edgeId);
          const barHeightPct = Math.max(15, Math.round((edge.amount / maxAmount) * 100));
          const tsStr = edge.ts || (edge.timestamp ? new Date(edge.timestamp * 1000).toISOString() : '');

          return (
            <div
              key={edgeId}
              onMouseEnter={() => onHoverEdge(edgeId)}
              onMouseLeave={onLeaveEdge}
              style={{
                flex: '0 0 110px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '8px',
                borderRadius: 'var(--radius-card)',
                backgroundColor: isHighlighted ? 'var(--color-bg-mint-soft)' : 'var(--color-bg-cream)',
                border: isHighlighted ? '1.5px solid var(--color-teal-deep)' : '1px solid rgba(43,43,41,0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Amount bar */}
              <div
                style={{
                  width: '18px',
                  height: `${barHeightPct}px`,
                  backgroundColor: isHighlighted ? 'var(--color-teal-deep)' : 'var(--color-accent-sage)',
                  borderRadius: '3px 3px 0 0',
                  marginBottom: '8px',
                  transition: 'height 0.2s ease',
                }}
              />

              <div style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {edge.amount >= 1000 ? `$${(edge.amount / 1000).toFixed(1)}k` : `${edge.amount.toFixed(2)} ${edge.currency || 'ETH'}`}
              </div>

              <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', textAlign: 'center', marginTop: '2px' }}>
                {tsStr ? (tsStr.length > 16 ? tsStr.slice(11, 16) : tsStr.slice(0, 10)) : `Tx #${idx + 1}`}
              </div>

              <div
                style={{
                  fontSize: '9px',
                  color: 'var(--color-ink-secondary)',
                  marginTop: '4px',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100px',
                }}
              >
                {edge.source.split('_')[1] || edge.source} → {edge.target.split('_')[1] || edge.target}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
