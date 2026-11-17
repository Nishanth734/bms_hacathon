import React from 'react';
import { QueueHealthData } from '../types';

interface QueueHealthProps {
  data?: QueueHealthData;
  isOpen: boolean;
  onToggle: () => void;
}

export const QueueHealth: React.FC<QueueHealthProps> = ({ data, isOpen, onToggle }) => {
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-16 right-0 bg-[#12171B] border-l border-y border-[#26303A] text-[#9AA7B2] hover:text-[#E6EBEF] py-3 px-1.5 rounded-l-[4px] text-[11px] font-mono-num writing-vertical flex items-center gap-1.5 shadow-lg z-30"
        title="Open Queue Health Panel"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D4F] animate-pulse" />
        QUEUE HEALTH
      </button>
    );
  }

  const counts = data?.counts_by_tier || { Critical: 0, Urgent: 0, Routine: 0, 'Low-confidence': 0 };

  return (
    <div className="w-64 bg-[#12171B] border-l border-[#26303A] p-4 flex flex-col justify-between flex-shrink-0 z-30">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#26303A] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4FB3A5]" />
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-[#E6EBEF]">
              Queue Health
            </h3>
          </div>
          <button
            onClick={onToggle}
            className="text-[#66727D] hover:text-[#E6EBEF] text-[13px] font-mono-num p-0.5"
            title="Collapse Panel"
          >
            ✕
          </button>
        </div>

        {/* Triage Tier Distribution */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-mono-num tracking-wider text-[#66727D]">
            ACTIVE BY TIER
          </div>
          <div className="space-y-1.5 font-mono-num text-[12px]">
            <div className="flex justify-between items-center bg-[#1A2127] px-2 py-1.5 rounded-[2px] border-l-2 border-[#FF4D4F]">
              <span className="text-[#FF4D4F] flex items-center gap-1.5">
                <span>▲</span> Critical
              </span>
              <span className="font-semibold text-[#E6EBEF]">{counts.Critical}</span>
            </div>

            <div className="flex justify-between items-center bg-[#1A2127] px-2 py-1.5 rounded-[2px] border-l-2 border-[#F2A33A]">
              <span className="text-[#F2A33A] flex items-center gap-1.5">
                <span>◆</span> Urgent
              </span>
              <span className="font-semibold text-[#E6EBEF]">{counts.Urgent}</span>
            </div>

            <div className="flex justify-between items-center bg-[#1A2127] px-2 py-1.5 rounded-[2px] border-l-2 border-[#8E9AF0]">
              <span className="text-[#8E9AF0] flex items-center gap-1.5">
                <span>◌</span> Needs Read
              </span>
              <span className="font-semibold text-[#E6EBEF]">{counts['Low-confidence']}</span>
            </div>

            <div className="flex justify-between items-center bg-[#1A2127] px-2 py-1.5 rounded-[2px] border-l-2 border-[#4FB3A5]">
              <span className="text-[#4FB3A5] flex items-center gap-1.5">
                <span>●</span> Routine
              </span>
              <span className="font-semibold text-[#E6EBEF]">{counts.Routine}</span>
            </div>
          </div>
        </div>

        {/* Real-time Triage Metrics */}
        <div className="space-y-3 pt-2 border-t border-[#26303A]">
          <div className="text-[10px] uppercase font-mono-num tracking-wider text-[#66727D]">
            SLA STATUS & TIMING
          </div>

          <div className="bg-[#1A2127] p-2.5 rounded-[2px] border border-[#26303A] space-y-1.5 font-mono-num">
            <div className="text-[11px] text-[#9AA7B2] flex justify-between">
              <span>Oldest Critical:</span>
              <span className="text-[#FF4D4F] font-semibold">
                {data?.oldest_critical_wait_min != null
                  ? `${Number(data.oldest_critical_wait_min).toFixed(0)} min`
                  : 'None'}
              </span>
            </div>
            <div className="text-[11px] text-[#9AA7B2] flex justify-between">
              <span>SLA Breaches:</span>
              <span className={data?.sla_breaches_count ? 'text-[#FF4D4F] font-bold' : 'text-[#4FB3A5]'}>
                {data?.sla_breaches_count ?? 0}
              </span>
            </div>
            <div className="text-[11px] text-[#9AA7B2] flex justify-between">
              <span>Median Read Time:</span>
              <span className="text-[#E6EBEF]">
                {data?.median_read_time_min != null ? Number(data.median_read_time_min).toFixed(1) : '3.5'} min
              </span>
            </div>
          </div>
        </div>

        {/* Throughput */}
        <div className="space-y-2 pt-2 border-t border-[#26303A]">
          <div className="text-[10px] uppercase font-mono-num tracking-wider text-[#66727D]">
            READING ROOM STATS
          </div>
          <div className="text-[12px] font-mono-num text-[#E6EBEF] flex justify-between">
            <span className="text-[#9AA7B2]">Signed Today:</span>
            <span className="text-[#4FB3A5] font-semibold">{data?.signed_today_count ?? 0}</span>
          </div>
          <div className="text-[12px] font-mono-num text-[#E6EBEF] flex justify-between">
            <span className="text-[#9AA7B2]">Total Active:</span>
            <span>{data?.total_active ?? 0} studies</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-[#26303A] text-[10px] text-[#66727D] font-mono-num">
        REFRESH: LIVE STREAM
      </div>
    </div>
  );
};
