import React from 'react';
import type { AnalysisSummary, CaseListItem, PageView } from '../types';

interface OverviewProps {
  summary: AnalysisSummary | null;
  cases: CaseListItem[];
  onSelectCase: (caseId: string) => void;
  onNavigate: (view: PageView) => void;
}

export const Overview: React.FC<OverviewProps> = ({ summary, cases, onSelectCase, onNavigate }) => {
  const topCases = cases.slice(0, 5);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div
        style={{
          padding: '20px 24px',
          backgroundColor: 'var(--color-bg-mint)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid rgba(41, 106, 108, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-teal-deep)',
            }}
          >
            Forensic Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', marginTop: '4px', maxWidth: '700px', lineHeight: 1.5 }}>
            TraceFlow discovers coordinated wash trading rings, circular round-trips, and mule relays on temporal wallet graphs. Every alert is grounded in verifiable transaction evidence.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onNavigate('cases')}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-teal-deep)',
              color: 'var(--color-bg-white)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View Cases
          </button>
          <button
            onClick={() => onNavigate('graph')}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-bg-white)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-linen)',
              borderRadius: 'var(--radius-pill)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open Graph
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div
          style={{
            padding: '18px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
            Analyzed Volume
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '4px' }}>
            {summary ? `${summary.total_volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${summary.currency}` : '—'}
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
            Flagged Clusters
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
            {summary?.total_fraud_clusters || 0}
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
            High-Risk Wallets
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
            {summary?.high_risk_wallets || 0}
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
            Active Dataset
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-teal-deep)',
              marginTop: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {summary?.dataset_name || 'Loading...'}
          </div>
        </div>
      </div>

      {/* Main Grid: Typologies & Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Typologies Summary */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Detected Typologies</h3>
            <button
              onClick={() => onNavigate('typologies')}
              style={{
                fontSize: '11px',
                color: 'var(--color-teal-deep)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Details →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                title: 'NFT Wash Trading',
                desc: 'Same-token round-trip loops with zero beneficial ownership change',
                count: summary?.typology_distribution?.wash_trading || 0,
              },
              {
                title: 'Temporal Cycles',
                desc: 'Strict forward-time circular fund routes (t₁ < t₂ < … < tₖ)',
                count: summary?.typology_distribution?.cycle || 0,
              },
              {
                title: 'Mule Relays',
                desc: 'Rapid pass-through chains with bounded dwell time (≤ 1h)',
                count: summary?.typology_distribution?.pass_through || 0,
              },
              {
                title: 'Smurfing & Structuring',
                desc: 'High counterparty dispersion splitting funds across accounts',
                count: (summary?.typology_distribution?.fan_out || 0) + (summary?.typology_distribution?.fan_in || 0),
              },
            ].map((typ, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-bg-cream)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid rgba(43,43,41,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>{typ.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>{typ.desc}</div>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: 'var(--color-bg-mint)',
                    color: 'var(--color-teal-deep)',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 700,
                    fontSize: '11px',
                  }}
                >
                  {typ.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Cases */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Priority Alert Queue</h3>
            <button
              onClick={() => onNavigate('cases')}
              style={{
                fontSize: '11px',
                color: 'var(--color-teal-deep)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              All Cases →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topCases.map((c) => {
              const cid = c.case_id || c.cluster_id || '';
              return (
                <div
                  key={cid}
                  onClick={() => {
                    onSelectCase(cid);
                    onNavigate('cases');
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid rgba(43, 43, 41, 0.08)',
                    backgroundColor: 'var(--color-bg-cream)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>
                      {c.title || `Case #${cid.slice(0, 8)}`}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                      {c.account_count || c.size || 0} Wallets · {c.primary_typology || 'suspicious'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: c.priority === 'CRITICAL' ? '#fee2e2' : '#fef3c7',
                        color: c.priority === 'CRITICAL' ? '#991b1b' : '#92400e',
                      }}
                    >
                      {c.priority || 'HIGH'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-teal-deep)' }}>
                      {((c.risk_score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
