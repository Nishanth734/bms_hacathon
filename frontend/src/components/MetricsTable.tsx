import React from 'react';
import type { AblationRow } from '../types';

interface MetricsTableProps {
  ablation: AblationRow[];
  loading: boolean;
}

export const MetricsTable: React.FC<MetricsTableProps> = ({ ablation, loading }) => {
  if (loading && ablation.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
        Loading ablation benchmark...
      </div>
    );
  }

  // Find max values for highlighting
  const maxF1 = Math.max(...ablation.map((r) => r.f1), 0);
  const maxPrAuc = Math.max(...ablation.map((r) => r.pr_auc), 0);
  const minFalseAlerts = Math.min(...ablation.map((r) => r.false_alerts_per_day), 9999);

  return (
    <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-white)', borderRadius: 'var(--radius-card)', border: 'var(--border-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Four-Way Ablation Benchmark</h3>
          <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
            Evaluated on identical chronological test split (60/20/20). Threshold tuned on validation split only.
          </p>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-linen)', color: 'var(--color-ink-secondary)' }}>
              <th style={{ padding: '8px 10px' }}>Method</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Precision</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Recall</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>F1 Score</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>PR-AUC</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>P@20</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Alerts/Day</th>
            </tr>
          </thead>
          <tbody>
            {ablation.map((row) => {
              const isTraceFlow = row.method === 'D_traceflow';
              return (
                <tr
                  key={row.method}
                  style={{
                    borderBottom: '1px solid var(--color-linen)',
                    backgroundColor: isTraceFlow ? 'var(--color-bg-mint-soft)' : 'transparent',
                    fontWeight: isTraceFlow ? 600 : 400,
                  }}
                >
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isTraceFlow && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-teal-deep)',
                          }}
                        />
                      )}
                      <span>{row.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {row.precision.toFixed(3)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {row.recall.toFixed(3)}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: row.f1 === maxF1 ? 'var(--color-teal-deep)' : 'inherit',
                      fontWeight: row.f1 === maxF1 ? 700 : 'inherit',
                    }}
                  >
                    {row.f1.toFixed(3)}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: row.pr_auc === maxPrAuc ? 'var(--color-teal-deep)' : 'inherit',
                      fontWeight: row.pr_auc === maxPrAuc ? 700 : 'inherit',
                    }}
                  >
                    {row.pr_auc.toFixed(3)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {row.precision_at_k.toFixed(3)}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: row.false_alerts_per_day === minFalseAlerts ? 'var(--color-teal-deep)' : 'inherit',
                      fontWeight: row.false_alerts_per_day === minFalseAlerts ? 700 : 'inherit',
                    }}
                  >
                    {row.false_alerts_per_day.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
