import React, { useState, useEffect, useRef, useMemo } from 'react';
import cytoscape from 'cytoscape';
import type { CaseDetail } from '../types';
import { getWalletDetail, getWalletAiSummary } from '../services/api';

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
  const [copied, setCopied] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);

  // Transfer filter toggle: 'in_ring' | 'all_history'
  const [txFilter, setTxFilter] = useState<'in_ring' | 'all_history'>('in_ring');

  // AI Forensic Dossier modal state
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [walletAiSummary, setWalletAiSummary] = useState<string | null>(null);
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);

  // Modal for "View All Rings"
  const [showAllRingsModal, setShowAllRingsModal] = useState(false);
  const [ringSearch, setRingSearch] = useState('');

  // Map nodes to human-friendly clean aliases (A, B, C, D...)
  const nodeAliasMap = useMemo(() => {
    if (!selectedCase?.graph?.nodes) return new Map<string, { alias: string; letter: string; role: string }>();
    const map = new Map<string, { alias: string; letter: string; role: string }>();
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // Find core origin first
    const nodes = [...selectedCase.graph.nodes];
    nodes.sort((a, b) => (b.role === 'core' ? 1 : 0) - (a.role === 'core' ? 1 : 0));

    nodes.forEach((n, idx) => {
      const letter = letters[idx % letters.length] + (idx >= letters.length ? Math.floor(idx / letters.length) : '');
      const isCore = n.role === 'core' || idx === 0;
      const alias = isCore ? `Wallet ${letter} (Origin)` : `Wallet ${letter} (Hop ${idx})`;
      map.set(n.id, { alias, letter, role: isCore ? 'core' : 'relay' });
    });

    return map;
  }, [selectedCase]);

  // Set of edge hashes/IDs that belong to this active case ring
  const ringEdgeSet = useMemo(() => {
    const s = new Set<string>();
    if (!selectedCase?.graph?.edges) return s;
    selectedCase.graph.edges.forEach((e) => {
      if (e.id) s.add(e.id);
      if (e.edge_id) s.add(e.edge_id);
      // Also match source->target pair
      s.add(`${e.source}->${e.target}`);
    });
    return s;
  }, [selectedCase]);

  // Chronological Edge Flow Sequence in this Ring
  const flowSequence = useMemo(() => {
    if (!selectedCase?.graph?.edges) return [];
    const edges = [...selectedCase.graph.edges];
    edges.sort((a, b) => {
      const tsA = Number(a.ts || a.timestamp || 0);
      const tsB = Number(b.ts || b.timestamp || 0);
      return tsA - tsB;
    });

    return edges.map((e, idx) => {
      const srcInfo = nodeAliasMap.get(e.source) || { alias: e.source.slice(0, 8), letter: '?' };
      const dstInfo = nodeAliasMap.get(e.target) || { alias: e.target.slice(0, 8), letter: '?' };
      return {
        step: idx + 1,
        sourceId: e.source,
        targetId: e.target,
        sourceLabel: srcInfo.alias,
        targetLabel: dstInfo.alias,
        sourceLetter: srcInfo.letter,
        targetLetter: dstInfo.letter,
        amount: e.amount,
        currency: e.currency || 'ETH',
        tokenId: e.token_id,
      };
    });
  }, [selectedCase, nodeAliasMap]);

  // Auto-select first node when case loads
  useEffect(() => {
    if (selectedCase?.graph?.nodes && selectedCase.graph.nodes.length > 0) {
      const first = selectedCase.graph.nodes[0].id;
      setSelectedWalletId(first);
    }
  }, [selectedCase]);

  // Initialize and update Cytoscape graph with STABLE, UNCHANGING NODE COLORS
  useEffect(() => {
    if (!containerRef.current || !selectedCase) return;

    const elements: cytoscape.ElementDefinition[] = [];

    // Add nodes with immutable color roles
    (selectedCase.graph.nodes || []).forEach((n) => {
      const info = nodeAliasMap.get(n.id) || { alias: n.id.slice(0, 8), letter: 'A', role: 'member' };

      elements.push({
        data: {
          id: n.id,
          label: info.alias,
          badge: info.letter,
          fullAddress: n.id,
          role: info.role,
          risk_score: n.risk_score || 0.5,
        },
      });
    });

    // Add edges with step sequence numbers
    flowSequence.forEach((e) => {
      elements.push({
        data: {
          id: `edge-step-${e.step}`,
          source: e.sourceId,
          target: e.targetId,
          step: e.step,
          stepLabel: `[${e.step}] ${e.amount} ${e.currency}`,
          amount: e.amount,
          currency: e.currency,
          tokenId: e.tokenId,
        },
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // 1. Intermediate / Relay Node (Always Mint Green #c8e1dd)
        {
          selector: 'node',
          style: {
            'background-color': '#c8e1dd',
            'border-width': 2.5,
            'border-color': '#296a6c',
            'content': 'data(badge)',
            'font-family': 'Inter, sans-serif',
            'font-size': '13px',
            'font-weight': 700,
            'color': '#164e63',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 38,
            height: 38,
          },
        },
        // 2. Core Origin Node (Always Peach/Orange #fed7aa)
        {
          selector: 'node[role = "core"]',
          style: {
            'background-color': '#fed7aa',
            'border-color': '#ea580c',
            'border-width': 3,
            'color': '#9a3412',
            width: 44,
            height: 44,
          },
        },
        // 3. Selected Relay Node: BACKGROUND COLOR STAYS MINT GREEN (#c8e1dd)! ONLY BORDER & HALO CHANGE!
        {
          selector: 'node:selected',
          style: {
            'background-color': '#c8e1dd',
            'border-color': '#164e63',
            'border-width': 4.5,
            'underlay-color': '#296a6c',
            'underlay-padding': 7,
            'underlay-opacity': 0.35,
            'underlay-shape': 'ellipse',
          },
        },
        // 4. Selected Core Node: BACKGROUND COLOR STAYS ORANGE (#fed7aa)! ONLY BORDER & HALO CHANGE!
        {
          selector: 'node[role = "core"]:selected',
          style: {
            'background-color': '#fed7aa',
            'border-color': '#9a3412',
            'border-width': 5,
            'underlay-color': '#ea580c',
            'underlay-padding': 8,
            'underlay-opacity': 0.4,
            'underlay-shape': 'ellipse',
          },
        },
        // Edges
        {
          selector: 'edge',
          style: {
            width: 2.5,
            'line-color': '#296a6c',
            'target-arrow-color': '#296a6c',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.1,
            opacity: 0.85,
            'label': 'data(stepLabel)',
            'font-family': 'Inter, monospace, sans-serif',
            'font-size': '10px',
            'font-weight': 600,
            'text-rotation': 'autorotate',
            'text-background-color': '#fcfbf7',
            'text-background-opacity': 0.95,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-border-width': 1,
            'text-border-color': 'rgba(43,43,41,0.15)',
            'color': '#2b2b29',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 60,
        nodeOverlap: 20,
        idealEdgeLength: 160,
        edgeElasticity: 100,
        nodeRepulsion: 1200000,
        componentSpacing: 180,
        gravity: 60,
        numIter: 1000,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedWalletId(node.id());
    });

    cy.fit(undefined, 50);
    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [selectedCase, nodeAliasMap, flowSequence]);

  // Load wallet detail on selection
  useEffect(() => {
    if (!selectedWalletId) {
      setWalletDetail(null);
      setWalletAiSummary(null);
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

  // Handler to fetch Forensic AI summary and pop open the subwindow modal
  const handleOpenAiDossier = async () => {
    if (!selectedWalletId) return;
    setShowDossierModal(true);
    if (!walletAiSummary) {
      setLoadingAiSummary(true);
      try {
        const res = await getWalletAiSummary(selectedWalletId);
        setWalletAiSummary(res.ai_summary);
      } catch (err) {
        console.error(err);
        setWalletAiSummary("Unable to generate assessment. Please check network connection.");
      } finally {
        setLoadingAiSummary(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyDossier = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDossier(true);
    setTimeout(() => setCopiedDossier(false), 2000);
  };

  const activeId = selectedCase?.case_id || selectedCase?.cluster_id;

  // Filtered transactions: in-ring vs all history
  const { inRingTransactions, allTransactions } = useMemo(() => {
    if (!walletDetail?.transactions) return { inRingTransactions: [], allTransactions: [] };
    const all = walletDetail.transactions;
    const inRing = all.filter((tx: any) => {
      const pair = `${tx.from_address}->${tx.to_address}`;
      return ringEdgeSet.has(tx.tx_hash) || ringEdgeSet.has(pair);
    });
    return { inRingTransactions: inRing, allTransactions: all };
  }, [walletDetail, ringEdgeSet]);

  const displayedTransactions = txFilter === 'in_ring' ? inRingTransactions : allTransactions;

  // Top 3 priority cases for quick cards
  const topCases = useMemo(() => {
    return [...cases].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 3);
  }, [cases]);

  // Filtered cases for modal
  const filteredModalCases = useMemo(() => {
    return cases.filter((c) => {
      const cid = c.case_id || c.cluster_id || '';
      const typ = c.primary_typology || (c.typology ? c.typology.join(' ') : '');
      const search = ringSearch.toLowerCase();
      return cid.toLowerCase().includes(search) || typ.toLowerCase().includes(search);
    });
  }, [cases, ringSearch]);

  const selectedAliasInfo = selectedWalletId ? nodeAliasMap.get(selectedWalletId) : null;
  const totalRingTransfers = selectedCase?.graph?.edges?.length || 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. Top Section: Case Ring Selection Cards & Quick Selector */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-white)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
              Investigation Ring Selector
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '2px' }}>
              Detected Circular Syndicates & Fraud Loops
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowAllRingsModal(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-linen)',
                backgroundColor: 'var(--color-bg-cream)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>View All Rings ({cases.length})</span>
              <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>&rarr;</span>
            </button>
          </div>
        </div>

        {/* Top 3 Quick Select Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {topCases.map((c, idx) => {
            const cid = c.case_id || c.cluster_id;
            const isSelected = cid === activeId;
            const riskPct = ((c.risk_score || 0) * 100).toFixed(0);
            const isWash = c.primary_typology === 'wash_trading' || (c.typology && c.typology.includes('wash_trading'));
            const transfersCount = c.edge_count || (c.edge_ids ? c.edge_ids.length : 0);

            return (
              <div
                key={cid}
                onClick={() => onSelectCaseId(cid)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid #296a6c' : '1px solid var(--color-linen)',
                  backgroundColor: isSelected ? '#f0fdfa' : 'var(--color-bg-cream)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    Ring #{idx + 1} ({cid.slice(0, 8)})
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: Number(riskPct) >= 80 ? '#fee2e2' : '#fef3c7',
                      color: Number(riskPct) >= 80 ? '#991b1b' : '#92400e',
                    }}
                  >
                    Risk: {riskPct}%
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: isWash ? '#b91c1c' : '#0369a1' }}>
                    {isWash ? 'NFT Wash Loop' : 'AML Carousel'}
                  </span>
                  <span>&bull;</span>
                  <span>{c.account_count || c.size || (c.accounts ? c.accounts.length : 0)} Wallets</span>
                  <span>&bull;</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                    {transfersCount} Ring Transfers
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Sequential Flow Order Bar (Chronological Stepper) */}
      {flowSequence.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-white)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '135px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#296a6c' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sequential Ring Path:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            {flowSequence.map((step, idx) => (
              <React.Fragment key={idx}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    backgroundColor: 'var(--color-bg-cream)',
                    borderRadius: '6px',
                    border: '1px solid rgba(43,43,41,0.08)',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#296a6c',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {step.step}
                  </span>
                  <span style={{ fontWeight: 600 }}>{step.sourceLabel.split(' ')[0]} {step.sourceLabel.split(' ')[1]}</span>
                  <span style={{ color: 'var(--color-ink-muted)' }}>&rarr;</span>
                  <span style={{ fontWeight: 600 }}>{step.targetLabel.split(' ')[0]} {step.targetLabel.split(' ')[1]}</span>
                  <span style={{ fontWeight: 700, color: '#0f766e', marginLeft: '4px' }}>
                    ({step.amount} {step.currency})
                  </span>
                </div>
                {idx < flowSequence.length - 1 && (
                  <span style={{ color: 'var(--color-ink-muted)', fontSize: '12px' }}>&bull;</span>
                )}
              </React.Fragment>
            ))}
          </div>

          <div
            style={{
              padding: '3px 8px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              border: '1px solid #fecaca',
            }}
          >
            CLOSED {flowSequence.length}-HOP LOOP &bull; 0 BENEFICIAL CHANGE
          </div>
        </div>
      )}

      {/* 3. Main Graph Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px', height: '640px' }}>
        
        {/* Cytoscape Canvas Container with Distinct Border & Top Header */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: '1.5px solid #dcd7cc',
            boxShadow: '0 4px 16px rgba(43, 43, 41, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Top Canvas Header: Clear Prior Information & Legends at the Top */}
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: '#faf8f3',
              borderBottom: '1px solid #e5e0d4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Top Legend (Prominently placed at the top with immutable colors) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#fed7aa', border: '1.5px solid #ea580c' }} />
                <span style={{ color: '#9a3412' }}>Core Origin (Peach / Orange)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#c8e1dd', border: '1.5px solid #296a6c' }} />
                <span style={{ color: '#164e63' }}>Relay Mule (Mint Green)</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                &bull; Total Transfers in Ring: <strong>{totalRingTransfers}</strong>
              </span>
            </div>

            {/* View Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
                title="Zoom In"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-linen)',
                  backgroundColor: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
              <button
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)}
                title="Zoom Out"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-linen)',
                  backgroundColor: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                &minus;
              </button>
              <button
                onClick={() => cyRef.current?.fit(undefined, 50)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-linen)',
                  backgroundColor: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reset View
              </button>
            </div>
          </div>

          {/* Cytoscape View */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#fdfcf9' }} />
          </div>
        </div>

        {/* Entity Inspector Panel (Right Column) */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Entity Inspector</h3>
              {selectedAliasInfo && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: selectedAliasInfo.role === 'core' ? '#fed7aa' : '#c8e1dd',
                    color: selectedAliasInfo.role === 'core' ? '#9a3412' : '#164e63',
                  }}
                >
                  {selectedAliasInfo.alias}
                </span>
              )}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
              Click any node in the graph to inspect identity & transactions.
            </p>
          </div>

          {loadingWallet ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: '12px' }}>
              Loading entity forensic profile...
            </div>
          ) : walletDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Address with Copy Button */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>On-Chain Identifier</div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    wordBreak: 'break-all',
                    fontWeight: 600,
                    marginTop: '2px',
                    padding: '6px 8px',
                    backgroundColor: 'var(--color-bg-cream)',
                    borderRadius: '4px',
                    border: '1px solid rgba(43,43,41,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{walletDetail.wallet.id}</span>
                  <button
                    onClick={() => copyToClipboard(walletDetail.wallet.id)}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-linen)',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                    Risk Score: {(walletDetail.wallet.risk_score * 100).toFixed(0)}%
                  </span>
                  {walletDetail.wallet.is_scc_member && (
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                      }}
                    >
                      SCC Loop Member
                    </span>
                  )}
                </div>
              </div>

              {/* Inflow vs Outflow Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px', border: '1px solid rgba(43,43,41,0.06)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>TOTAL INFLOW</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f766e', marginTop: '2px' }}>
                    {walletDetail.wallet.in_flow.toFixed(2)}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px', border: '1px solid rgba(43,43,41,0.06)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>TOTAL OUTFLOW</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#b91c1c', marginTop: '2px' }}>
                    {walletDetail.wallet.out_flow.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Net Balance & Retention */}
              <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Net Retained: </span>
                  <span style={{ fontWeight: 700 }}>
                    {Math.abs(walletDetail.wallet.in_flow - walletDetail.wallet.out_flow).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-ink-muted)' }}>Retention Ratio: </span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>
                    {(walletDetail.wallet.retention_ratio * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Forensic Intelligence Assessment Quick Action */}
              <div
                style={{
                  border: '1px solid #ccfbf1',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdfa',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px' }}>🛡️</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e' }}>
                      Forensic Intelligence Dossier
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#0d9488', fontWeight: 600, backgroundColor: '#ccfbf1', padding: '1px 6px', borderRadius: '4px' }}>
                    Automated
                  </span>
                </div>

                <p style={{ fontSize: '11px', color: '#115e59', margin: 0, lineHeight: 1.4 }}>
                  Comprehensive forensic verdict, behavioral invariants, and accidental transfer differentiation.
                </p>

                <button
                  onClick={handleOpenAiDossier}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid #0f766e',
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '2px',
                  }}
                >
                  <span>Open Forensic Intelligence Dossier</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Detected Forensic Invariants */}
              {walletDetail.wallet.risk_factors && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>Detected Forensic Invariants:</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                    {walletDetail.wallet.risk_factors.map((rf: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: '2px' }}>{rf}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Transactions List with Clear In-Ring Filter and Clarification */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Transaction Audit Trail:</div>
                  
                  {/* Segmented Filter: In-Ring Only vs All History */}
                  <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--color-bg-cream)', padding: '2px', borderRadius: '4px', border: '1px solid rgba(43,43,41,0.08)' }}>
                    <button
                      onClick={() => setTxFilter('in_ring')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '10px',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '3px',
                        backgroundColor: txFilter === 'in_ring' ? '#296a6c' : 'transparent',
                        color: txFilter === 'in_ring' ? '#ffffff' : 'var(--color-ink-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      In-Ring ({inRingTransactions.length})
                    </button>
                    <button
                      onClick={() => setTxFilter('all_history')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '10px',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '3px',
                        backgroundColor: txFilter === 'all_history' ? '#296a6c' : 'transparent',
                        color: txFilter === 'all_history' ? '#ffffff' : 'var(--color-ink-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      All History ({allTransactions.length})
                    </button>
                  </div>
                </div>

                {/* Clear explanatory context line */}
                <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', marginBottom: '8px' }}>
                  {txFilter === 'in_ring' ? (
                    <span>
                      Showing <strong>{inRingTransactions.length} transfers</strong> executed by this wallet in <strong>Ring #{activeId ? activeId.slice(0, 8) : ''}</strong> (total {totalRingTransfers} in ring).
                    </span>
                  ) : (
                    <span>
                      Showing all <strong>{allTransactions.length} historical transfers</strong> across entire dataset ({inRingTransactions.length} belong to this ring).
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {displayedTransactions.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: '11px' }}>
                      No transfers matching filter.
                    </div>
                  ) : (
                    displayedTransactions.map((tx: any) => {
                      const isInRing = ringEdgeSet.has(tx.tx_hash) || ringEdgeSet.has(`${tx.from_address}->${tx.to_address}`);

                      return (
                        <div
                          key={tx.tx_hash}
                          style={{
                            padding: '6px 8px',
                            backgroundColor: isInRing ? '#f0fdfa' : 'var(--color-bg-cream)',
                            borderRadius: '4px',
                            border: isInRing ? '1px solid #99f6e4' : '1px solid rgba(43,43,41,0.06)',
                            fontSize: '11px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                            <span>
                              {tx.amount} {tx.currency}
                              {tx.token_id && (
                                <span style={{ fontSize: '10px', color: '#0369a1', marginLeft: '6px', fontFamily: 'monospace' }}>
                                  Token #{tx.token_id}
                                </span>
                              )}
                            </span>

                            {/* Distinct Badges */}
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {isInRing && (
                                <span
                                  style={{
                                    backgroundColor: '#ccfbf1',
                                    color: '#0f766e',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                  }}
                                >
                                  IN-RING
                                </span>
                              )}

                              {tx.is_wash_trade ? (
                                <span
                                  style={{
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  WASH
                                </span>
                              ) : tx.is_flagged ? (
                                <span
                                  style={{
                                    backgroundColor: '#ffedd5',
                                    color: '#c2410c',
                                    border: '1px solid #fed7aa',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                  }}
                                >
                                  FLAGGED
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>NORMAL</span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-ink-muted)', marginTop: '3px', fontFamily: 'monospace' }}>
                            <span>Tx: {tx.tx_hash.slice(0, 10)}...</span>
                            <span>{tx.from_address === selectedWalletId ? 'OUTGOING' : 'INCOMING'}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: '12px' }}>
              Select a node in the graph to inspect wallet profile.
            </div>
          )}
        </div>
      </div>

      {/* 4. Subwindow Modal: Forensic Intelligence Dossier */}
      {showDossierModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-card)',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              border: '1.5px solid #dcd7cc',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--color-linen)',
                backgroundColor: '#faf8f3',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🛡️</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                    Forensic Intelligence Dossier
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    {selectedAliasInfo?.alias} &bull; On-Chain Address: <span style={{ fontFamily: 'monospace' }}>{selectedWalletId}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {walletDetail && (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: walletDetail.wallet.risk_score >= 0.7 ? '#fee2e2' : '#fef3c7',
                      color: walletDetail.wallet.risk_score >= 0.7 ? '#991b1b' : '#92400e',
                    }}
                  >
                    Risk Rating: {(walletDetail.wallet.risk_score * 100).toFixed(0)}%
                  </span>
                )}
                <button
                  onClick={() => setShowDossierModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '22px',
                    cursor: 'pointer',
                    color: 'var(--color-ink-muted)',
                    marginLeft: '8px',
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Quick Metrics Ribbon inside Modal */}
            {walletDetail && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  padding: '14px 24px',
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid var(--color-linen)',
                }}
              >
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>INFLOW</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f766e' }}>
                    {walletDetail.wallet.in_flow.toFixed(2)}
                  </div>
                </div>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>OUTFLOW</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#b91c1c' }}>
                    {walletDetail.wallet.out_flow.toFixed(2)}
                  </div>
                </div>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>RETENTION RATIO</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>
                    {(walletDetail.wallet.retention_ratio * 100).toFixed(0)}%
                  </div>
                </div>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>RING TRANSFERS</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#296a6c' }}>
                    {inRingTransactions.length} of {totalRingTransfers}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Body: Structured Assessment */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {loadingAiSummary ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Compiling Forensic Dossier...</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>Evaluating flow conservation, dwell pacing, and counterparty graph topology.</div>
                </div>
              ) : walletAiSummary ? (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-ink)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {walletAiSummary}
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                  No assessment generated yet.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--color-linen)',
                backgroundColor: '#faf8f3',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                Deterministic audit trail &bull; Anti-hallucination verified
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                {walletAiSummary && (
                  <button
                    onClick={() => copyDossier(walletAiSummary)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--color-linen)',
                      backgroundColor: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedDossier ? 'Dossier Copied!' : 'Copy Dossier'}
                  </button>
                )}
                <button
                  onClick={() => setShowDossierModal(false)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--color-linen)',
                    backgroundColor: 'var(--color-bg-cream)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal for "View All Rings" */}
      {showAllRingsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-card)',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-linen)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>All Detected Investigation Rings</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Total of {cases.length} circular clusters identified by graph algorithms.
                </p>
              </div>

              <button
                onClick={() => setShowAllRingsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--color-ink-muted)',
                }}
              >
                &times;
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-linen)' }}>
              <input
                type="text"
                placeholder="Search by Ring ID or typology (e.g. wash_trading, cycle)..."
                value={ringSearch}
                onChange={(e) => setRingSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-linen)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-linen)', color: 'var(--color-ink-muted)' }}>
                    <th style={{ padding: '10px 8px' }}>Ring ID</th>
                    <th style={{ padding: '10px 8px' }}>Typology</th>
                    <th style={{ padding: '10px 8px' }}>Risk Rating</th>
                    <th style={{ padding: '10px 8px' }}>Entities</th>
                    <th style={{ padding: '10px 8px' }}>Ring Transfers</th>
                    <th style={{ padding: '10px 8px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModalCases.map((c) => {
                    const cid = c.case_id || c.cluster_id;
                    const isSelected = cid === activeId;
                    const risk = (c.risk_score * 100).toFixed(0);

                    return (
                      <tr
                        key={cid}
                        style={{
                          borderBottom: '1px solid rgba(43,43,41,0.06)',
                          backgroundColor: isSelected ? '#f0fdfa' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 600 }}>
                          {cid.slice(0, 10)}...
                        </td>
                        <td style={{ padding: '10px 8px', textTransform: 'capitalize' }}>
                          {c.primary_typology || 'Circular Flow'}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: Number(risk) >= 80 ? '#fee2e2' : '#fef3c7',
                              color: Number(risk) >= 80 ? '#991b1b' : '#92400e',
                            }}
                          >
                            {risk}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {c.account_count || c.size || (c.accounts ? c.accounts.length : 0)}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {c.edge_count || (c.edge_ids ? c.edge_ids.length : 0)}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <button
                            onClick={() => {
                              onSelectCaseId(cid);
                              setShowAllRingsModal(false);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-pill)',
                              border: isSelected ? '1px solid #296a6c' : '1px solid var(--color-linen)',
                              backgroundColor: isSelected ? '#296a6c' : '#ffffff',
                              color: isSelected ? '#ffffff' : 'var(--color-ink)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {isSelected ? 'Loaded' : 'Select'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-linen)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAllRingsModal(false)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-linen)',
                  backgroundColor: 'var(--color-bg-cream)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
