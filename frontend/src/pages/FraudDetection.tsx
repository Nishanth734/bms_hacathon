import React, { useState } from 'react';
import type { CaseListItem, PageView } from '../types';

interface FraudDetectionProps {
  cases: CaseListItem[];
  onSelectCase: (caseId: string) => void;
  onNavigate: (view: PageView) => void;
}

interface TypologyMetadata {
  title: string;
  badge: string;
  summary: string;
  riskProfile: string;
  rules: {
    name: string;
    threshold: string;
    desc: string;
  }[];
}

const TYPOLOGY_DETAILS: Record<string, TypologyMetadata> = {
  wash_trading: {
    title: 'NFT Wash Trading & Volume Inflation',
    badge: 'Market Manipulation',
    summary:
      'Coordinated confederate wallets execute reciprocal buy/sell cycles of the same NFT without genuine transfer of beneficial ownership, artificially manufacturing trade volume or manipulating secondary floor prices.',
    riskProfile: 'High regulatory scrutiny (Market manipulation, false liquidity generation)',
    rules: [
      {
        name: 'Asset Uniformity',
        threshold: 'Same Token ID',
        desc: 'Identical cryptographic asset transferred repeatedly across related accounts.',
      },
      {
        name: 'Reciprocal Ownership',
        threshold: 'Re-Acquisition Loop',
        desc: 'Original seller re-acquires custody via intermediate trading counterparties.',
      },
      {
        name: 'Temporal Bounds',
        threshold: '≤ 72.0 Hours',
        desc: 'All reciprocal trades conclude within a 72-hour sliding forensic window.',
      },
      {
        name: 'Economic Transfer',
        threshold: 'Net Delta = 0',
        desc: 'Zero net change in ultimate beneficial owner; trades represent self-dealing.',
      },
    ],
  },
  cycle: {
    title: 'Forward Time-Ordered Cyclic Carousel',
    badge: 'Layering Loop',
    summary:
      'Laundering syndicate routes funds through a closed carousel of intermediary wallets before returning capital to the original seed account. TraceFlow enforces causal timestamp ordering to prevent false positives.',
    riskProfile: 'High AML priority (Circular layering to disguise source of funds)',
    rules: [
      {
        name: 'Causal Sequence',
        threshold: 't₁ < t₂ < … < tₖ',
        desc: 'Each hop occurs strictly after the previous transaction in chronological time.',
      },
      {
        name: 'Closed Circuit',
        threshold: 'A → B … → A',
        desc: 'Direct multi-hop cycle returns capital directly back to initial funding wallet.',
      },
      {
        name: 'Carousel Length',
        threshold: '3 to 5 Accounts',
        desc: 'Multi-hop traversal bounded between 3 and 5 distinct counterparties.',
      },
      {
        name: 'Global Window',
        threshold: '≤ 24.0 Hours',
        desc: 'Full circular transaction loop completes within a 24-hour window.',
      },
    ],
  },
  pass_through: {
    title: 'Rapid Mule Relay Pass-Through Chains',
    badge: 'Mule Layering',
    summary:
      'Linear chains of disposable intermediary accounts designed to obscure the forensic trail. Intermediaries maintain low balances, hold capital for minimal durations, and pass along nearly the entire principal value.',
    riskProfile: 'Critical AML indicator (Smurfing conduit & layering hops)',
    rules: [
      {
        name: 'Pacing & Dwell',
        threshold: '≤ 1.0 Hour Dwell',
        desc: 'Intermediate addresses forward funds rapidly without accumulating balances.',
      },
      {
        name: 'Flow Conservation',
        threshold: '85% – 105% Retention',
        desc: 'Nearly complete capital preservation across hops, indicating a pure transit conduit.',
      },
      {
        name: 'Layering Depth',
        threshold: '≥ 3 Directed Hops',
        desc: 'Sequence contains 3 or more consecutive transfers between distinct wallets.',
      },
      {
        name: 'Account Profile',
        threshold: 'Transient Mule',
        desc: 'Intermediary exhibits high throughput and near-zero long-term balance holding.',
      },
    ],
  },
  fan_out: {
    title: 'Smurfing, Structuring & Dispersion Rings',
    badge: 'Structuring',
    summary:
      'Consolidated capital pools are split into multiple smaller tranches and dispersed across numerous counterparties in a short burst, specifically engineered to evade mandatory currency transaction reporting thresholds.',
    riskProfile: 'High SAR threshold (Deliberate circumvention of reporting limits)',
    rules: [
      {
        name: 'Counterparty Fan-Out',
        threshold: '≥ 5 Recipients',
        desc: 'Capital structured simultaneously into 5 or more distinct sub-accounts.',
      },
      {
        name: 'Outflow Volume',
        threshold: '≥ 85% Dispersed',
        desc: 'At least 85% of consolidated incoming capital is structured outward.',
      },
      {
        name: 'Temporal Burst',
        threshold: '≤ 24.0 Hours',
        desc: 'Dispersal occurs in a tight temporal window to avoid transaction flags.',
      },
      {
        name: 'Structuring Pattern',
        threshold: 'Sub-Threshold Tranches',
        desc: 'Individual payment amounts kept below standard $10,000 regulatory triggers.',
      },
    ],
  },
};

export const FraudDetection: React.FC<FraudDetectionProps> = ({
  cases,
  onSelectCase,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'wash_trading' | 'cycle' | 'pass_through' | 'fan_out'>('wash_trading');

  const filteredCases = cases.filter((c) =>
    activeTab === 'wash_trading'
      ? c.typology.includes('wash_trading')
      : activeTab === 'cycle'
      ? c.typology.includes('cycle')
      : activeTab === 'pass_through'
      ? c.typology.includes('pass_through')
      : c.typology.includes('fan_out') || c.typology.includes('fan_in')
  );

  const activeMeta = TYPOLOGY_DETAILS[activeTab];

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header & Typology Tabs */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
              Forensic Typology Signatures
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
              Select a money-laundering typology to view its behavioral invariants and discovered clusters.
            </p>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-teal-deep)',
              backgroundColor: 'var(--color-bg-mint)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {filteredCases.length} Detected Cases
          </span>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'wash_trading', label: 'NFT Wash Trading' },
            { id: 'cycle', label: 'Temporal Cycles' },
            { id: 'pass_through', label: 'Mule Pass-Through' },
            { id: 'fan_out', label: 'Smurfing & Structuring' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: isActive ? '1px solid var(--color-teal-deep)' : '1px solid var(--color-linen)',
                  backgroundColor: isActive ? 'var(--color-bg-mint)' : 'transparent',
                  color: isActive ? 'var(--color-teal-deep)' : 'var(--color-ink-secondary)',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Typology Overview & Detection Criteria Card */}
      <div
        style={{
          padding: '18px 20px',
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          display: 'grid',
          gridTemplateColumns: '1fr 1.3fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left: Summary & AML Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-teal-deep)' }}>
              {activeMeta.title}
            </h2>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: '#f1f5f9',
                color: '#334155',
              }}
            >
              {activeMeta.badge}
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--color-ink-secondary)', lineHeight: 1.55, margin: 0 }}>
            {activeMeta.summary}
          </p>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--color-bg-sand)',
              borderRadius: '6px',
              border: '1px solid var(--color-linen)',
              fontSize: '11px',
              color: 'var(--color-ink-muted)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Risk Assessment: </span>
            {activeMeta.riskProfile}
          </div>
        </div>

        {/* Right: Clean Detection Criteria Grid (No oversized formulas) */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--color-bg-cream)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-linen)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-ink)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
              Forensic Detection Criteria
            </span>
            <span style={{ fontSize: '10px', color: '#0f766e', fontWeight: 600 }}>
              Deterministic Rule Set
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {activeMeta.rules.map((r, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-bg-white)',
                  borderRadius: '5px',
                  border: '1px solid var(--color-linen)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    {r.name}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#0f766e',
                      backgroundColor: 'var(--color-bg-mint)',
                      padding: '1px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    {r.threshold}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', lineHeight: 1.35 }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flagged Clusters Table */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, margin: 0 }}>
            Identified Cases ({filteredCases.length})
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
            Showing candidate clusters matching {activeMeta.title}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-linen)', color: 'var(--color-ink-secondary)' }}>
                <th style={{ padding: '8px 10px' }}>Case Reference</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Wallets</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Transactions</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Duration</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Risk Score</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => (
                <tr key={c.case_id} style={{ borderBottom: '1px solid var(--color-bg-sand)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                    <div style={{ color: 'var(--color-ink)' }}>{c.title || `Ring #${c.case_id.slice(0, 8)}`}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                      ID: {c.case_id.slice(0, 12)}
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c.account_count}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c.edge_count}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{c.duration_hours.toFixed(1)}h</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-teal-deep)' }}>
                    {(c.risk_score * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        onSelectCase(c.case_id);
                        onNavigate('cases');
                      }}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: 'var(--color-teal-deep)',
                        color: 'var(--color-bg-white)',
                        border: 'none',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Investigate →
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                    No clusters detected under this typology for the active dataset.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
