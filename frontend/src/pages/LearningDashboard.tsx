import React, { useState, useEffect } from 'react';
import type { PageView } from '../types';
import {
  getLearningStatus,
  getLearningQueue,
  getCaseStoreCases,
  createIncident,
  extractIncidentFromText,
  approveIncident,
  rejectIncident,
  triggerRetrain,
  getModels,
  rollbackModel,
  submitFeedback,
} from '../services/api';

interface LearningDashboardProps {
  onNavigate: (view: PageView) => void;
}

export const LearningDashboard: React.FC<LearningDashboardProps> = ({ onNavigate: _onNavigate }) => {
  // Status ribbon state
  const [status, setStatus] = useState<any>({
    active_version: 1,
    cases_waiting_retrain: 0,
    min_cases_to_retrain: 5,
    gate_status: 'passed',
    last_retrain: null,
    pending_cases: 0,
    approved_cases: 0,
    rejected_cases: 0,
  });

  // Uncertainty review queue
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Case Store
  const [cases, setCases] = useState<any[]>([]);
  const [caseFilter, setCaseFilter] = useState<'ALL' | 'approved' | 'pending' | 'rejected'>('ALL');
  const [casesLoading, setCasesLoading] = useState(false);

  // Model Versions & Retrain
  const [models, setModels] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState<number>(1);
  const [retraining, setRetraining] = useState(false);
  const [retrainModalOpen, setRetrainModalOpen] = useState(false);
  const [overrideMin, setOverrideMin] = useState(false);
  const [retrainResult, setRetrainResult] = useState<any>(null);

  // Rollback dialog
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // Add Incident Modal
  const [addIncidentOpen, setAddIncidentOpen] = useState(false);
  const [incidentTab, setIncidentTab] = useState<'paste' | 'manual'>('paste');
  const [reportText, setReportText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<any>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Manual incident form
  const [manualTitle, setManualTitle] = useState('');
  const [manualSourceRef, setManualSourceRef] = useState('');
  const [manualTypology, setManualTypology] = useState('cycle');
  const [manualTxs, setManualTxs] = useState<any[]>([
    { src: 'BankA_001', dst: 'BankB_002', amount: 50000, currency: 'USD', ts: Date.now() / 1000 },
    { src: 'BankB_002', dst: 'BankC_003', amount: 49000, currency: 'USD', ts: Date.now() / 1000 + 1800 },
  ]);
  const [savingIncident, setSavingIncident] = useState(false);

  // Toast message
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllData = async () => {
    try {
      const s = await getLearningStatus();
      setStatus(s);
      setActiveVersion(s.active_version);
    } catch (e) {
      console.error('Failed to load learning status:', e);
    }

    setQueueLoading(true);
    try {
      const q = await getLearningQueue(30);
      setQueue(q);
    } catch (e) {
      console.error('Failed to load queue:', e);
    } finally {
      setQueueLoading(false);
    }

    setCasesLoading(true);
    try {
      const c = await getCaseStoreCases(caseFilter);
      setCases(c);
    } catch (e) {
      console.error('Failed to load case store:', e);
    } finally {
      setCasesLoading(false);
    }

    try {
      const m = await getModels();
      setModels(m.models || []);
      if (m.active_version) setActiveVersion(m.active_version);
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [caseFilter]);

  // Quick feedback handler in uncertainty queue
  const handleQueueFeedback = async (clusterId: string, decision: 'confirm' | 'reject' | 'unsure') => {
    try {
      await submitFeedback({ cluster_id: clusterId, decision, analyst: 'AML Analyst' });
      showToast(`Decision recorded: ${decision.toUpperCase()} for ${clusterId}`);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback');
    }
  };

  // Case store approve / reject
  const handleApproveCase = async (caseId: string) => {
    try {
      await approveIncident(caseId, 'Supervising AML Officer');
      showToast(`Case ${caseId.slice(0, 8)} approved for training`);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleRejectCase = async (caseId: string) => {
    try {
      await rejectIncident(caseId, 'Supervising AML Officer');
      showToast(`Case ${caseId.slice(0, 8)} rejected`);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    }
  };

  // AI Extract Incident
  const handleExtract = async () => {
    if (!reportText.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setExtractedPreview(null);
    try {
      const res = await extractIncidentFromText(reportText);
      setExtractedPreview(res);
    } catch (err: any) {
      setExtractError(err.message || 'Anti-hallucination verification failed: facts could not be grounded in source text.');
    } finally {
      setExtracting(false);
    }
  };

  // Save Incident
  const handleSaveExtractedIncident = async () => {
    if (!extractedPreview) return;
    setSavingIncident(true);
    try {
      await createIncident(extractedPreview);
      showToast('Incident saved to Case Store (Pending approval)');
      setAddIncidentOpen(false);
      setExtractedPreview(null);
      setReportText('');
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to save incident');
    } finally {
      setSavingIncident(false);
    }
  };

  const handleSaveManualIncident = async () => {
    if (!manualTitle.trim()) {
      alert('Please enter an incident title');
      return;
    }
    setSavingIncident(true);
    try {
      await createIncident({
        title: manualTitle,
        source_ref: manualSourceRef || 'Manual Entry SAR',
        typology: manualTypology,
        transactions: manualTxs,
      });
      showToast('Incident recorded to Case Store (Pending approval)');
      setAddIncidentOpen(false);
      setManualTitle('');
      setManualSourceRef('');
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to create incident');
    } finally {
      setSavingIncident(false);
    }
  };

  // Retrain execution
  const handleTriggerRetrain = async () => {
    setRetraining(true);
    setRetrainResult(null);
    try {
      const res = await triggerRetrain(overrideMin);
      setRetrainResult(res);
      if (res.promoted) {
        showToast(`Model successfully upgraded to ranker_v${res.version}! Safety gate passed.`);
      } else {
        showToast(`Candidate blocked by Safety Gate: ${res.reason}`);
      }
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Retraining failed');
    } finally {
      setRetraining(false);
    }
  };

  // Rollback execution
  const handleRollback = async (ver: number) => {
    setRollingBack(true);
    try {
      await rollbackModel(ver);
      showToast(`Model rolled back to ranker_v${ver}`);
      setRollbackTarget(null);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Rollback failed');
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            padding: '12px 20px',
            borderRadius: 'var(--radius-card)',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✓</span> {toast}
        </div>
      )}

      {/* Header & Status Ribbon */}
      <div
        style={{
          padding: '20px 24px',
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                Continuous Learning Loop
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                }}
              >
                ranker_v{status.active_version}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', marginTop: '4px', maxWidth: '850px', lineHeight: 1.4 }}>
              Human-approved cases and real caught laundering incidents continuously adapt the LightGBM ranker. New models deploy strictly through an automated frozen-validation safety gate.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setAddIncidentOpen(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-bg-mint)',
                color: 'var(--color-teal-deep)',
                border: '1px solid rgba(41, 106, 108, 0.2)',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Ingest Incident
            </button>
            <button
              onClick={() => {
                setRetrainModalOpen(true);
                setRetrainResult(null);
              }}
              style={{
                padding: '8px 18px',
                backgroundColor: 'var(--color-teal-deep)',
                color: 'var(--color-bg-white)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retrain Model
            </button>
          </div>
        </div>

        {/* Ribbon Metric Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-bg-sand)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-linen)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Ranker</span>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '2px' }}>
              ranker_v{status.active_version}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>Production artifact</span>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-bg-sand)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-linen)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Training Cases Ready</span>
            <div style={{ fontSize: '16px', fontWeight: 700, color: status.cases_waiting_retrain >= status.min_cases_to_retrain ? '#059669' : 'var(--color-ink)', marginTop: '2px' }}>
              {status.cases_waiting_retrain} / {status.min_cases_to_retrain}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
              {status.cases_waiting_retrain >= status.min_cases_to_retrain ? 'Quota met for retraining' : 'Awaiting additional approvals'}
            </span>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-bg-sand)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-linen)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Safety Gate Status</span>
            <div style={{ fontSize: '16px', fontWeight: 700, color: status.gate_status === 'passed' ? '#059669' : '#b91c1c', marginTop: '2px' }}>
              {status.gate_status === 'passed' ? 'Passing (≤ 0.01 drop)' : 'Blocked'}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>Evaluated on frozen validation</span>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-bg-sand)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-linen)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Case Store Pipeline</span>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '2px' }}>
              {status.pending_cases} Pending · {status.approved_cases} Approved
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>{status.total_cases} total human decisions</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Section A (Uncertainty Queue) & Section B (Case Store) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
        
        {/* Section A: Uncertainty Review Queue */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Uncertainty Review Queue
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                Sorted by model uncertainty (|score - 0.5|). Cases tagged "Unsure" are prioritized.
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-teal-deep)' }}>
              {queue.length} items
            </span>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-linen)', color: 'var(--color-ink-secondary)' }}>
                  <th style={{ padding: '8px' }}>Case / Cluster</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Score</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Uncertainty</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueLoading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                      Evaluating model uncertainty...
                    </td>
                  </tr>
                ) : queue.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                      No uncertain cases in queue.
                    </td>
                  </tr>
                ) : (
                  queue.map((item) => {
                    const cid = item.cluster_id || item.case_id;
                    const isUnsure = item.is_unsure || item.unsure_flag;
                    return (
                      <tr key={cid} style={{ borderBottom: '1px solid var(--color-bg-sand)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{cid.slice(0, 10)}</span>
                            {isUnsure && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-pill)',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                }}
                              >
                                ? UNSURE
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                            {item.primary_typology || 'suspicious'} · {item.account_count || item.size || 0} wallets
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-teal-deep)' }}>
                          {(item.score * 100).toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
                          ±{(((item.uncertainty !== undefined && !isNaN(item.uncertainty)) ? item.uncertainty : Math.abs((item.score || 0.5) - 0.5)) * 100).toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleQueueFeedback(cid, 'confirm')}
                              title="Confirm (Label 1)"
                              style={{
                                padding: '3px 8px',
                                backgroundColor: '#059669',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => handleQueueFeedback(cid, 'reject')}
                              title="Reject (Label 0)"
                              style={{
                                padding: '3px 8px',
                                backgroundColor: '#475569',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                            <button
                              onClick={() => handleQueueFeedback(cid, 'unsure')}
                              title="Unsure"
                              style={{
                                padding: '3px 8px',
                                backgroundColor: '#d97706',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ?
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section B: Human-Approved Case Store */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Human-Approved Case Store
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                All analyst decisions and external incident entries stored with full audit logging.
              </p>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-bg-sand)', padding: '2px', borderRadius: '4px' }}>
              {(['ALL', 'approved', 'pending', 'rejected'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCaseFilter(tab)}
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: caseFilter === tab ? 600 : 500,
                    border: 'none',
                    borderRadius: '3px',
                    backgroundColor: caseFilter === tab ? 'var(--color-bg-white)' : 'transparent',
                    color: caseFilter === tab ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-linen)', color: 'var(--color-ink-secondary)' }}>
                  <th style={{ padding: '8px' }}>Case ID</th>
                  <th style={{ padding: '8px' }}>Source</th>
                  <th style={{ padding: '8px' }}>Typology</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Label</th>
                  <th style={{ padding: '8px' }}>Status</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {casesLoading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                      Loading case store...
                    </td>
                  </tr>
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                      No records in case store for filter.
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => {
                    const isPending = c.status === 'pending';
                    const isApproved = c.status === 'approved';
                    return (
                      <tr key={c.case_id} style={{ borderBottom: '1px solid var(--color-bg-sand)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                          <div style={{ color: 'var(--color-ink)' }}>{c.case_id.slice(0, 10)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--color-ink-muted)' }}>
                            {c.approved_by ? `By: ${c.approved_by}` : 'Pending supervisor'}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              backgroundColor: c.source === 'incident' ? '#f3e8ff' : '#f1f5f9',
                              color: c.source === 'incident' ? '#6b21a8' : '#334155',
                              fontWeight: 600,
                              fontSize: '10px',
                            }}
                          >
                            {c.source}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '11px' }}>
                          {c.typology}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                          <span
                            style={{
                              color: c.label === 1 ? '#059669' : '#64748b',
                            }}
                          >
                            {c.label === 1 ? '1 (Suspicious)' : '0 (Benign)'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: isApproved ? '#d1fae5' : isPending ? '#fef3c7' : '#fee2e2',
                              color: isApproved ? '#065f46' : isPending ? '#92400e' : '#991b1b',
                            }}
                          >
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleApproveCase(c.case_id)}
                                style={{
                                  padding: '3px 8px',
                                  backgroundColor: '#059669',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectCase(c.case_id)}
                                style={{
                                  padding: '3px 8px',
                                  backgroundColor: '#475569',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>✓ Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section D: Model Versions & Safety Gate History */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Model Version History & Safety Gate Audit
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
              LightGBM rankers trained with approved cases. Candidates are promoted only if metric drop on frozen validation split ≤ 0.01.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-linen)', color: 'var(--color-ink-secondary)' }}>
                <th style={{ padding: '8px' }}>Version</th>
                <th style={{ padding: '8px' }}>Created</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Approved Cases Used</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Frozen PR-AUC</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Frozen F1</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Safety Gate</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                    No model version history recorded yet.
                  </td>
                </tr>
              ) : (
                models.map((m) => {
                  const isActive = m.version === activeVersion;
                  const passed = m.gate_passed;
                  return (
                    <tr key={m.version} style={{ borderBottom: '1px solid var(--color-bg-sand)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                        ranker_v{m.version}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
                        {m.timestamp ? new Date(m.timestamp).toLocaleString() : 'Baseline'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {m.approved_cases_count ?? 0}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-teal-deep)' }}>
                        {(m.pr_auc * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                        {(m.f1 * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: passed ? '#d1fae5' : '#fee2e2',
                            color: passed ? '#065f46' : '#991b1b',
                          }}
                        >
                          {passed ? 'PASSED' : 'BLOCKED'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {isActive ? (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: 'var(--color-bg-mint)',
                              color: 'var(--color-teal-deep)',
                            }}
                          >
                            ● ACTIVE
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>Archived</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {!isActive && (
                          <button
                            onClick={() => setRollbackTarget(m.version)}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: 'var(--color-bg-sand)',
                              color: 'var(--color-ink)',
                              border: '1px solid var(--color-linen)',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Rollback
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retrain Confirmation Modal */}
      {retrainModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(43, 43, 41, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '24px',
          }}
          onClick={() => setRetrainModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-card)',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Retrain Forensic Ranker
              </h2>
              <button
                onClick={() => setRetrainModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-ink-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', lineHeight: 1.5 }}>
              Retraining initiates LightGBM candidate fitting incorporating approved analyst labels and ingested incidents with sample weighting capped at 20%.
              <div style={{ marginTop: '8px', padding: '10px 14px', backgroundColor: 'var(--color-bg-sand)', borderRadius: '4px', border: '1px solid var(--color-linen)' }}>
                <strong>Safety Gate Rule:</strong> The candidate will deploy to production ONLY if validation PR-AUC and F1 degrade by ≤ 0.01 on the frozen validation partition.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="overrideMin"
                checked={overrideMin}
                onChange={(e) => setOverrideMin(e.target.checked)}
              />
              <label htmlFor="overrideMin" style={{ fontSize: '12px', color: 'var(--color-ink-secondary)' }}>
                Override minimum threshold (proceed with {status.cases_waiting_retrain} approved cases)
              </label>
            </div>

            {retrainResult && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: retrainResult.promoted ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${retrainResult.promoted ? '#a7f3d0' : '#fecaca'}`,
                  color: retrainResult.promoted ? '#065f46' : '#991b1b',
                }}
              >
                {retrainResult.promoted ? (
                  <div>
                    <strong>✓ Promotion Successful:</strong> Active model is now ranker_v{retrainResult.version}.
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                      Val PR-AUC: {(retrainResult.metrics?.val_pr_auc_new * 100).toFixed(1)}% · Val F1: {(retrainResult.metrics?.val_f1_new * 100).toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong>✕ Safety Gate Blocked:</strong> {retrainResult.reason}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={() => setRetrainModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-linen)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerRetrain}
                disabled={retraining || (!overrideMin && status.cases_waiting_retrain < status.min_cases_to_retrain)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'var(--color-teal-deep)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: retraining ? 'not-allowed' : 'pointer',
                }}
              >
                {retraining ? 'Fitting & Evaluating Gate...' : 'Execute Retrain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {rollbackTarget !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(43, 43, 41, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '24px',
          }}
          onClick={() => setRollbackTarget(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-card)',
              maxWidth: '460px',
              width: '100%',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Confirm Rollback to ranker_v{rollbackTarget}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', lineHeight: 1.4 }}>
              Restores model weights from version {rollbackTarget} and immediately re-scores all candidate clusters in the active database.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => setRollbackTarget(null)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-linen)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRollback(rollbackTarget)}
                disabled={rollingBack}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#b91c1c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: rollingBack ? 'not-allowed' : 'pointer',
                }}
              >
                {rollingBack ? 'Restoring...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Incident Modal */}
      {addIncidentOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(43, 43, 41, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '24px',
          }}
          onClick={() => setAddIncidentOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-card)',
              maxWidth: '680px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                  Ingest Laundering Incident
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                  Incident transactions receive distinct offset IDs and remain pending until supervisor approval.
                </p>
              </div>
              <button
                onClick={() => setAddIncidentOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-ink-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-linen)', paddingBottom: '8px' }}>
              <button
                onClick={() => setIncidentTab('paste')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  backgroundColor: incidentTab === 'paste' ? 'var(--color-bg-mint)' : 'transparent',
                  color: incidentTab === 'paste' ? 'var(--color-teal-deep)' : 'var(--color-ink-secondary)',
                  fontWeight: incidentTab === 'paste' ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Paste STR / Intelligence Report
              </button>
              <button
                onClick={() => setIncidentTab('manual')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  backgroundColor: incidentTab === 'manual' ? 'var(--color-bg-mint)' : 'transparent',
                  color: incidentTab === 'manual' ? 'var(--color-teal-deep)' : 'var(--color-ink-secondary)',
                  fontWeight: incidentTab === 'manual' ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Manual Entry
              </button>
            </div>

            {incidentTab === 'paste' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                    UNSTRUCTURED INTELLIGENCE REPORT
                  </label>
                  <textarea
                    rows={5}
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="On 15 Oct, BankA_001 transferred $50,000 to BankB_002. Later BankB_002 sent $49,000 to BankC_003..."
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '10px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-linen)',
                      fontSize: '12px',
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    onClick={handleExtract}
                    disabled={extracting || !reportText.trim()}
                    style={{
                      padding: '6px 14px',
                      backgroundColor: 'var(--color-bg-sand)',
                      color: 'var(--color-ink)',
                      border: '1px solid var(--color-linen)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: extracting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {extracting ? 'Verifying Grounding...' : 'Extract with Anti-Hallucination Verification'}
                  </button>
                </div>

                {extractError && (
                  <div
                    style={{
                      padding: '10px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '4px',
                      color: '#b91c1c',
                      fontSize: '12px',
                    }}
                  >
                    {extractError}
                  </div>
                )}

                {extractedPreview && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--color-bg-sand)',
                      borderRadius: '4px',
                      border: '1px solid var(--color-linen)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>
                        ✓ Grounded Verification Passed
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                        Typology: {extractedPreview.typology}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
                      Identified {extractedPreview.transactions?.length || 0} transactions:
                    </div>

                    <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                      {extractedPreview.transactions?.map((t: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '11px', padding: '3px 0', borderBottom: '1px dotted var(--color-linen)' }}>
                          <strong>{t.src}</strong> → <strong>{t.dst}</strong>: ${t.amount?.toLocaleString()} {t.currency}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSaveExtractedIncident}
                      disabled={savingIncident}
                      style={{
                        marginTop: '8px',
                        padding: '8px 16px',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: savingIncident ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {savingIncident ? 'Ingesting...' : 'Save Incident to Case Store'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>INCIDENT TITLE</label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Mule Syndicate Relay 2026"
                    style={{ width: '100%', marginTop: '4px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-linen)', fontSize: '12px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>SOURCE REFERENCE</label>
                    <input
                      type="text"
                      value={manualSourceRef}
                      onChange={(e) => setManualSourceRef(e.target.value)}
                      placeholder="e.g. SAR Bulletin Ref #49"
                      style={{ width: '100%', marginTop: '4px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-linen)', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>TYPOLOGY</label>
                    <select
                      value={manualTypology}
                      onChange={(e) => setManualTypology(e.target.value)}
                      style={{ width: '100%', marginTop: '4px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-linen)', fontSize: '12px', backgroundColor: 'var(--color-bg-cream)' }}
                    >
                      <option value="cycle">Cycle</option>
                      <option value="pass_through">Pass Through</option>
                      <option value="fan_in_out">Fan-In / Fan-Out</option>
                      <option value="other">Other Suspicious</option>
                    </select>
                  </div>
                </div>

                {/* Transactions Table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>TRANSACTIONS</label>
                    <button
                      onClick={() => setManualTxs([...manualTxs, { src: '', dst: '', amount: 10000, currency: 'USD', ts: Date.now() / 1000 }])}
                      style={{ background: 'none', border: 'none', color: 'var(--color-teal-deep)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Add Row
                    </button>
                  </div>

                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {manualTxs.map((tx, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 60px 30px', gap: '6px', marginBottom: '6px' }}>
                        <input
                          placeholder="Sender"
                          value={tx.src}
                          onChange={(e) => {
                            const updated = [...manualTxs];
                            updated[idx].src = e.target.value;
                            setManualTxs(updated);
                          }}
                          style={{ padding: '4px 6px', fontSize: '11px', border: '1px solid var(--color-linen)', borderRadius: '3px' }}
                        />
                        <input
                          placeholder="Receiver"
                          value={tx.dst}
                          onChange={(e) => {
                            const updated = [...manualTxs];
                            updated[idx].dst = e.target.value;
                            setManualTxs(updated);
                          }}
                          style={{ padding: '4px 6px', fontSize: '11px', border: '1px solid var(--color-linen)', borderRadius: '3px' }}
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={tx.amount}
                          onChange={(e) => {
                            const updated = [...manualTxs];
                            updated[idx].amount = parseFloat(e.target.value) || 0;
                            setManualTxs(updated);
                          }}
                          style={{ padding: '4px 6px', fontSize: '11px', border: '1px solid var(--color-linen)', borderRadius: '3px' }}
                        />
                        <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', color: 'var(--color-ink-muted)' }}>USD</span>
                        <button
                          onClick={() => setManualTxs(manualTxs.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    onClick={handleSaveManualIncident}
                    disabled={savingIncident}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: 'var(--color-teal-deep)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: savingIncident ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {savingIncident ? 'Ingesting...' : 'Save Incident to Case Store'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
