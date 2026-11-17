import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAuthToken } from '../services/api';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(true);

  const handleQuickLogin = async (role: UserRole) => {
    if (!consentAccepted) {
      setError('You must accept the clinical decision-support data usage notice to proceed.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const email = `${role.toLowerCase()}@hospital.org`;
      const res = await api.login(email);
      setAuthToken(res.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#E6EBEF] flex flex-col justify-between p-6">
      <div />

      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Medical Instrument Wordmark (PRD Section 12.5) */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 border border-[#26303A] bg-[#12171B] px-3 py-1 rounded-[2px] font-mono-num text-[11px] text-[#8E9AF0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8E9AF0]" />
            DECISION SUPPORT PLATFORM
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#E6EBEF] font-mono-num">
            CXR<span className="text-[#8E9AF0]">·</span>TRIAGE
          </h1>
          <p className="text-[13px] text-[#9AA7B2]">
            Calibrated Chest X-ray Prioritization & Clinical Decision-Support
          </p>
        </div>

        {/* Login & Role Selection Panel */}
        <div className="bg-[#12171B] border border-[#26303A] rounded-[4px] p-6 space-y-5 shadow-2xl">
          <div className="space-y-1">
            <h2 className="text-[14px] font-semibold tracking-wide text-[#E6EBEF]">
              Select Clinical Role
            </h2>
            <p className="text-[12px] text-[#9AA7B2]">
              Choose a simulated clinical role for authenticated reading room access.
            </p>
          </div>

          {error && (
            <div className="p-2.5 bg-[#FF4D4F]/10 border border-[#FF4D4F]/30 rounded-[2px] text-[12px] text-[#FF4D4F] font-mono-num">
              {error}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              onClick={() => handleQuickLogin('Radiologist')}
              disabled={loading}
              className="w-full text-left p-3 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] hover:border-[#8E9AF0] rounded-[2px] transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[13px] text-[#E6EBEF] group-hover:text-[#8E9AF0]">
                  Radiologist / Reading Physician
                </span>
                <span className="text-[11px] font-mono-num text-[#4FB3A5] bg-[#4FB3A5]/10 px-1.5 py-0.5 rounded-[2px]">
                  FULL REVIEW
                </span>
              </div>
              <div className="text-[11px] text-[#9AA7B2] mt-1">
                Access prioritized worklist, diagnostic heatmaps, overrides, and report sign-off.
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin('Referrer')}
              disabled={loading}
              className="w-full text-left p-3 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] hover:border-[#F2A33A] rounded-[2px] transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[13px] text-[#E6EBEF] group-hover:text-[#F2A33A]">
                  ED Physician / Attending Referrer
                </span>
                <span className="text-[11px] font-mono-num text-[#F2A33A] bg-[#F2A33A]/10 px-1.5 py-0.5 rounded-[2px]">
                  RAPID READ
                </span>
              </div>
              <div className="text-[11px] text-[#9AA7B2] mt-1">
                Instant emergency urgency flags and findings summary for your active patients.
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin('Admin')}
              disabled={loading}
              className="w-full text-left p-3 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] hover:border-[#66727D] rounded-[2px] transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[13px] text-[#E6EBEF] group-hover:text-[#film]">
                  Clinical Lead / QA Admin
                </span>
                <span className="text-[11px] font-mono-num text-[#9AA7B2] bg-[#26303A] px-1.5 py-0.5 rounded-[2px]">
                  GOVERNANCE
                </span>
              </div>
              <div className="text-[11px] text-[#9AA7B2] mt-1">
                Model performance metrics, immutable audit logs, and clinician agreement dashboard.
              </div>
            </button>
          </div>

          {/* Consent / Data Notice Banner per PRD Section 6 (F7) */}
          <div className="pt-3 border-t border-[#26303A] space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={e => setConsentAccepted(e.target.checked)}
                className="mt-0.5 rounded-[2px] bg-[#0B0E11] border-[#26303A] text-[#8E9AF0] focus:ring-0"
              />
              <span className="text-[11px] text-[#9AA7B2] leading-relaxed">
                I acknowledge that CXR Triage provides <strong>clinical decision-support</strong> only and is not a diagnostic device. All patient radiographs processed in this session are de-identified.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="text-center text-[11px] font-mono-num text-[#66727D]">
        CXR·TRIAGE v0.1.0 • APPROVED DATASETS LOCKED • IMMUTABLE AUDIT ENABLED
      </div>
    </div>
  );
};
