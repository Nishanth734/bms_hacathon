import React from 'react';

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'J / K', desc: 'Navigate to Next / Previous case in worklist' },
    { key: 'Enter', desc: 'Open selected case in reading room viewer' },
    { key: 'H', desc: 'Toggle Grad-CAM++ localization heatmap overlay' },
    { key: '1 .. 7', desc: 'Directly select finding to display its attention CAM' },
    { key: 'I', desc: 'Invert radiographic grayscale (MONOCHROME1 / 2 toggle)' },
    { key: 'A', desc: 'Mark finding verdict: Agree' },
    { key: 'D', desc: 'Mark finding verdict: Disagree' },
    { key: 'U', desc: 'Mark finding verdict: Uncertain' },
    { key: 'Shift + S', desc: 'Sign off study and lock audit record' },
    { key: 'Esc', desc: 'Close dialog or return to worklist' },
    { key: '?', desc: 'Show / hide this power-user keyboard shortcut sheet' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-[#12171B] border border-[#26303A] rounded-[4px] shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#26303A] pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono-num text-[12px] bg-[#1A2127] border border-[#26303A] px-1.5 py-0.5 rounded-[2px] text-[#8E9AF0]">
              POWER USER
            </span>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#E6EBEF]">
              Reading Room Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#66727D] hover:text-[#E6EBEF] font-mono-num text-[14px]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map(s => (
            <div
              key={s.key}
              className="flex items-center justify-between py-1 px-2 rounded-[2px] hover:bg-[#1A2127] text-[12px]"
            >
              <kbd className="px-2 py-0.5 bg-[#0B0E11] border border-[#26303A] rounded-[2px] font-mono-num text-[11px] text-[#E6EBEF] font-semibold">
                {s.key}
              </kbd>
              <span className="text-[#9AA7B2] text-right">{s.desc}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[#26303A] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] rounded-[2px] text-[12px] font-mono-num text-[#E6EBEF]"
          >
            CLOSE (ESC)
          </button>
        </div>
      </div>
    </div>
  );
};
