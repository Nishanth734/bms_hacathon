import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const SimulationPage: React.FC = () => {
  const [simData, setSimData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSim = async () => {
      try {
        const data = await api.getTriageSimulation();
        setSimData(data);
      } catch (err) {
        console.error('Failed to load simulation', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSim();
  }, []);

  if (loading || !simData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0B0E11] text-[#9AA7B2] font-mono-num text-[12px]">
        LOADING RETROSPECTIVE TRIAGE QUEUE REPLAY...
      </div>
    );
  }

  const summary = simData.summary || {};

  return (
    <div className="flex-1 overflow-auto bg-[#0B0E11] p-6 text-[#E6EBEF] font-mono-num space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1 border-b border-[#26303A] pb-4">
        <div className="inline-flex items-center gap-2 text-[10px] bg-[#1A2127] border border-[#26303A] text-[#8E9AF0] px-2 py-0.5 rounded-[2px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8E9AF0]" />
          RETROSPECTIVE REPLAY ENGINE
        </div>
        <h1 className="text-[18px] font-semibold tracking-wider uppercase text-[#E6EBEF]">
          Triage Impact Simulation: FIFO vs AI Prioritization
        </h1>
        <p className="text-[12px] text-[#9AA7B2]">
          Replays the 60-study cohort comparing standard arrival-order reading (FIFO) against calibrated AI triage.
        </p>
      </div>

      {/* Mandatory Retrospective Notice */}
      <div className="bg-[#12171B] border border-[#F2A33A]/30 p-3 rounded-[2px] text-[11px] text-[#F2A33A] flex items-center gap-2">
        <span>⚠</span>
        <span>
          <strong>DISCLAIMER:</strong> Simulation on retrospective data based on simulated arrival order from the NIH ChestX-ray14 cohort. Reading velocity modeled at standard 3.5 minutes per radiograph.
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#12171B] p-4 rounded-[2px] border border-[#26303A]">
          <div className="text-[10px] text-[#9AA7B2] uppercase">FIFO Critical Mean Wait</div>
          <div className="text-[22px] font-bold text-[#FF4D4F] mt-1">
            {summary.mean_time_to_read_critical_fifo_min} min
          </div>
          <div className="text-[10px] text-[#66727D]">Critical cases delayed in stack</div>
        </div>

        <div className="bg-[#12171B] p-4 rounded-[2px] border border-[#26303A]">
          <div className="text-[10px] text-[#9AA7B2] uppercase">AI Triage Critical Wait</div>
          <div className="text-[22px] font-bold text-[#4FB3A5] mt-1">
            {summary.mean_time_to_read_critical_ai_min} min
          </div>
          <div className="text-[10px] text-[#4FB3A5]">Read within immediate tier window</div>
        </div>

        <div className="bg-[#12171B] p-4 rounded-[2px] border border-[#26303A]">
          <div className="text-[10px] text-[#9AA7B2] uppercase">Critical Time Saved</div>
          <div className="text-[22px] font-bold text-[#8E9AF0] mt-1">
            -{summary.critical_time_saved_minutes} min
          </div>
          <div className="text-[10px] text-[#8E9AF0]">
            {summary.critical_time_saved_percentage}% reduction in delay
          </div>
        </div>

        <div className="bg-[#12171B] p-4 rounded-[2px] border border-[#26303A]">
          <div className="text-[10px] text-[#9AA7B2] uppercase">Critical SLA Breaches</div>
          <div className="text-[22px] font-bold text-[#E6EBEF] mt-1">
            <span className="text-[#FF4D4F]">{summary.critical_sla_breaches_fifo}</span> →{' '}
            <span className="text-[#4FB3A5]">{summary.critical_sla_breaches_ai}</span>
          </div>
          <div className="text-[10px] text-[#4FB3A5]">15-min target breaches eliminated</div>
        </div>
      </div>

      {/* Case-by-case comparison sample */}
      <div className="bg-[#12171B] border border-[#26303A] rounded-[2px] p-4 space-y-3">
        <h3 className="text-[12px] font-semibold text-[#E6EBEF] uppercase">
          Sample Queue Position Trajectory (Top 15 Cases)
        </h3>

        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="bg-[#1A2127] border-b border-[#26303A] text-[10px] text-[#66727D] uppercase">
            <tr>
              <th className="py-2 px-3">Case ID</th>
              <th className="py-2 px-3">Urgency Tier</th>
              <th className="py-2 px-3">FIFO Rank (Wait)</th>
              <th className="py-2 px-3">AI Triage Rank (Wait)</th>
              <th className="py-2 px-3">Time Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#26303A]">
            {simData.timeline_samples?.map((c: any) => {
              const delta = c.fifo_wait_min - c.ai_wait_min;
              const isCrit = c.tier === 'Critical';
              return (
                <tr key={c.case_id} className="hover:bg-[#1A2127]">
                  <td className="py-2 px-3 font-semibold text-[#E6EBEF]">{c.case_id}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded-[2px] ${
                        isCrit
                          ? 'bg-[#FF4D4F]/20 text-[#FF4D4F]'
                          : c.tier === 'Urgent'
                          ? 'bg-[#F2A33A]/20 text-[#F2A33A]'
                          : 'bg-[#4FB3A5]/20 text-[#4FB3A5]'
                      }`}
                    >
                      {c.tier}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[#9AA7B2]">
                    #{c.fifo_rank} ({c.fifo_wait_min}m)
                  </td>
                  <td className="py-2 px-3 font-semibold text-[#E6EBEF]">
                    #{c.ai_rank} ({c.ai_wait_min}m)
                  </td>
                  <td className="py-2 px-3">
                    {delta > 0 ? (
                      <span className="text-[#4FB3A5] font-semibold">
                        -{delta.toFixed(1)}m sooner
                      </span>
                    ) : delta < 0 ? (
                      <span className="text-[#66727D]">
                        +{Math.abs(delta).toFixed(1)}m (deprioritized)
                      </span>
                    ) : (
                      <span className="text-[#66727D]">Same</span>
                    )}
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
