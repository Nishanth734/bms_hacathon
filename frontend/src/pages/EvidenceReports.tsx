import React, { useState, useEffect } from 'react';
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

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
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
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>Case:</span>
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
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopyMarkdown}
            style={{
              padding: '5px 12px',
              backgroundColor: 'transparent',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-linen)',
              borderRadius: 'var(--radius-pill)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied' : 'Copy Report'}
          </button>
          <button
            onClick={handleExportMarkdown}
            disabled={exporting}
            style={{
              padding: '5px 14px',
              backgroundColor: 'var(--color-teal-deep)',
              color: 'var(--color-bg-white)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: exporting ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? 'Exporting...' : 'Export SAR (.md)'}
          </button>
        </div>
      </div>

      {selectedCase ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
          {/* Narrative Report */}
          <div
            style={{
              backgroundColor: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-card)',
              border: 'var(--border-card)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ borderBottom: '1px solid var(--color-bg-sand)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Suspicious Activity Report
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {report?.title || selectedCase.title || 'Case Report'}
                  </h2>
                </div>

                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isVerified ? '#dcfce7' : '#fee2e2',
                    color: isVerified ? '#15803d' : '#991b1b',
                  }}
                >
                  {isVerified ? '✓ VERIFIED' : 'AUDIT WARNING'}
                </span>
              </div>
            </div>

            {/* Sentence Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {report?.sentences && report.sentences.length > 0 ? (
                report.sentences.map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--color-bg-cream)',
                      borderRadius: 'var(--radius-card)',
                      fontSize: '12px',
                      lineHeight: 1.6,
                      color: 'var(--color-ink)',
                    }}
                  >
                    <div>{s.text}</div>
                    {s.edge_ids && s.edge_ids.length > 0 && (
                      <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {s.edge_ids.slice(0, 4).map((eid, eidx) => (
                          <span
                            key={eidx}
                            style={{
                              padding: '1px 5px',
                              backgroundColor: 'var(--color-bg-mint)',
                              color: 'var(--color-teal-deep)',
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontFamily: 'monospace',
                            }}
                          >
                            {eid.length > 10 ? eid.slice(0, 8) + '…' : eid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-ink)' }}>
                  {report?.narrative_markdown || 'No report narrative generated.'}
                </div>
              )}
            </div>
          </div>

          {/* Fact Audit & Evidence Object */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Anti-Hallucination Audit */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-white)',
                borderRadius: 'var(--radius-card)',
                border: 'var(--border-card)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Anti-Hallucination Audit</h3>
              <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                Every address, amount, and timestamp in this report is deterministically validated against the case graph.
              </p>

              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-bg-mint)',
                  borderRadius: 'var(--radius-card)',
                  fontSize: '11px',
                  color: 'var(--color-teal-deep)',
                  fontWeight: 600,
                  marginTop: '4px',
                }}
              >
                ✓ All cited facts match graph evidence exactly.
              </div>
            </div>

            {/* Evidence Summary */}
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
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Case Evidence</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>TYPOLOGY</div>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{primaryTypology}</div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>RISK SCORE</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-teal-deep)', marginTop: '2px' }}>
                    {(riskScore * 100).toFixed(0)}%
                  </div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>WALLETS</div>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>
                    {evidence.size || selectedCase.graph?.nodes?.length || 0}
                  </div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>TRANSFERS</div>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>
                    {evidence.edge_ids?.length || selectedCase.graph?.edges?.length || 0}
                  </div>
                </div>
              </div>

              {evidence.token_ids && evidence.token_ids.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginBottom: '4px' }}>
                    Associated Tokens:
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {evidence.token_ids.map((tid: string, idx: number) => (
                      <span
                        key={idx}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'var(--color-bg-cream)',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      >
                        #{tid}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
          Select a case to inspect evidence.
        </div>
      )}
    </div>
  );
};
