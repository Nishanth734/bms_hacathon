import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const res = await api.uploadStudies(fileList);
      setUploadResults(res.studies);
    } catch (err: any) {
      setError(err.message || 'Upload processing failed');
    } finally {
      setUploading(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#0B0E11] p-6 text-[#E6EBEF] font-mono-num space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-1 border-b border-[#26303A] pb-4">
        <h1 className="text-[18px] font-semibold tracking-wider uppercase text-[#E6EBEF]">
          Batch Study Ingestion & Quality Gate
        </h1>
        <p className="text-[12px] text-[#9AA7B2]">
          Upload chest radiographs in DICOM (.dcm), PNG, or JPEG format. Automated PHI de-identification and quality validation are applied instantly.
        </p>
      </div>

      {/* HIPAA De-identification Compliance Notice */}
      <div className="bg-[#12171B] border border-[#4FB3A5]/30 p-3.5 rounded-[2px] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#4FB3A5]" />
          <span className="text-[#E6EBEF]">
            <strong>AUTOMATED PHI STRIPPING:</strong> PatientName, PatientID, DOB, and institution metadata are stripped on ingestion. Only cryptographic study hashes are persisted.
          </span>
        </div>
        <span className="text-[#4FB3A5] font-semibold bg-[#4FB3A5]/10 px-2 py-0.5 rounded-[2px]">
          DE-IDENTIFIED
        </span>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-[4px] p-12 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-[#8E9AF0] bg-[#8E9AF0]/10'
            : 'border-[#26303A] bg-[#12171B] hover:border-[#66727D]'
        }`}
        onClick={() => document.getElementById('file-upload-input')?.click()}
      >
        <input
          id="file-upload-input"
          type="file"
          multiple
          accept=".dcm,.dicom,image/png,image/jpeg"
          onChange={e => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="space-y-3">
          <div className="text-[28px] text-[#8E9AF0]">↑</div>
          <div className="text-[14px] font-medium text-[#E6EBEF]">
            {uploading ? 'INGESTING & RUNNING CALIBRATED INFERENCE...' : 'Drag and drop DICOM / PNG files here'}
          </div>
          <div className="text-[11px] text-[#66727D]">
            Supports batch upload & folder ingestion • Max 50 studies per batch
          </div>
          <button
            type="button"
            className="mt-2 px-4 py-1.5 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] text-[#8E9AF0] rounded-[2px] text-[12px]"
          >
            SELECT LOCAL FILES
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#FF4D4F]/10 border border-[#FF4D4F]/30 rounded-[2px] text-[12px] text-[#FF4D4F]">
          {error}
        </div>
      )}

      {/* Ingestion Results Queue */}
      {uploadResults.length > 0 && (
        <div className="bg-[#12171B] border border-[#26303A] rounded-[2px] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#26303A] pb-2">
            <h3 className="text-[12px] font-semibold uppercase text-[#E6EBEF]">
              Ingestion Queue Completed ({uploadResults.length} studies)
            </h3>
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1 bg-[#4FB3A5]/20 hover:bg-[#4FB3A5]/30 text-[#4FB3A5] border border-[#4FB3A5]/40 rounded-[2px] text-[11px]"
            >
              VIEW IN WORKLIST →
            </button>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {uploadResults.map((s, i) => (
              <div
                key={s.id || i}
                onClick={() => navigate(`/study/${s.id}`)}
                className="flex items-center justify-between p-2 bg-[#1A2127] hover:bg-[#26303A] rounded-[2px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#9AA7B2]">#{i + 1}</span>
                  <span className="font-semibold text-[#E6EBEF]">{s.hashed_uid}</span>
                  <span className="text-[#66727D]">{s.source}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#8E9AF0]">{s.top_finding || 'No finding'}</span>
                  <span className="px-1.5 py-0.5 rounded-[2px] bg-[#0B0E11] text-[#E6EBEF] border border-[#26303A]">
                    {s.priority_tier}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
