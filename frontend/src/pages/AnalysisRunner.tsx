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
        current_step: 'Initializing multi-hop graph pipeline...',
        logs: ['Job submitted to pipeline orchestrator.', 'Configuring graph temporal partitions and flow bounds.'],
      });
    } catch (err: any) {
      setIsRunning(false);
      setError(err.message || 'Failed to start analysis');
    }
  };

  const statusColor =
    activeTask?.status === 'completed'
      ? '#059669'
      : activeTask?.status === 'running'
      ? '#0284c7'
      : activeTask?.status === 'failed'
      ? '#b91c1c'
      : '#64748b';

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header Card */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
              Forensic Analysis & Tuning
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-bg-mint)',
                color: 'var(--color-teal-deep)',
              }}
            >
              Pipeline v2.0
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px', margin: 0 }}>
            Fine-tune temporal heuristics for Strongly Connected Components, time-ordered cycles, and flow conservation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>Target:</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: activeDataset ? '#f1f5f9' : '#fee2e2',
              color: activeDataset ? '#1e293b' : '#991b1b',
              border: '1px solid var(--color-linen)',
            }}
          >
            {activeDataset?.name || 'No Dataset Active'}
          </span>
        </div>
      </div>

      {/* Main Grid: Parameters on Left, Execution Monitor on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left: Parameter Configuration Card */}
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-bg-sand)', paddingBottom: '10px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                Detection Parameters
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '1px' }}>
                Algorithmic bounds for pattern extraction
              </div>
            </div>
            <button
              onClick={() => {
                setWindowHours(24.0);
                setMaxDwellHours(1.0);
                setRetentionLow(0.85);
                setRetentionHigh(1.05);
                setMinChurn(2);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '11px',
                color: 'var(--color-teal-deep)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Defaults
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Sliding Time Window */}
            <div style={{ backgroundColor: 'var(--color-bg-cream)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-linen)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>Sliding Temporal Window</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-teal-deep)',
                    backgroundColor: 'var(--color-bg-mint)',
                    padding: '1px 8px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  {windowHours} Hours
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="168"
                step="6"
                value={windowHours}
                onChange={(e) => setWindowHours(Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px', accentColor: 'var(--color-teal-deep)' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                Maximum duration between first and final hop in a detected laundering cluster.
              </div>
            </div>

            {/* Max Mule Dwell Time */}
            <div style={{ backgroundColor: 'var(--color-bg-cream)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-linen)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>Max Mule Dwell Time</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-teal-deep)',
                    backgroundColor: 'var(--color-bg-mint)',
                    padding: '1px 8px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  {maxDwellHours} Hours
                </span>
              </div>
              <input
                type="range"
                min="0.25"
                max="6.0"
                step="0.25"
                value={maxDwellHours}
                onChange={(e) => setMaxDwellHours(Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px', accentColor: 'var(--color-teal-deep)' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                Intermediate mule addresses typically forward illicit proceeds in under 1 hour.
              </div>
            </div>

            {/* Capital Retention Band */}
            <div style={{ backgroundColor: 'var(--color-bg-cream)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-linen)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>Capital Retention Ratio</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-teal-deep)',
                    backgroundColor: 'var(--color-bg-mint)',
                    padding: '1px 8px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  {(retentionLow * 100).toFixed(0)}% – {(retentionHigh * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>Min Ratio</span>
                  <input
                    type="number"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={retentionLow}
                    onChange={(e) => setRetentionLow(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '2px', padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--color-linen)', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>Max Ratio</span>
                  <input
                    type="number"
                    min="1.0"
                    max="1.5"
                    step="0.05"
                    value={retentionHigh}
                    onChange={(e) => setRetentionHigh(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '2px', padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--color-linen)', fontSize: '11px' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                OutFlow / InFlow conservation band. Legitimate pass-through preserves 85% to 105%.
              </div>
            </div>

            {/* Min Churn Count */}
            <div style={{ backgroundColor: 'var(--color-bg-cream)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-linen)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>Min Churn Count</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-teal-deep)',
                    backgroundColor: 'var(--color-bg-mint)',
                    padding: '1px 8px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  {minChurn} Transfers
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                step="1"
                value={minChurn}
                onChange={(e) => setMinChurn(Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px', accentColor: 'var(--color-teal-deep)' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                Minimum repeated transactions between colluding accounts on identical assets.
              </div>
            </div>
          </div>

          {/* Execution Button */}
          <button
            onClick={handleStart}
            disabled={isRunning || !activeDataset}
            style={{
              padding: '10px 16px',
              backgroundColor: isRunning ? 'var(--color-linen)' : 'var(--color-teal-deep)',
              color: isRunning ? 'var(--color-ink-muted)' : 'var(--color-bg-white)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isRunning || !activeDataset ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isRunning ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙</span>
                Pipeline Executing...
              </>
            ) : (
              '⚡ Execute Forensic Pipeline'
            )}
          </button>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                color: '#b91c1c',
                fontSize: '11px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Right: Real-time Execution Tracker Card */}
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Tracker Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-bg-sand)', paddingBottom: '10px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                Execution Monitor
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '1px' }}>
                Pipeline daemon & process telemetry
              </div>
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: `${statusColor}18`,
                color: statusColor,
                border: `1px solid ${statusColor}33`,
              }}
            >
              {(activeTask?.status || 'IDLE').toUpperCase()}
            </span>
          </div>

          {/* Progress Bar Component */}
          <div style={{ backgroundColor: 'var(--color-bg-cream)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-linen)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                {activeTask?.current_step || 'Awaiting execution trigger'}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--color-teal-deep)' }}>
                {activeTask?.progress || 0}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: 'var(--color-linen)',
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

          {/* Sleek Terminal Box */}
          <div
            style={{
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #27272a',
              backgroundColor: '#09090b',
            }}
          >
            {/* Terminal Header */}
            <div
              style={{
                padding: '6px 12px',
                backgroundColor: '#18181b',
                borderBottom: '1px solid #27272a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308', display: 'inline-block' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
              </div>
              <span style={{ fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}>
                traceflow-engine.log
              </span>
            </div>

            {/* Terminal Output */}
            <div
              style={{
                height: '240px',
                padding: '12px',
                color: '#e4e4e7',
                fontFamily: 'monospace',
                fontSize: '11px',
                lineHeight: 1.6,
                overflowY: 'auto',
              }}
            >
              <div style={{ color: '#2dd4bf', fontWeight: 600, marginBottom: '6px' }}>
                $ traceflow --daemon --dataset {activeDataset?.id || 'none'}
              </div>
              {activeTask?.logs && activeTask.logs.length > 0 ? (
                activeTask.logs.map((log, idx) => (
                  <div key={idx} style={{ color: log.includes('ERR') ? '#f87171' : log.includes('✓') ? '#4ade80' : '#d4d4d8' }}>
                    {log}
                  </div>
                ))
              ) : (
                <div style={{ color: '#71717a' }}>No active job. Configure parameters and click Execute.</div>
              )}
            </div>
          </div>

          {/* Success Banner */}
          {activeTask?.status === 'completed' && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--color-bg-mint)',
                borderRadius: '6px',
                border: '1px solid rgba(41, 106, 108, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-teal-deep)', fontSize: '12px' }}>
                  ✓ Pipeline Execution Completed
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
                  Graph clusters, feature matrices, and risk scores updated.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onNavigate('cases')}
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
                  Inspect Cases →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
