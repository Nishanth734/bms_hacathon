import React from 'react';

export const PersistentFooter: React.FC = () => {
  return (
    <footer className="h-7 bg-[#0B0E11] border-t border-[#26303A] px-4 flex items-center justify-between text-[11px] font-mono-num text-[#66727D] select-none z-40 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F2A33A]" />
        <span>
          Decision support only. Not a diagnostic device. Clinician judgment prevails.
        </span>
      </div>

      <div className="flex items-center gap-4 text-[10px]">
        <span>CALIBRATED INFERENCE ACTIVE</span>
        <span>AUDIT: IMMUTABLE</span>
        <span>PRESS <kbd className="px-1 py-0.5 bg-[#1A2127] border border-[#26303A] text-[#9AA7B2] rounded-[2px]">?</kbd> FOR SHORTCUTS</span>
      </div>
    </footer>
  );
};
