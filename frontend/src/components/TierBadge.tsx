import React from 'react';
import { PriorityTier } from '../types';

interface TierBadgeProps {
  tier: PriorityTier;
  size?: 'sm' | 'md';
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = 'md' }) => {
  // PRD 12.3 & 12.5: Never encode tier by color alone. Use unique icon glyph + label.
  // Critical: ▲ (Filled triangle)
  // Urgent: ◆ (Filled diamond)
  // Routine: ● (Filled circle)
  // Low-confidence / Review: ◌ (Dashed/hollow ring)
  const configs: Record<PriorityTier, { bg: string; text: string; border: string; glyph: string }> = {
    Critical: {
      bg: 'bg-[#FF4D4F]/15',
      text: 'text-[#FF4D4F]',
      border: 'border-[#FF4D4F]/30',
      glyph: '▲',
    },
    Urgent: {
      bg: 'bg-[#F2A33A]/15',
      text: 'text-[#F2A33A]',
      border: 'border-[#F2A33A]/30',
      glyph: '◆',
    },
    Routine: {
      bg: 'bg-[#4FB3A5]/15',
      text: 'text-[#4FB3A5]',
      border: 'border-[#4FB3A5]/30',
      glyph: '●',
    },
    'Low-confidence': {
      bg: 'bg-[#8E9AF0]/15',
      text: 'text-[#8E9AF0]',
      border: 'border-[#8E9AF0]/30',
      glyph: '◌',
    },
  };

  const cfg = configs[tier] || configs.Routine;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono-num font-medium border ${cfg.bg} ${cfg.text} ${cfg.border} ${
        isSm ? 'text-[11px]' : 'text-[12px]'
      }`}
    >
      <span className="text-[10px] leading-none select-none">{cfg.glyph}</span>
      <span className="tracking-wide uppercase text-[11px]">{tier}</span>
    </span>
  );
};
