import React from 'react';
import { PriorityTier } from '../types';

interface SlaRingProps {
  waitMinutes: number;
  tier: PriorityTier;
  isOverdue?: boolean;
}

export const SlaRing: React.FC<SlaRingProps> = ({ waitMinutes = 0, tier, isOverdue = false }) => {
  // Critical SLA target: 15 min; Urgent SLA target: 60 min; Routine: 1440 min
  const wait = Number(waitMinutes) || 0;
  const target = tier === 'Critical' ? 15 : (tier === 'Urgent' ? 60 : 1440);
  const remaining = Math.max(0, target - wait);
  const progress = Math.min(1.0, wait / target);

  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress * circumference);

  // Color transition: film-white -> amber -> red
  let strokeColor = '#C9D4DB'; // film white
  if (isOverdue || progress >= 0.85) {
    strokeColor = '#FF4D4F'; // critical red
  } else if (progress >= 0.50) {
    strokeColor = '#F2A33A'; // amber urgent
  }

  return (
    <div className="flex items-center gap-1.5 font-mono-num text-[11px]" title={`Wait: ${wait.toFixed(1)}m | Target: ${target}m`}>
      <svg className="w-5 h-5 -rotate-90 transform" viewBox="0 0 24 24">
        {/* Background Track */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          stroke="#26303A"
          strokeWidth="2"
          fill="none"
        />
        {/* Depleting Clock Arc */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-300"
        />
      </svg>
      <span className={isOverdue ? 'text-[#FF4D4F] font-semibold' : 'text-[#9AA7B2]'}>
        {isOverdue ? `+${Math.max(0, wait - target).toFixed(0)}m` : `${remaining.toFixed(0)}m`}
      </span>
    </div>
  );
};
