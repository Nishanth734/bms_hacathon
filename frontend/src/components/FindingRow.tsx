import React from 'react';
import { ProbabilityGauge } from './ProbabilityGauge';

interface FindingRowProps {
  finding: string;
  probability: number;
  interval?: [number, number];
  threshold?: number;
  isSelectedHeatmap?: boolean;
  verdict?: 'Agree' | 'Disagree' | 'Uncertain';
  onSelectHeatmap?: () => void;
  onSetVerdict?: (verdict: 'Agree' | 'Disagree' | 'Uncertain') => void;
  readOnly?: boolean;
}

export const FindingRow: React.FC<FindingRowProps> = ({
  finding,
  probability,
  interval,
  threshold = 0.50,
  isSelectedHeatmap = false,
  verdict,
  onSelectHeatmap,
  onSetVerdict,
  readOnly = false,
}) => {
  const isElevated = probability >= threshold;

  return (
    <div
      className={`p-2.5 rounded-[2px] border transition-colors ${
        isSelectedHeatmap
          ? 'bg-[#1A2127] border-[#8E9AF0]/60'
          : 'bg-[#12171B] border-[#26303A] hover:border-[#66727D]'
      }`}
    >
      {/* Top Header: Finding Name & Heatmap Selection Pill */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={onSelectHeatmap}
          className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none"
        >
          <span className={`text-[13px] font-medium transition-colors ${isElevated ? 'text-[#E6EBEF]' : 'text-[#9AA7B2]'}`}>
            {finding}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-[2px] font-mono-num border transition-all ${
              isSelectedHeatmap
                ? 'bg-[#8E9AF0]/20 text-[#8E9AF0] border-[#8E9AF0]/40'
                : 'text-[#66727D] border-[#26303A] group-hover:border-[#66727D]'
            }`}
          >
            {isSelectedHeatmap ? 'HEATMAP ON' : 'VIEW CAM'}
          </span>
        </button>

        {/* Verdict Badge if recorded */}
        {verdict && (
          <span
            className={`text-[10px] font-mono-num font-medium px-1.5 py-0.5 rounded-[2px] ${
              verdict === 'Agree'
                ? 'bg-[#4FB3A5]/20 text-[#4FB3A5]'
                : verdict === 'Disagree'
                ? 'bg-[#FF4D4F]/20 text-[#FF4D4F]'
                : 'bg-[#F2A33A]/20 text-[#F2A33A]'
            }`}
          >
            {verdict.toUpperCase()}
          </span>
        )}
      </div>

      {/* Uncertainty Gauge */}
      <ProbabilityGauge
        probability={probability}
        interval={interval}
        threshold={threshold}
      />

      {/* Clinician Verdict Actions (Agree / Disagree / Uncertain per PRD Section 6 F6) */}
      {!readOnly && onSetVerdict && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#26303A]/60">
          <span className="text-[10px] uppercase tracking-wider text-[#66727D] mr-1">
            VERDICT:
          </span>
          <button
            onClick={() => onSetVerdict('Agree')}
            className={`px-2 py-0.5 text-[11px] font-mono-num rounded-[2px] border transition-colors ${
              verdict === 'Agree'
                ? 'bg-[#4FB3A5] text-[#0B0E11] font-semibold border-[#4FB3A5]'
                : 'bg-[#1A2127] text-[#9AA7B2] border-[#26303A] hover:text-[#E6EBEF]'
            }`}
          >
            AGREE (A)
          </button>
          <button
            onClick={() => onSetVerdict('Disagree')}
            className={`px-2 py-0.5 text-[11px] font-mono-num rounded-[2px] border transition-colors ${
              verdict === 'Disagree'
                ? 'bg-[#FF4D4F] text-[#0B0E11] font-semibold border-[#FF4D4F]'
                : 'bg-[#1A2127] text-[#9AA7B2] border-[#26303A] hover:text-[#E6EBEF]'
            }`}
          >
            DISAGREE (D)
          </button>
          <button
            onClick={() => onSetVerdict('Uncertain')}
            className={`px-2 py-0.5 text-[11px] font-mono-num rounded-[2px] border transition-colors ${
              verdict === 'Uncertain'
                ? 'bg-[#F2A33A] text-[#0B0E11] font-semibold border-[#F2A33A]'
                : 'bg-[#1A2127] text-[#9AA7B2] border-[#26303A] hover:text-[#E6EBEF]'
            }`}
          >
            UNCERTAIN (U)
          </button>
        </div>
      )}
    </div>
  );
};
