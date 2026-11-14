import React, { useState } from 'react';
import type { CaseListItem, PageView } from '../types';

interface FraudDetectionProps {
  cases: CaseListItem[];
  onSelectCase: (caseId: string) => void;
  onNavigate: (view: PageView) => void;
}

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

  return (
    <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-ink)' }}>
          Forensic Typology Models & Behavioral Signatures
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
          Explore the exact algorithmic heuristics, mathematical conditions, and discovered candidate clusters for each fraud typology.
        </p>
      </div>

      {/* Typology Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-linen)', paddingBottom: '12px' }}>
        {[
          { id: 'wash_trading', label: 'NFT Wash Trading & Floor Pumping' },
          { id: 'cycle', label: 'Temporal Cycles (t₁ < t₂ < ... < tₖ)' },
          { id: 'pass_through', label: 'Mule Pass-Through Relays' },
          { id: 'fan_out', label: 'Smurfing & Structuring (Fan-Out)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              border: activeTab === tab.id ? '1px solid var(--color-teal-deep)' : '1px solid var(--color-linen)',
              backgroundColor: activeTab === tab.id ? 'var(--color-bg-mint)' : 'var(--color-bg-white)',
              color: activeTab === tab.id ? 'var(--color-teal-deep)' : 'var(--color-ink-secondary)',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Typology Model Explanation Card */}
      <div
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: '24px',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, color: 'var(--color-teal-deep)' }}>
            {activeTab === 'wash_trading' && 'NFT Wash Trading & Artificial Volume Churning'}
            {activeTab === 'cycle' && 'Forward Time-Ordered Cyclic Round-Tripping'}
            {activeTab === 'pass_through' && 'Rapid Mule Relay Pass-Through Chains'}
            {activeTab === 'fan_out' && 'Smurfing, Structuring & Counterparty Dispersion'}
          </h2>

          <div style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
            {activeTab === 'wash_trading' && (
              <>
                Wash trading occurs when coordinated sybil accounts execute reciprocal transactions
                of the same NFT token without altering the ultimate economic beneficiary. This is executed
                to manipulate floor prices on secondary marketplaces or artificially manufacture trading volume.
              </>
            )}
            {activeTab === 'cycle' && (
              <>
                A cyclic laundering ring routes funds through a carousel of intermediate accounts before returning to origin.
                Unlike static graph tools that flag harmless loops, TraceFlow enforces causal temporal ordering:
                each transfer must happen strictly after the previous one, completing the loop within a verified time window.
              </>
            )}
            {activeTab === 'pass_through' && (
              <>
                Mule relay chains consist of linear sequences of transient intermediary accounts used to obscure the
                origin of illicit funds. Intermediaries hold funds for minimal durations (under 1 hour)
                and pass along almost the entire principal value (85% to 105% retention ratio).
              </>
            )}
            {activeTab === 'fan_out' && (
              <>
                Structuring (smurfing) breaks a large capital pool into multiple smaller tranches sent to several
                counterparties (5 or more accounts) within a short window, deliberately evading single-transaction reporting thresholds.
              </>
            )}
          </div>
        </div>

        {/* Structured Forensic Detection Rules */}
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-bg-cream)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-linen)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--color-ink)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
            Forensic Detection Rules
          </div>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeTab === 'wash_trading' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Token ID:</span>
                  <span style={{ fontWeight: 600 }}>Identical NFT token across all sales</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Reciprocity:</span>
                  <span style={{ fontWeight: 600 }}>Seller appears in prior buyer set</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Time Window:</span>
                  <span style={{ fontWeight: 600 }}>Completed within 72 hours</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Beneficial Change:</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>Zero net economic transfer</span>
                </div>
              </>
            )}
            {activeTab === 'cycle' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Time Order:</span>
                  <span style={{ fontWeight: 600 }}>Strict forward sequence (Hop 1 &rarr; Hop 2 &rarr; Hop 3)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Circuit Topology:</span>
                  <span style={{ fontWeight: 600 }}>Closed loop returns to seed account</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Chain Length:</span>
                  <span style={{ fontWeight: 600 }}>3 to 5 Counterparties</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Window Bound:</span>
                  <span style={{ fontWeight: 600 }}>Maximum 24 hours</span>
                </div>
              </>
            )}
            {activeTab === 'pass_through' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Dwell Time:</span>
                  <span style={{ fontWeight: 600 }}>Average holding time under 1 hour</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Flow Retention:</span>
                  <span style={{ fontWeight: 600 }}>85% to 105% volume conservation</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Minimum Hops:</span>
                  <span style={{ fontWeight: 600 }}>At least 3 intermediary wallets</span>
                </div>
              </>
            )}
            {activeTab === 'fan_out' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Counterparties:</span>
                  <span style={{ fontWeight: 600 }}>5 or more distinct destination accounts</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Time Window:</span>
                  <span style={{ fontWeight: 600 }}>Compressed dispersion within 24 hours</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Dispersion Ratio:</span>
                  <span style={{ fontWeight: 600 }}>At least 85% of capital fanned out</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Flagged Clusters Table */}
      <div
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600 }}>
            Discovered {activeTab.replace('_', ' ').toUpperCase()} Clusters ({filteredCases.length})
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-linen)', color: 'var(--color-ink-secondary)' }}>
                <th style={{ padding: '10px' }}>Cluster / Title</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Wallets</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Transactions</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Duration</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Risk Score</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => (
                <tr key={c.case_id} style={{ borderBottom: '1px solid var(--color-bg-sand)' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>
                    <div>{c.title || `Ring #${c.case_id.slice(0, 8)}`}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>ID: {c.case_id}</div>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{c.account_count}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{c.edge_count}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{c.duration_hours.toFixed(1)}h</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-teal-deep)' }}>
                    {(c.risk_score * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        onSelectCase(c.case_id);
                        onNavigate('cases');
                      }}
                      style={{
                        padding: '4px 10px',
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
