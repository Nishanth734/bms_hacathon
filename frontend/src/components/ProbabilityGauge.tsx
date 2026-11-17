import React from 'react';

interface ProbabilityGaugeProps {
  probability: number;                  // 0.0 to 1.0
  interval?: [number, number];          // [lower, upper] 95% interval
  threshold?: number;                  // Clinical cutoff tick (e.g. 0.60 or 0.50)
  compact?: boolean;
}

export const ProbabilityGauge: React.FC<ProbabilityGaugeProps> = ({
  probability,
  interval = [Math.max(0, probability - 0.08), Math.min(1, probability + 0.08)],
  threshold = 0.50,
  compact = false,
}) => {
  const p = Math.max(0, Math.min(1, probability));
  const [lower, upper] = interval;
  const leftPct = Math.max(0, lower) * 100;
  const widthPct = Math.max(2, (Math.min(1, upper) - Math.max(0, lower)) * 100);
  const dotPct = p * 100;
  const threshPct = threshold * 100;

  const isCriticalFinding = p >= threshold && threshold >= 0.55;
  const dotColor = isCriticalFinding ? 'bg-[#FF4D4F]' : (p >= threshold ? 'bg-[#F2A33A]' : 'bg-[#C9D4DB]');

  return (
    <div className={`flex items-center gap-2.5 w-full select-none ${compact ? 'py-0.5' : 'py-1.5'}`}>
      {/* Visual Track */}
      <div className="relative flex-1 h-3.5 flex items-center">
        {/* Background Rail */}
        <div className="w-full h-[3px] bg-[#26303A] rounded-full overflow-hidden" />

        {/* Clinical Threshold Tick */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-[#66727D] z-10"
          style={{ left: `${threshPct}%` }}
          title={`Clinical Decision Threshold: ${threshold.toFixed(2)}`}
        >
          <div className="w-1 h-1 bg-[#66727D] -ml-[1px] -mt-0.5 rounded-full" />
        </div>

        {/* 95% Uncertainty Whisker Bar */}
        <div
          className="absolute h-[5px] bg-[#8E9AF0]/35 rounded-[1px] z-10 transition-all duration-200"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          title={`95% Predictive Interval: [${lower.toFixed(2)} - ${upper.toFixed(2)}]`}
        />

        {/* Calibrated Probability Indicator Dot */}
        <div
          className={`absolute w-2.5 h-2.5 rounded-full z-20 shadow-[0_0_8px_rgba(0,0,0,0.8)] border border-[#0B0E11] transition-all duration-300 ${dotColor}`}
          style={{ left: `calc(${dotPct}% - 5px)` }}
          title={`Calibrated Probability: ${p.toFixed(2)}`}
        />
      </div>

      {/* Numeric readout */}
      <div className="w-12 text-right font-mono-num text-[12px] font-medium text-[#E6EBEF]">
        {p.toFixed(2)}
      </div>
    </div>
  );
};
