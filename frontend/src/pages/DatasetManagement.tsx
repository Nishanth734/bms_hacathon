import React, { useState } from 'react';
import type { DatasetItem, PageView } from '../types';
import { uploadDataset, deleteDataset } from '../services/api';

interface DatasetManagementProps {
  datasets: DatasetItem[];
  activeDatasetId: string;
  onRefresh: () => void;
  onSelectDataset: (id: string) => Promise<void> | void;
  onNavigate?: (view: PageView) => void;
}

export const DatasetManagement: React.FC<DatasetManagementProps> = ({
  datasets,
  activeDatasetId,
  onRefresh,
  onSelectDataset,
  onNavigate,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStageIndex, setUploadStageIndex] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const UPLOAD_STAGES = [
    { name: 'Uploading dataset', desc: 'Buffering CSV file into forensic workspace' },
    { name: 'Validating columns', desc: 'Intelligently mapping headers, timestamps & party aliases' },
    { name: 'Processing records', desc: 'Decomposing temporal graph into SCCs and cycle loops' },
    { name: 'Generating analytics', desc: 'Evaluating dwell times, flow retention & LightGBM risk scores' },
    { name: 'Updating dashboard', desc: 'Synchronizing state and refreshing case queues across all views' },
  ];

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.name.endsWith('.csv')) {
        setFile(dropped);
        setError(null);
        setUploadResult(null);
      } else {
        setError('Only CSV files are supported.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadStageIndex(0);
    setError(null);
    setUploadResult(null);

    // Staged progression timer
    const stageTimer = setInterval(() => {
      setUploadStageIndex((prev) => (prev < UPLOAD_STAGES.length - 1 ? prev + 1 : prev));
    }, 700);

    try {
      const res = await uploadDataset(file, customName || undefined);
      clearInterval(stageTimer);
      setUploadStageIndex(UPLOAD_STAGES.length - 1);
      setUploadResult(res);
      setFile(null);
      setCustomName('');
      // Dynamically select and activate the newly uploaded dataset
      await onSelectDataset(res.dataset_id);
      onRefresh();
    } catch (err: any) {
      clearInterval(stageTimer);
      setError(err.message || 'CSV upload and validation failed');
    } finally {
      clearInterval(stageTimer);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this dataset?')) {
      try {
        await deleteDataset(id);
        onRefresh();
      } catch (err: any) {
        alert(err.message || 'Failed to delete dataset');
      }
    }
  };

  const activeDataset = datasets.find((d) => d.id === activeDatasetId);
  const totalRecords = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0);

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
              Dataset Ingestion & Management
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
              Multi-Schema Engine
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px', margin: 0 }}>
            Upload transaction datasets. The parser standardizes schemas, decomposes temporal graphs, and updates all analytics.
          </p>
        </div>

        {/* Global Summary Stats */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>Active Dataset</span>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-teal-deep)' }}>
              {activeDataset?.name || 'None'}
            </div>
          </div>
          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--color-linen)' }} />
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>Library Volume</span>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink)' }}>
              {datasets.length} files ({totalRecords.toLocaleString()} rows)
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload Drop Zone on Left, Schema Guide & Validation on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left: Drag-and-Drop Ingestion Card */}
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
          <div style={{ borderBottom: '1px solid var(--color-bg-sand)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                Upload New Dataset
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '1px' }}>
                Drop raw transaction CSV with automatic column normalization
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>CSV format only</span>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            style={{
              padding: '24px 20px',
              backgroundColor: 'var(--color-bg-cream)',
              border: '2px dashed var(--color-linen)',
              borderRadius: 'var(--radius-card)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-bg-mint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: 'var(--color-teal-deep)',
              }}
            >
              📂
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>
                {file ? file.name : 'Drag and drop transaction CSV file here'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                Auto-detects NFT marketplace transactions and AML banking format.
              </div>
            </div>

            <label
              style={{
                padding: '6px 14px',
                backgroundColor: uploading ? 'var(--color-bg-sand)' : 'var(--color-bg-white)',
                border: '1px solid var(--color-linen)',
                borderRadius: 'var(--radius-pill)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
                color: uploading ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                pointerEvents: uploading ? 'none' : 'auto',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              Browse Computer
              <input
                type="file"
                accept=".csv"
                disabled={uploading}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setError(null);
                    setUploadResult(null);
                  }
                }}
              />
            </label>
          </div>

          {/* File Selected & Upload Controls */}
          {file && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Dataset display label (optional)"
                value={customName}
                disabled={uploading}
                onChange={(e) => setCustomName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-linen)',
                  fontSize: '12px',
                  backgroundColor: uploading ? 'var(--color-bg-sand)' : 'var(--color-bg-white)',
                }}
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  padding: '7px 16px',
                  backgroundColor: uploading ? 'var(--color-ink-muted)' : 'var(--color-teal-deep)',
                  color: 'var(--color-bg-white)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {uploading ? 'Processing...' : 'Upload & Validate'}
              </button>
            </div>
          )}

          {/* Ingestion Progress Stages */}
          {uploading && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f0fdfa',
                borderRadius: '6px',
                border: '1px solid #99f6e4',
                fontSize: '11px',
                color: '#0f766e',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '11px', color: '#0f766e' }}>
                  ⚡ {UPLOAD_STAGES[uploadStageIndex].name}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#115e59' }}>
                  Step {uploadStageIndex + 1} / {UPLOAD_STAGES.length}
                </span>
              </div>
              <div style={{ color: '#115e59', fontSize: '11px' }}>
                {UPLOAD_STAGES[uploadStageIndex].desc}
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                {UPLOAD_STAGES.map((stg, sIdx) => (
                  <div
                    key={stg.name}
                    style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '2px',
                      backgroundColor: sIdx <= uploadStageIndex ? '#0d9488' : '#ccfbf1',
                      transition: 'background-color 0.25s ease',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                color: '#b91c1c',
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>Validation Failed: </strong> {error}
              </div>
              <button
                onClick={() => setError(null)}
                style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: '13px' }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right: Automated Schema Validation & Ingestion Result Card */}
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: 'var(--radius-card)',
            border: 'var(--border-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ borderBottom: '1px solid var(--color-bg-sand)', paddingBottom: '10px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
              Supported Schema Standards
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '1px' }}>
              Automatic mapping of alternate naming conventions and date formats
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '5px', border: '1px solid var(--color-linen)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink)' }}>NFT Market Log Schema</span>
                <span style={{ fontSize: '10px', color: '#0f766e', fontWeight: 600, backgroundColor: 'var(--color-bg-mint)', padding: '1px 6px', borderRadius: '3px' }}>
                  Auto-Detected
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                tx_hash · seller_address · buyer_address · token_id · price_eth
              </div>
            </div>

            <div style={{ padding: '8px 10px', backgroundColor: 'var(--color-bg-cream)', borderRadius: '5px', border: '1px solid var(--color-linen)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink)' }}>AML Banking Schema</span>
                <span style={{ fontSize: '10px', color: '#0f766e', fontWeight: 600, backgroundColor: 'var(--color-bg-mint)', padding: '1px 6px', borderRadius: '3px' }}>
                  Auto-Detected
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                Timestamp · From Bank · Account · To Bank · Account.1 · Amount Paid
              </div>
            </div>
          </div>

          {/* Upload Success Banner */}
          {uploadResult && (
            <div
              style={{
                marginTop: '4px',
                padding: '12px 14px',
                backgroundColor: 'var(--color-bg-mint)',
                borderRadius: '6px',
                border: '1px solid rgba(41, 106, 108, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-teal-deep)', fontSize: '12px' }}>
                  ✓ {uploadResult.name} Ingested
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-teal-deep)',
                    color: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  ACTIVE
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-ink)' }}>
                {uploadResult.schema_type.toUpperCase()} schema &bull; {uploadResult.row_count} records validated &bull; {uploadResult.wallet_count || 'All'} entities mapped.
              </div>
              {onNavigate && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <button
                    onClick={() => onNavigate('dashboard')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--color-teal-deep)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View in Dashboard &rarr;
                  </button>
                  <button
                    onClick={() => onNavigate('graph')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: '#ffffff',
                      color: 'var(--color-teal-deep)',
                      border: '1px solid var(--color-teal-deep)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Inspect Graph &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dataset Library Table Card */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--color-bg-white)',
          borderRadius: 'var(--radius-card)',
          border: 'var(--border-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
              Dataset Repository ({datasets.length})
            </h3>
            <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '1px' }}>
              Select an active dataset to provision the forensic graphs, case lists, and risk models.
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
            Active: <strong>{activeDataset?.name || 'None'}</strong>
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-linen)', color: 'var(--color-ink-secondary)' }}>
                <th style={{ padding: '8px 10px' }}>Dataset Name</th>
                <th style={{ padding: '8px 10px' }}>Schema</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Records</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Entities</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Volume</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => {
                const isActive = d.id === activeDatasetId;
                return (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: '1px solid var(--color-bg-sand)',
                      backgroundColor: isActive ? 'var(--color-bg-mint)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--color-ink)' }}>{d.name}</span>
                        {isActive && (
                          <span
                            style={{
                              padding: '1px 6px',
                              backgroundColor: 'var(--color-teal-deep)',
                              color: 'var(--color-bg-white)',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '9px',
                              fontWeight: 700,
                            }}
                          >
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontSize: '11px' }}>
                      {d.schema_type}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{d.row_count.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{d.wallet_count.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {d.total_volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} {d.currency}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: d.status === 'analyzed' ? '#dcfce7' : '#fef3c7',
                          color: d.status === 'analyzed' ? '#15803d' : '#b45309',
                        }}
                      >
                        {d.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        {!isActive && (
                          <button
                            onClick={() => onSelectDataset(d.id)}
                            style={{
                              padding: '3px 10px',
                              backgroundColor: 'var(--color-teal-deep)',
                              color: 'var(--color-bg-white)',
                              border: 'none',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Activate
                          </button>
                        )}
                        {d.id !== 'nft-sample-001' && d.id !== 'ibm-aml-001' && (
                          <button
                            onClick={() => handleDelete(d.id)}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: 'transparent',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '10px',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
