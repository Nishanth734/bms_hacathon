import React, { useState } from 'react';
import type { CaseListItem } from '../types';
import { Badge } from './ui/Badge';

interface CaseListProps {
  cases: CaseListItem[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  loading: boolean;
}

export const CaseList: React.FC<CaseListProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  loading,
}) => {
  const [typologyFilter, setTypologyFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0.0);
  const [search, setSearch] = useState<string>('');

  const filtered = cases.filter((c) => {
    if (typologyFilter !== 'all') {
      const match = c.typology.some((t) => t.toLowerCase().includes(typologyFilter.toLowerCase()));
      if (!match) return false;
    }
    if (c.risk_score < minScore) return false;
    if (search && !c.cluster_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-bg-ivory)',
        borderRight: 'var(--border-card)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: 'var(--border-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Suspicious Cases</h2>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              backgroundColor: 'var(--color-bg-sand)',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {filtered.length} found
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search cluster ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-linen)',
              backgroundColor: 'var(--color-bg-white)',
              outline: 'none',
              color: 'var(--color-ink)',
            }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={typologyFilter}
              onChange={(e) => setTypologyFilter(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-linen)',
                backgroundColor: 'var(--color-bg-white)',
                color: 'var(--color-ink)',
              }}
            >
              <option value="all">All Typologies</option>
              <option value="cycle">Cycle</option>
              <option value="fan_out">Fan-Out</option>
              <option value="fan_in">Fan-In</option>
              <option value="pass_through">Pass-Through</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-ink-muted)' }}>
              <span>Min: {Math.round(minScore * 100)}%</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            value={minScore}
            onChange={(e) => setMinScore(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-teal-deep)' }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {loading && cases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-ink-muted)' }}>
            Loading cases...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-ink-muted)' }}>
            No cases match the filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map((item) => {
              const isSelected = item.cluster_id === selectedCaseId;
              const scorePct = Math.round(item.risk_score * 100);

              let scoreColor = 'var(--color-olive)';
              if (item.risk_score >= 0.8) scoreColor = '#c44536';
              else if (item.risk_score >= 0.6) scoreColor = '#d97706';

              return (
                <div
                  key={item.cluster_id}
                  onClick={() => onSelectCase(item.cluster_id)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-card)',
                    border: isSelected ? '1.5px solid var(--color-teal-deep)' : 'var(--border-card)',
                    backgroundColor: isSelected ? 'var(--color-bg-mint-soft)' : 'var(--color-bg-white)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {item.typology.map((typ) => (
                        <Badge key={typ} typology={typ} />
                      ))}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: scoreColor }}>
                      {scorePct}% Risk
                    </span>
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-secondary)', marginBottom: '8px' }}>
                    {item.cluster_id}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                    <span>{item.account_count || item.size} accounts</span>
                    <span>{item.edge_count} txs</span>
                    <span>{item.duration_hours.toFixed(1)}h window</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: '8px', height: '3px', backgroundColor: 'var(--color-bg-sand)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${scorePct}%`, height: '100%', backgroundColor: scoreColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
