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
                Wash trading in digital assets occurs when coordinated sybil accounts execute reciprocal transactions
                of the same NFT token (`token_id`) without altering the ultimate economic beneficiary. This is executed
                to manipulate floor prices on secondary marketplaces or exploit token reward emissions (liquidity mining).
              </>
            )}
            {activeTab === 'cycle' && (
              <>
                A cyclic laundering ring routes funds through intermediate accounts $A \to B \to C \dots \to A$. Unlike
                static graph algorithms which produce false positive cycles, TraceFlow enforces strict causal temporal order:
                $t(e_1) &lt; t(e_2) &lt; \dots &lt; t(e_k) \le t(e_1) + \Delta T$.
              </>
            )}
            {activeTab === 'pass_through' && (
              <>
                Mule relay chains consist of linear sequences of transient intermediary wallets used to obfuscate the
                origin of stolen or mixer-extracted funds. Intermediaries hold funds for minimal durations (dwell time &le; 1 hour)
                and retain almost 100% of the principal value (retention ratio &isin; [0.85, 1.0]).
              </>
            )}
            {activeTab === 'fan_out' && (
              <>
                Structuring (smurfing) breaks a large pool of capital into many sub-threshold tranches sent to multiple
                counterparties ($k \ge 5$) within a compressed time window, aiming to evade single-transaction threshold triggers.
              </>
            )}
          </div>
        </div>

        {/* Mathematical Invariants */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-bg-cream)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-linen)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-ink)', textTransform: 'uppercase', fontSize: '11px' }}>
            Mathematical Detection Criteria
          </div>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeTab === 'wash_trading' && (
              <>
                <div>• <strong>Token Invariant:</strong> <code>token_id(e_i) == token_id(e_j)</code></div>
                <div>• <strong>Reciprocity:</strong> <code>seller(e_j) in buyers(e_1..e_j-1)</code></div>
                <div>• <strong>Window Bound:</strong> <code>t_end - t_start &le; 72 Hours</code></div>
                <div>• <strong>Economic Impact:</strong> <code>Net Change in Ownership == 0</code></div>
              </>
            )}
            {activeTab === 'cycle' && (
              <>
                <div>• <strong>Temporal Monotonicity:</strong> <code>t(e_1) &lt; t(e_2) &lt; ... &lt; t(e_k)</code></div>
                <div>• <strong>Closed Loop:</strong> <code>dst(e_k) == src(e_1)</code></div>
                <div>• <strong>Length:</strong> <code>3 &le; k &le; 5 Accounts</code></div>
                <div>• <strong>Window Bound:</strong> <code>&Delta;T &le; 24.0 Hours</code></div>
              </>
            )}
            {activeTab === 'pass_through' && (
              <>
                <div>• <strong>Dwell Time:</strong> <code>d(v) = min(t_out - t_in) &le; 1.0 Hour</code></div>
                <div>• <strong>Flow Retention:</strong> <code>&rho;(v) = OutFlow(v) / InFlow(v) &isin; [0.85, 1.0]</code></div>
                <div>• <strong>Min Hops:</strong> <code>Hops &ge; 3 Directed Edges</code></div>
              </>
            )}
            {activeTab === 'fan_out' && (
              <>
                <div>• <strong>Counterparty Entropy:</strong> <code>Unique Counterparties &ge; 5</code></div>
                <div>• <strong>Window Bound:</strong> <code>&Delta;T &le; 24.0 Hours</code></div>
                <div>• <strong>Dispersion Ratio:</strong> <code>OutFlow / InFlow &ge; 0.85</code></div>
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
