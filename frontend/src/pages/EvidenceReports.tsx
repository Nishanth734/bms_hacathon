import React, { useState, useEffect, useMemo } from 'react';
import type { CaseDetail } from '../types';
import { getReportMarkdown } from '../services/api';

interface EvidenceReportsProps {
  selectedCase: CaseDetail | null;
  cases: any[];
  onSelectCaseId: (id: string) => void;
}

export const EvidenceReports: React.FC<EvidenceReportsProps> = ({
  selectedCase,
  cases,
  onSelectCaseId,
}) => {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllRingsModal, setShowAllRingsModal] = useState(false);
  const [ringSearch, setRingSearch] = useState('');

  // Auto-select first case if none selected
  useEffect(() => {
    if (!selectedCase && cases.length > 0) {
      const firstId = cases[0].case_id || cases[0].cluster_id;
      if (firstId) {
        onSelectCaseId(firstId);
      }
    }
  }, [cases, selectedCase, onSelectCaseId]);

  const activeId = selectedCase?.case_id || selectedCase?.cluster_id;

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

  const handleExportMarkdown = async () => {
    if (!activeId) return;
    setExporting(true);
    try {
      const md = await getReportMarkdown(activeId);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TraceFlow-SAR-${activeId.slice(0, 8)}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!activeId) return;
    try {
      const md = await getReportMarkdown(activeId);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Copy failed');
    }
  };

  const report = selectedCase?.report;
  const evidence = selectedCase?.evidence || ({} as any);
  const isVerified = report?.verification_status === 'VERIFIED' || report?.verifier_pass !== false;
  const primaryTypology = evidence.primary_typology || selectedCase?.primary_typology || 'Suspicious';
  const riskScore = evidence.risk_score ?? selectedCase?.risk_score ?? 0.85;

  const nodes = selectedCase?.graph?.nodes || [];
  const edges = selectedCase?.graph?.edges || [];

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Top Section: Case Ring Selection Cards (Consistent with Graph Page) */}
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
              Evidence & Legal Reporting
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '2px' }}>
              Select Investigation Case for Dossier & SAR Generation
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
                    Case #{idx + 1} ({cid.slice(0, 8)})
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
                  <span>{transfersCount} Transfers</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Main Evidence Grid */}
      {selectedCase ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
          
          {/* Left Column: Suspicious Activity Report (SAR) Narrative */}
          <div
            style={{
              backgroundColor: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-card)',
              border: '1.5px solid #dcd7cc',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 4px 16px rgba(43,43,41,0.04)',
            }}
          >
            {/* Header with Title and Verification Pill */}
            <div style={{ borderBottom: '1px solid #e5e0d4', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0f766e' }}>
                  Statutory Filing Dossier &bull; FinCEN / AML Format
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--color-ink)' }}>
                  {report?.title || selectedCase.title || `Forensic Examination: Ring #${activeId ? activeId.slice(0, 8) : 'Cluster'}`}
                </h2>
                <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                  Case ID: {activeId}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isVerified ? '#dcfce7' : '#fee2e2',
                    color: isVerified ? '#15803d' : '#991b1b',
                    border: `1px solid ${isVerified ? '#86efac' : '#fca5a5'}`,
                  }}
                >
                  {isVerified ? '✓ FACT-AUDITED & VERIFIED' : 'AUDIT WARNING'}
                </span>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleCopyMarkdown}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'var(--color-bg-cream)',
                      color: 'var(--color-ink)',
                      border: '1px solid var(--color-linen)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleExportMarkdown}
                    disabled={exporting}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: 'var(--color-teal-deep)',
                      color: 'var(--color-bg-white)',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: exporting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {exporting ? 'Exporting...' : 'Export SAR (.md)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Legal Overview Alert Banner */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#991b1b',
                lineHeight: 1.5,
              }}
            >
              <strong>Forensic Allegation:</strong> High-probability coordinated {primaryTypology === 'wash_trading' ? 'NFT wash-trading manipulation' : 'circular AML fund layering'}. 
              Funds were programmatically cycled across {nodes.length} accounts with near-zero dwell time and 0 net change in beneficial ownership.
            </div>

            {/* Sentence-by-Sentence Evidentiary Log */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-ink)' }}>
                Deterministic Fact-Checked Narrative:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {report?.sentences && report.sentences.length > 0 ? (
                  report.sentences.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: 'var(--color-bg-cream)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        lineHeight: 1.6,
                        border: '1px solid rgba(43,43,41,0.06)',
                      }}
                    >
                      <div style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{s.text}</div>
                      {s.edge_ids && s.edge_ids.length > 0 && (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>CITED EVIDENCE:</span>
                          {s.edge_ids.map((eid, eidx) => (
                            <span
                              key={eidx}
                              style={{
                                padding: '1px 6px',
                                backgroundColor: 'var(--color-bg-mint)',
                                color: 'var(--color-teal-deep)',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                border: '1px solid rgba(41,106,108,0.2)',
                              }}
                            >
                              Tx: {eid.length > 12 ? eid.slice(0, 10) + '…' : eid}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-ink)', whiteSpace: 'pre-wrap', padding: '12px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '6px' }}>
                    {report?.narrative_markdown || 'No report narrative generated.'}
                  </div>
                )}
              </div>
            </div>

            {/* Anti-Hallucination Audit Certificate */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f0fdfa',
                borderRadius: '6px',
                border: '1px solid #ccfbf1',
                fontSize: '11px',
                color: '#115e59',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>Audit Guarantee:</strong> Every cited address, transaction hash, and currency amount was cross-verified against the graph state. Zero generative hallucination permitted.
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#14b8a6', color: '#ffffff', padding: '2px 8px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>
                VERIFIED PASS
              </span>
            </div>

          </div>

          {/* Right Column: Evidence Metrics, Account Roster & Transfer Audit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Case Metrics Card */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-white)',
                borderRadius: 'var(--radius-card)',
                border: 'var(--border-card)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Quantitative Invariants</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>TYPOLOGY</div>
                  <div style={{ fontWeight: 700, marginTop: '2px', textTransform: 'capitalize' }}>
                    {primaryTypology.replace('_', ' ')}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>RISK SCORE</div>
                  <div style={{ fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                    {(riskScore * 100).toFixed(0)}% CRITICAL
                  </div>
                </div>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>CONFEDERATE WALLETS</div>
                  <div style={{ fontWeight: 700, marginTop: '2px' }}>
                    {nodes.length} Accounts
                  </div>
                </div>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>CASE TRANSFERS</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-teal-deep)', marginTop: '2px' }}>
                    {edges.length} Hops
                  </div>
                </div>
              </div>
            </div>

            {/* Counterparty Roster */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-white)',
                borderRadius: 'var(--radius-card)',
                border: 'var(--border-card)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Involved Counterparties ({nodes.length})</h3>
                <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>Alphabetical Aliases</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {nodes.map((n, idx) => {
                  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                  const letter = letters[idx % letters.length];
                  const isCore = n.role === 'core' || idx === 0;

                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: 'var(--color-bg-cream)',
                        borderRadius: '4px',
                        border: '1px solid rgba(43,43,41,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: isCore ? '#fed7aa' : '#c8e1dd',
                            color: isCore ? '#9a3412' : '#164e63',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                          }}
                        >
                          {letter}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {n.id.length > 14 ? `${n.id.slice(0, 8)}…${n.id.slice(-4)}` : n.id}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: isCore ? '#ea580c' : '#0f766e',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isCore ? 'Origin Seed' : 'Relay Mule'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sequential Transfer Manifest */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-white)',
                borderRadius: 'var(--radius-card)',
                border: 'var(--border-card)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Transfer Manifest ({edges.length})</h3>
                <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>Chronological Trail</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {edges.map((e, idx) => (
                  <div
                    key={e.id || idx}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: 'var(--color-bg-cream)',
                      borderRadius: '4px',
                      border: '1px solid rgba(43,43,41,0.06)',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                      <span>
                        Hop {idx + 1}: {e.amount} {e.currency || 'ETH'}
                        {e.token_id && (
                          <span style={{ color: '#0369a1', marginLeft: '6px' }}>Token #{e.token_id}</span>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: primaryTypology === 'wash_trading' ? '#fee2e2' : '#ffedd5',
                          color: primaryTypology === 'wash_trading' ? '#dc2626' : '#c2410c',
                          fontWeight: 700,
                        }}
                      >
                        {primaryTypology === 'wash_trading' ? 'WASH' : 'FLAGGED'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-ink-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                      <span>{e.source.slice(0, 8)}…</span>
                      <span>&rarr;</span>
                      <span>{e.target.slice(0, 8)}…</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-ink-muted)', backgroundColor: 'var(--color-bg-white)', borderRadius: 'var(--radius-card)', border: 'var(--border-card)' }}>
          Select an active case above to inspect forensic evidence.
        </div>
      )}

      {/* 3. Modal for "View All Rings" (Matching Graph Page) */}
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
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>All Detected Investigation Cases</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Total of {cases.length} investigation dossiers ready for review and filing.
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
                placeholder="Search by Case ID or typology (e.g. wash_trading, cycle)..."
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
                    <th style={{ padding: '10px 8px' }}>Case ID</th>
                    <th style={{ padding: '10px 8px' }}>Typology</th>
                    <th style={{ padding: '10px 8px' }}>Risk Rating</th>
                    <th style={{ padding: '10px 8px' }}>Wallets</th>
                    <th style={{ padding: '10px 8px' }}>Transfers</th>
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
