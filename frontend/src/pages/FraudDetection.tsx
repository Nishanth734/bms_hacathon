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

        {/* Structured Forensic Detection Rules & Mathematical Invariants */}
        <div
          style={{
            padding: '20px 22px',
            backgroundColor: 'var(--color-bg-cream)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-linen)',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontWeight: 800, color: 'var(--color-ink)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
              Mathematical Detection Invariants & Formulas
            </span>
            <span style={{ fontSize: '10px', color: '#0f766e', fontWeight: 700, backgroundColor: 'var(--color-bg-mint)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
              Deterministic Algorithmic Rules
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeTab === 'wash_trading' && (
              <>
                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Asset Identity Invariant</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      token_id(e_i) == token_id(e_j) &forall; e &isin; Ring
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Identical cryptographic token ID is repeatedly transferred across confederate accounts.
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Reciprocal Re-Acquisition</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      seller(e_j) &isin; &#123;buyer(e_1), ..., buyer(e_j-1)&#125;
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Prior seller re-acquires beneficial custody of the same NFT asset through intermediaries.
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Temporal Window Bound</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      t_end - t_start &le; &Delta;T_wash (72.0 Hours)
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    The entire reciprocal volume churning loop occurs within maximum sliding threshold.
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Zero Economic Transfer</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                      &Delta;BeneficialOwner(NFT) == 0
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    No genuine change in beneficial economic ownership; transactions are artificial self-dealing.
                  </div>
                </div>
              </>
            )}

            {activeTab === 'cycle' && (
              <>
                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Temporal Monotonicity</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      t(e_1) &lt; t(e_2) &lt; ... &lt; t(e_k) &le; t(e_1) + &Delta;T
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Each directed transfer strictly succeeds the prior transfer in causal forward time.
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Closed Circuit Boundary</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      dst(e_k) == src(e_1) &and; &forall; i &ne; j: src(e_i) &ne; src(e_j)
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Forms a simple directed cycle returning funds back to the initial origin seed account.
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Bounded Cycle Length</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      3 &le; k &le; 5 Accounts
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Multi-hop traversal bounded between 3 and 5 counterparties to eliminate bilateral false positives.
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Global Window Bound</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      &Delta;T &le; 24.0 Hours
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Full circular carousel completes within 24 hours to distinguish from long-term organic commerce.
                  </div>
                </div>
              </>
            )}

            {activeTab === 'pass_through' && (
              <>
                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Per-Hop Dwell Pacing</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      d(v) = min(t_out - t_in) &le; 1.0 Hour
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Mule intermediate addresses forward funds immediately rather than accumulating savings.
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Flow Conservation Ratio</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      &rho;(v) = OutFlow(v) / InFlow(v) &isin; [0.85, 1.05]
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Near-exact conservation of capital (95% to 105%), indicating passive pass-through conduit.
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Minimum Layering Hops</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      |Hops| &ge; 3 Directed Edges
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Linear chains require at least 3 sequential hops to meet money-laundering layering criteria.
                  </div>
                </div>
              </>
            )}

            {activeTab === 'fan_out' && (
              <>
                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Counterparty Entropy</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      |Unique Counterparties(v)| &ge; 5
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Capital dispersed simultaneously into 5 or more distinct sub-accounts.
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid rgba(43,43,41,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Dispersion Conservation</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      OutFlow(v) / InFlow(v) &ge; 0.85
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    At least 85% of consolidated incoming capital is structured outward.
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Temporal Compression</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', backgroundColor: 'rgba(41,106,108,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(41,106,108,0.2)' }}>
                      t_max - t_min &le; 24.0 Hours
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Rapid batch dispersion intended to evade single-transaction reporting thresholds.
                  </div>
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
                <th style={{ padding: '10px' }}>Case / Title</th>
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
