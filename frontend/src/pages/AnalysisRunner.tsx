import React, { useState, useEffect } from 'react';
import type { DatasetItem, AnalysisTaskStatus, PageView } from '../types';
import { startAnalysis, getAnalysisStatus } from '../services/api';

interface AnalysisRunnerProps {
  activeDataset: DatasetItem | undefined;
  onAnalysisCompleted: () => void;
  onNavigate: (view: PageView) => void;
}

export const AnalysisRunner: React.FC<AnalysisRunnerProps> = ({
  activeDataset,
  onAnalysisCompleted,
  onNavigate,
}) => {
  const [windowHours, setWindowHours] = useState(24.0);
  const [maxDwellHours, setMaxDwellHours] = useState(1.0);
  const [retentionLow, setRetentionLow] = useState(0.85);
  const [retentionHigh, setRetentionHigh] = useState(1.05);
  const [minChurn, setMinChurn] = useState(2);

  const [activeTask, setActiveTask] = useState<AnalysisTaskStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll task status
  useEffect(() => {
    let interval: any = null;
    if (activeTask && activeTask.status === 'running') {
      interval = setInterval(async () => {
        try {
          const status = await getAnalysisStatus(activeTask.task_id);
          setActiveTask(status);
          if (status.status === 'completed') {
            setIsRunning(false);
            onAnalysisCompleted();
          } else if (status.status === 'failed') {
            setIsRunning(false);
            setError(status.error || 'Pipeline execution failed');
          }
        } catch (e: any) {
          console.error(e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTask, onAnalysisCompleted]);

  const handleStart = async () => {
    if (!activeDataset) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await startAnalysis({
        dataset_id: activeDataset.id,
        window_hours: windowHours,
        max_dwell_hours: maxDwellHours,
        retention_low: retentionLow,
        retention_high: retentionHigh,
        min_churn_count: minChurn,
      });
      setActiveTask({
        task_id: res.task_id,
        dataset_id: res.dataset_id,
        status: 'running',
        progress: 5,
        current_step: 'Starting analysis daemon...',
        logs: ['Job submitted to pipeline orchestrator.'],
      });
    } catch (err: any) {
      setIsRunning(false);
      setError(err.message || 'Failed to start analysis');
    }
  };

  return (
    <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-ink)' }}>
          Research Analysis Engine & Parameter Tuning
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
          Configure mathematical graph criteria for Strongly Connected Components, time-ordered cycle detection,
          wallet flow conservation, and NFT wash trading.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
        {/* Left: Parameter Config */}
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div style={{ borderBottom: '1px solid var(--color-bg-sand)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Algorithmic Hyperparameters</h3>
            <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
              Target Dataset: <strong>{activeDataset?.name || 'None selected'}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
                <span>Sliding Time Window ($\Delta T$)</span>
                <span style={{ color: 'var(--color-teal-deep)', fontWeight: 700 }}>{windowHours} Hours</span>
              </div>
              <input
                type="range"
                min="6"
                max="168"
                step="6"
                value={windowHours}
                onChange={(e) => setWindowHours(Number(e.target.value))}
                style={{ width: '100%', marginTop: '6px' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                Maximum elapsed duration between the first and last transfer in a detected ring.
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
                <span>Max Mule Relay Dwell Time ($d(v)$)</span>
                <span style={{ color: 'var(--color-teal-deep)', fontWeight: 700 }}>{maxDwellHours} Hours</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="6.0"
                step="0.25"
                value={maxDwellHours}
                onChange={(e) => setMaxDwellHours(Number(e.target.value))}
                style={{ width: '100%', marginTop: '6px' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                Mule intermediate addresses typically hold and forward funds within $\le 1$ hour.
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
                <span>Flow Retention Conservation Band</span>
                <span style={{ color: 'var(--color-teal-deep)', fontWeight: 700 }}>
                  [{retentionLow}, {retentionHigh}]
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <input
                  type="number"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={retentionLow}
                  onChange={(e) => setRetentionLow(Number(e.target.value))}
                  style={{ width: '50%', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-linen)', fontSize: '12px' }}
                />
                <input
                  type="number"
                  min="1.0"
                  max="1.5"
                  step="0.05"
                  value={retentionHigh}
                  onChange={(e) => setRetentionHigh(Number(e.target.value))}
                  style={{ width: '50%', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-linen)', fontSize: '12px' }}
                />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                Flow conservation ratio: OutFlow / InFlow. Legitimate churn retains 85% to 105% of value.
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
                <span>Min Churn Count (Wash Trading)</span>
                <span style={{ color: 'var(--color-teal-deep)', fontWeight: 700 }}>{minChurn} Transfers</span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                step="1"
                value={minChurn}
                onChange={(e) => setMinChurn(Number(e.target.value))}
                style={{ width: '100%', marginTop: '6px' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                Minimum number of transactions involving the same token between colluding addresses.
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={isRunning || !activeDataset}
            style={{
              padding: '12px',
              backgroundColor: isRunning ? 'var(--color-linen)' : 'var(--color-teal-deep)',
              color: 'var(--color-bg-white)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              marginTop: '10px',
            }}
          >
            {isRunning ? 'Pipeline Executing...' : 'Execute Full Forensic Pipeline'}
          </button>

          {error && <div style={{ color: '#dc2626', fontSize: '12px' }}>{error}</div>}
        </div>

        {/* Right: Real-time Execution Tracker */}
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
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Execution Monitor & Progress</h3>

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                {activeTask?.current_step || 'Awaiting execution command'}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--color-teal-deep)' }}>
                {activeTask?.progress || 0}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--color-bg-sand)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${activeTask?.progress || 0}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-teal-deep)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Execution Logs Terminal */}
          <div
            style={{
              flex: 1,
              minHeight: '260px',
              backgroundColor: 'var(--color-ink)',
              color: '#d4d4d8',
              fontFamily: 'monospace',
              fontSize: '11px',
              padding: '16px',
              borderRadius: 'var(--radius-card)',
              overflowY: 'auto',
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: 'var(--color-accent-sage)', fontWeight: 600, marginBottom: '8px' }}>
              --- TraceFlow Forensic Engine v2.0 Execution Log ---
            </div>
            {activeTask?.logs && activeTask.logs.length > 0 ? (
              activeTask.logs.map((log, idx) => <div key={idx}>{log}</div>)
            ) : (
              <div style={{ color: '#71717a' }}>No active job running. Adjust parameters and click Execute.</div>
            )}
          </div>

          {activeTask?.status === 'completed' && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--color-bg-mint)',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-teal-deep)', fontSize: '13px' }}>
                  ✓ Analysis Finished Successfully
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-ink)' }}>
                  Graph clusters, wallet risk scores, and evidence objects persisted.
                </div>
              </div>
              <button
                onClick={() => onNavigate('cases')}
                style={{
                  padding: '6px 14px',
                  backgroundColor: 'var(--color-teal-deep)',
                  color: 'var(--color-bg-white)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Inspect Cases →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
