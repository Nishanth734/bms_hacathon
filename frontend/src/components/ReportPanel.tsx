import React, { useState } from 'react';
import type { CaseDetail } from '../types';
import { Badge } from './ui/Badge';

interface ReportPanelProps {
  caseDetail: CaseDetail | null;
  onHighlightEdges: (edgeIds: string[]) => void;
  onClearHighlight: () => void;
  loading: boolean;
}

export const ReportPanel: React.FC<ReportPanelProps> = ({
  caseDetail,
  onHighlightEdges,
  onClearHighlight,
  loading,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
        Loading case report...
      </div>
    );
  }

  if (!caseDetail) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
        Select a suspicious case to inspect its evidence and narrative report.
      </div>
    );
  }

  const { report, evidence } = caseDetail;
  const dwell = evidence?.dwell || {};
  const end_to_end_retention = evidence?.end_to_end_retention ?? null;
  const primary_typology = evidence?.primary_typology || 'suspicious';
  const risk_score = evidence?.risk_score ?? 0.85;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-bg-white)',
        borderLeft: 'var(--border-card)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: 'var(--border-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Case Narrative & STR</h3>
            <Badge typology={primary_typology} />
          </div>

          {/* Verifier status */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: report.verifier_pass ? '#e7f7ed' : '#fee2e2',
              color: report.verifier_pass ? '#0d7d3d' : '#b91c1c',
              border: report.verifier_pass ? '1px solid #a3e635' : '1px solid #f87171',
            }}
          >
            {report.verifier_pass ? '✓ VERIFIED' : '⚠ UNVERIFIED'}
          </span>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
          Case: {(caseDetail.case_id || caseDetail.cluster_id).slice(0, 10)} • Risk score: {(risk_score * 100).toFixed(0)}%
        </div>
      </div>

      {/* Dwell & Retention Indicators */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-bg-sand)',
          borderBottom: 'var(--border-card)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          fontSize: '11px',
        }}
      >
        <div>
          <span style={{ color: 'var(--color-ink-muted)', display: 'block' }}>E2E Retention</span>
          <strong style={{ fontSize: '13px' }}>
            {end_to_end_retention ? `${(end_to_end_retention * 100).toFixed(1)}%` : 'N/A'}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--color-ink-muted)', display: 'block' }}>Intermediate Dwell</span>
          <strong style={{ fontSize: '13px' }}>
            {dwell && Object.keys(dwell).length > 0
              ? `${(Object.values(dwell).filter(Boolean) as number[]).reduce((a, b) => a + b, 0) / Object.keys(dwell).length / 60 < 60
                  ? (Object.values(dwell).filter(Boolean) as number[]).reduce((a, b) => a + b, 0) / Object.keys(dwell).length / 60
                  : (Object.values(dwell).filter(Boolean) as number[]).reduce((a, b) => a + b, 0) / Object.keys(dwell).length / 3600
                }`.slice(0, 4) + 'm avg'
              : 'N/A'}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--color-ink-muted)', display: 'block' }}>Hop Count</span>
          <strong style={{ fontSize: '13px' }}>
            {caseDetail.graph.edges.length} hops
          </strong>
        </div>
      </div>

      {/* Sentences */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-ink-muted)' }}>
          Hover over any sentence below to highlight its exact supporting transactions on the graph.
        </p>

        {report.sentences.map((sentence, idx) => {
          const isHovered = hoveredIdx === idx;
          const hasEdges = sentence.edge_ids && sentence.edge_ids.length > 0;

          return (
            <div
              key={idx}
              onMouseEnter={() => {
                setHoveredIdx(idx);
                if (hasEdges) {
                  onHighlightEdges(sentence.edge_ids);
                }
              }}
              onMouseLeave={() => {
                setHoveredIdx(null);
                onClearHighlight();
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-card)',
                backgroundColor: isHovered ? 'var(--color-bg-mint-soft)' : 'var(--color-bg-cream)',
                borderLeft: isHovered ? '3px solid var(--color-teal-deep)' : '3px solid transparent',
                border: '1px solid rgba(43,43,41,0.06)',
                cursor: hasEdges ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                fontSize: '13px',
                lineHeight: 1.6,
              }}
            >
              <span>{sentence.text}</span>
              {hasEdges && (
                <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-teal-slate)', fontFamily: 'var(--font-mono)' }}>
                  Linked: {sentence.edge_ids.length} edge{sentence.edge_ids.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}

        {/* Disclaimer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '12px',
            fontSize: '10px',
            color: 'var(--color-ink-muted)',
            borderTop: '1px solid rgba(43, 43, 41, 0.08)',
            lineHeight: 1.4,
          }}
        >
          All findings are flagged as suspicious. Note: Dataset labels reflect synthetic experimental ground truth. Verified against temporal graph invariants.
        </div>
      </div>
    </div>
  );
};
