import React, { useState, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { CaseDetail } from '../types';
import { getWalletDetail } from '../services/api';

interface WalletNetworkProps {
  selectedCase: CaseDetail | null;
  cases: any[];
  onSelectCaseId: (id: string) => void;
}

export const WalletNetwork: React.FC<WalletNetworkProps> = ({
  selectedCase,
  cases,
  onSelectCaseId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [walletDetail, setWalletDetail] = useState<any | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // Initialize and update Cytoscape graph
  useEffect(() => {
    if (!containerRef.current || !selectedCase) return;

    const elements: cytoscape.ElementDefinition[] = [];

    // Add nodes
    (selectedCase.graph.nodes || []).forEach((n) => {
      const full = n.id;
      // Clean readable label: e.g. 0x1234...5678 or BankA_1001
      const displayLabel =
        full.length > 12 ? `${full.slice(0, 6)}…${full.slice(-4)}` : full;

      elements.push({
        data: {
          id: n.id,
          label: displayLabel,
          fullAddress: full,
          role: n.role || 'member',
          risk_score: n.risk_score || 0.5,
        },
      });
    });

    // Add edges
    (selectedCase.graph.edges || []).forEach((e, idx) => {
      elements.push({
        data: {
          id: e.edge_id || e.id || `e-${idx}`,
          source: e.source,
          target: e.target,
          amount: e.amount,
          currency: e.currency || 'ETH',
          token_id: e.token_id,
        },
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#c8e1dd',
            'border-width': 2,
            'border-color': '#296a6c',
            label: 'data(label)',
            'font-family': 'Inter, monospace, sans-serif',
            'font-size': '10px',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            color: '#2b2b29',
            'text-background-color': '#fcfbf7',
            'text-background-opacity': 0.95,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-border-width': 1,
            'text-border-color': 'rgba(43, 43, 41, 0.15)',
            width: 32,
            height: 32,
          },
        },
        {
          selector: 'node[role = "core"]',
          style: {
            'background-color': '#fed7aa',
            'border-color': '#ea580c',
            width: 36,
            height: 36,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#296a6c',
            'border-width': 3,
            'background-color': '#a5beba',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#296a6c',
            'target-arrow-color': '#296a6c',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.9,
            opacity: 0.85,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 50,
        nodeOverlap: 30,
        idealEdgeLength: 120,
        edgeElasticity: 100,
        nodeRepulsion: 800000,
        componentSpacing: 140,
        gravity: 80,
        numIter: 1000,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedWalletId(node.id());
    });

    cy.fit(undefined, 40);
    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [selectedCase]);

  // Load wallet detail on selection
  useEffect(() => {
    if (!selectedWalletId) {
      setWalletDetail(null);
      return;
    }

    async function fetchDetail() {
      setLoadingWallet(true);
      try {
        const data = await getWalletDetail(selectedWalletId!);
        setWalletDetail(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingWallet(false);
      }
    }

    fetchDetail();
  }, [selectedWalletId]);

  const activeId = selectedCase?.case_id || selectedCase?.cluster_id;

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-bg-white)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>Case Ring:</span>
          <select
            value={activeId || ''}
            onChange={(e) => onSelectCaseId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-linen)',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: 'var(--color-bg-cream)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {cases.map((c) => {
              const cid = c.case_id || c.cluster_id;
              return (
                <option key={cid} value={cid}>
                  {c.title || `Ring #${cid.slice(0, 8)}`} ({(c.risk_score * 100).toFixed(0)}%)
                </option>
              );
            })}
          </select>

          <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
            {selectedCase?.graph?.nodes?.length || 0} Wallets · {selectedCase?.graph?.edges?.length || 0} Transfers
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => cyRef.current?.fit(undefined, 40)}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-linen)',
              backgroundColor: 'transparent',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Main Graph Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px', height: '640px' }}>
        {/* Cytoscape View */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {/* Clean Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              backgroundColor: 'rgba(251, 250, 246, 0.95)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-linen)',
              fontSize: '11px',
              display: 'flex',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fed7aa', border: '1px solid #ea580c' }} />
              <span>Core Origin</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c8e1dd', border: '1px solid #296a6c' }} />
              <span>Relay Participant</span>
            </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
          }}
        >
          <div style={{ borderBottom: '1px solid var(--color-bg-sand)', paddingBottom: '10px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Entity Inspector</h3>
            <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
              Click any node in the graph to view wallet activity.
            </p>
          </div>

          {loadingWallet ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: '12px' }}>
              Loading wallet data...
            </div>
          ) : walletDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>Address</div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    fontWeight: 600,
                    marginTop: '2px',
                  }}
                >
                  {walletDetail.wallet.id}
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: walletDetail.wallet.risk_score >= 0.7 ? '#fee2e2' : '#fef3c7',
                      color: walletDetail.wallet.risk_score >= 0.7 ? '#991b1b' : '#92400e',
                    }}
                  >
                    Risk: {(walletDetail.wallet.risk_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>INFLOW</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {walletDetail.wallet.in_flow.toFixed(2)}
                  </div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>OUTFLOW</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {walletDetail.wallet.out_flow.toFixed(2)}
                  </div>
                </div>
              </div>

              {walletDetail.wallet.risk_factors && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Risk Factors:</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                    {walletDetail.wallet.risk_factors.map((rf: string, idx: number) => (
                      <li key={idx}>{rf}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>Transactions:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {walletDetail.transactions.map((tx: any) => (
                    <div
                      key={tx.tx_hash}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: 'var(--color-bg-cream)',
                        borderRadius: '4px',
                        border: '1px solid rgba(43,43,41,0.06)',
                        fontSize: '11px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>{tx.amount} {tx.currency}</span>
                        {tx.is_wash_trade && (
                          <span style={{ color: '#dc2626', fontSize: '10px' }}>WASH</span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                        {tx.tx_hash.slice(0, 10)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: '12px' }}>
              Select a node in the graph to inspect wallet profile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
