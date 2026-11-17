import React from 'react';

interface DicomOverlayProps {
  patientHash: string;
  studyUid: string;
  viewPosition?: string;
  windowLevel: { center: number; width: number };
  zoom: number;
  modelVersion: string;
}

export const DicomOverlay: React.FC<DicomOverlayProps> = ({
  patientHash,
  studyUid,
  viewPosition = 'PA',
  windowLevel,
  zoom,
  modelVersion,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between font-mono-num text-[11px] text-[#66727D] select-none z-20">
      {/* Top Row */}
      <div className="flex justify-between items-start">
        {/* Top-Left: Patient & Privacy Hash */}
        <div className="space-y-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="text-[#9AA7B2] font-medium tracking-wider">
            ANON-{patientHash.slice(0, 10).toUpperCase()}
          </div>
          <div className="text-[10px] text-[#4FB3A5] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4FB3A5]" />
            DE-IDENTIFIED (HIPAA SAFE)
          </div>
          <div className="text-[10px]">PROJ: CHEST {viewPosition.toUpperCase()}</div>
        </div>

        {/* Top-Right: Study metadata */}
        <div className="text-right space-y-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="text-[#E6EBEF] font-mono-num">UID: {studyUid}</div>
          <div>MODALITY: DX / CR</div>
          <div>BIT DEPTH: 16-BIT GRAY</div>
        </div>
      </div>

      {/* Center Orientation Markers (R / L) */}
      <div className="flex justify-between items-center px-2 text-[#9AA7B2] font-bold text-[14px]">
        <div className="border border-[#26303A] bg-[#0B0E11]/60 px-1.5 py-0.5 rounded-[2px]">
          R
        </div>
        <div className="border border-[#26303A] bg-[#0B0E11]/60 px-1.5 py-0.5 rounded-[2px]">
          L
        </div>
      </div>

      {/* Bottom Row */}
      <div className="flex justify-between items-end">
        {/* Bottom-Left: Technical viewing parameters */}
        <div className="space-y-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          <div>
            W: {Math.round(windowLevel.width)} &nbsp; L: {Math.round(windowLevel.center)}
          </div>
          <div>ZOOM: {Math.round(zoom * 100)}%</div>
          <div className="text-[10px]">VOI LUT: LINEAR</div>
        </div>

        {/* Bottom-Right: Model Provenance & Decision Support Flag */}
        <div className="text-right space-y-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="text-[#8E9AF0] font-medium">AI-ASSISTED DECISION SUPPORT</div>
          <div>MODEL: {modelVersion}</div>
          <div className="text-[10px] text-[#66727D]">GRAD-CAM++ ACTIVE</div>
        </div>
      </div>
    </div>
  );
};
