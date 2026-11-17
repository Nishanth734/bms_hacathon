import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { StudyDetail, PriorityTier } from '../types';
import { DicomOverlay } from '../components/DicomOverlay';
import { FindingRow } from '../components/FindingRow';
import { TierBadge } from '../components/TierBadge';

export const ViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<StudyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Viewing tools
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [windowLevel, setWindowLevel] = useState({ center: 128, width: 256 });
  const [inverted, setInverted] = useState(false);
  const [activeTool, setActiveTool] = useState<'wl' | 'zoom' | 'pan'>('wl');

  // Heatmap controls
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.65);
  const [selectedFinding, setSelectedFinding] = useState<string>('Pneumothorax');

  // Blinded Read Mode (Automation bias mitigation per PRD Section 10)
  const [blindedMode, setBlindedMode] = useState(false);
  const [aiRevealed, setAiRevealed] = useState(true);

  // Clinical Context Form State
  const [spo2, setSpo2] = useState<number | ''>('');
  const [temp, setTemp] = useState<number | ''>('');
  const [age, setAge] = useState<number | ''>('');
  const [sex, setSex] = useState<string>('M');

  // Clinician Review State
  const [verdicts, setVerdicts] = useState<Record<string, 'Agree' | 'Disagree' | 'Uncertain'>>({});
  const [tierOverride, setTierOverride] = useState<PriorityTier | ''>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');

  // Mouse drag handlers for Window/Level & Pan
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const loadStudy = async () => {
    if (!id) return;
    try {
      const data = await api.getStudyDetail(id);
      setDetail(data);

      if (data.clinical_context) {
        setSpo2(data.clinical_context.spo2 ?? '');
        setTemp(data.clinical_context.temp ?? '');
        setAge(data.clinical_context.age ?? '');
        setSex(data.clinical_context.sex ?? 'M');
      }

      if (data.review?.finding_verdicts) {
        const vMap: Record<string, 'Agree' | 'Disagree' | 'Uncertain'> = {};
        for (const [k, v] of Object.entries(data.review.finding_verdicts)) {
          vMap[k] = (v as any).verdict;
        }
        setVerdicts(vMap);
      }

      if (data.review?.tier_override) {
        setTierOverride(data.review.tier_override);
        setOverrideReason(data.review.override_reason || '');
      }

      // Default selected heatmap to the top finding
      if (data.study.top_finding) {
        setSelectedFinding(data.study.top_finding);
      }
    } catch (err) {
      console.error('Failed to load study detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudy();
  }, [id]);

  // Keyboard shortcuts listener (PRD Section 12.9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowHeatmap(prev => !prev);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setInverted(prev => !prev);
      } else if (e.key >= '1' && e.key <= '7' && detail?.analysis?.findings) {
        const keys = Object.keys(detail.analysis.findings);
        const idx = parseInt(e.key) - 1;
        if (keys[idx]) {
          setSelectedFinding(keys[idx]);
          setShowHeatmap(true);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (selectedFinding) setVerdicts(prev => ({ ...prev, [selectedFinding]: 'Agree' }));
      } else if (e.key === 'd' || e.key === 'D') {
        if (selectedFinding) setVerdicts(prev => ({ ...prev, [selectedFinding]: 'Disagree' }));
      } else if (e.key === 'u' || e.key === 'U') {
        if (selectedFinding) setVerdicts(prev => ({ ...prev, [selectedFinding]: 'Uncertain' }));
      } else if (e.key === 'S' && e.shiftKey) {
        e.preventDefault();
        handleSignOff();
      } else if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detail, selectedFinding]);

  // Interactive Window / Level and Pan drag on canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    if (activeTool === 'wl') {
      // Horizontal drag: Width (contrast); Vertical drag: Center (brightness)
      setWindowLevel(prev => ({
        width: Math.max(16, prev.width + dx * 2),
        center: Math.max(0, Math.min(255, prev.center - dy)),
      }));
    } else if (activeTool === 'pan') {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else if (activeTool === 'zoom') {
      setZoom(prev => Math.max(0.5, Math.min(4.0, prev - dy * 0.01)));
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleContextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await api.updateContext(id, {
        age: age ? Number(age) : undefined,
        sex: sex || undefined,
        spo2: spo2 ? Number(spo2) : undefined,
        temp: temp ? Number(temp) : undefined,
      });
      await loadStudy();
    } catch (err: any) {
      alert(`Failed to update clinical context: ${err.message}`);
    }
  };

  const handleReviewSave = async () => {
    if (!id) return;
    if (tierOverride && !overrideReason) {
      alert('An override reason is required whenever overriding the priority tier.');
      return;
    }
    try {
      const vPayload: Record<string, { verdict: string }> = {};
      for (const [k, v] of Object.entries(verdicts)) {
        vPayload[k] = { verdict: v };
      }
      await api.submitReview(id, {
        finding_verdicts: vPayload,
        tier_override: tierOverride || undefined,
        override_reason: overrideReason || undefined,
        notes: notes || undefined,
      });
      await loadStudy();
      alert('Review verdicts saved successfully.');
    } catch (err: any) {
      alert(`Review error: ${err.message}`);
    }
  };

  const handleSignOff = async () => {
    if (!id) return;
    if (Object.keys(verdicts).length === 0) {
      alert('Please provide verdicts for findings before signing off.');
      return;
    }
    if (confirm('Are you sure you want to lock and sign off this case? This action is committed to the immutable audit log.')) {
      try {
        await handleReviewSave();
        await api.signOffStudy(id, notes);
        await loadStudy();
        alert('Case signed off and locked.');
      } catch (err: any) {
        alert(`Sign-off failed: ${err.message}`);
      }
    }
  };

  const handleOpenReport = async () => {
    if (!id) return;
    try {
      const text = await api.getDraftReport(id);
      setReportText(text);
      setShowReportModal(true);
    } catch (err: any) {
      alert('Failed to generate draft report');
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0B0E11] text-[#9AA7B2] font-mono-num text-[12px] space-y-2">
        <div className="w-5 h-5 border-2 border-[#26303A] border-t-[#8E9AF0] rounded-full animate-spin mr-3" />
        LOADING RADIOGRAPH IN READING ROOM...
      </div>
    );
  }

  const { study, analysis } = detail;
  const heatmapUrl = `/api/studies/${study.id}/heatmap/${selectedFinding.toLowerCase().replace(' ', '_')}`;

  // CSS Filter simulation of Window / Level:
  // Brightness: center mapped to offset; Contrast: width mapped to multiplier
  const brightness = (128 / Math.max(1, windowLevel.center)) * 100;
  const contrast = (256 / Math.max(1, windowLevel.width)) * 100;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0B0E11] text-[#E6EBEF] relative select-none">
      {/* Left Toolbar (PRD Section 12.6 Vertical Toolbar) */}
      <div className="w-12 bg-[#12171B] border-r border-[#26303A] flex flex-col items-center py-3 gap-2 flex-shrink-0 z-30">
        <button
          onClick={() => navigate('/')}
          className="w-8 h-8 rounded-[2px] bg-[#1A2127] border border-[#26303A] text-[#9AA7B2] hover:text-[#E6EBEF] flex items-center justify-center font-mono-num text-[12px] mb-2"
          title="Return to Worklist (Esc)"
        >
          ←
        </button>

        <div className="w-6 h-[1px] bg-[#26303A] mb-1" />

        <button
          onClick={() => setActiveTool('wl')}
          className={`w-8 h-8 rounded-[2px] border font-mono-num text-[11px] flex items-center justify-center transition-colors ${
            activeTool === 'wl'
              ? 'bg-[#8E9AF0]/20 text-[#8E9AF0] border-[#8E9AF0]'
              : 'bg-[#1A2127] text-[#9AA7B2] border-[#26303A] hover:text-[#E6EBEF]'
          }`}
          title="Window / Level (W/L Drag Interaction)"
        >
          W/L
        </button>

        <button
          onClick={() => setActiveTool('zoom')}
          className={`w-8 h-8 rounded-[2px] border font-mono-num text-[11px] flex items-center justify-center transition-colors ${
            activeTool === 'zoom'
              ? 'bg-[#8E9AF0]/20 text-[#8E9AF0] border-[#8E9AF0]'
              : 'bg-[#1A2127] text-[#9AA7B2] border-[#26303A] hover:text-[#E6EBEF]'
          }`}
          title="Zoom Tool"
        >
          MAG
        </button>

        <button
          onClick={() => setActiveTool('pan')}
          className={`w-8 h-8 rounded-[2px] border font-mono-num text-[11px] flex items-center justify-center transition-colors ${
            activeTool === 'pan'
              ? 'bg-[#8E9AF0]/20 text-[#8E9AF0] border-[#8E9AF0]'
              : 'bg-[#1A2127] text-[#9AA7B2] border-[#26303A] hover:text-[#E6EBEF]'
          }`}
          title="Pan Radiograph"
        >
          PAN
        </button>

        <button
          onClick={() => setInverted(!inverted)}
          className={`w-8 h-8 rounded-[2px] border font-mono-num text-[11px] flex items-center justify-center transition-colors ${
            inverted
              ? 'bg-[#4FB3A5]/20 text-[#4FB3A5] border-[#4FB3A5]'
              : 'bg-[#1A2127] text-[#9AA7B2] border-[#26303A] hover:text-[#E6EBEF]'
          }`}
          title="Invert Grayscale (I)"
        >
          INV
        </button>

        <div className="w-6 h-[1px] bg-[#26303A] my-1" />

        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`w-8 h-8 rounded-[2px] border font-mono-num text-[11px] flex items-center justify-center transition-colors ${
            showHeatmap
              ? 'bg-[#E04B3A]/20 text-[#E04B3A] border-[#E04B3A]'
              : 'bg-[#1A2127] text-[#66727D] border-[#26303A] hover:text-[#E6EBEF]'
          }`}
          title="Toggle Heatmap (H)"
        >
          CAM
        </button>

        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
            setWindowLevel({ center: 128, width: 256 });
          }}
          className="w-8 h-8 rounded-[2px] bg-[#1A2127] border border-[#26303A] text-[#66727D] hover:text-[#E6EBEF] font-mono-num text-[10px] mt-auto"
          title="Reset Viewport"
        >
          RST
        </button>
      </div>

      {/* Hero Image Center Zone (PRD Section 12.6 Near-black with no chrome) */}
      <div
        className="flex-1 bg-[#050709] relative overflow-hidden flex items-center justify-center cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* DICOM Corner Annotations */}
        <DicomOverlay
          patientHash={study.hashed_uid}
          studyUid={study.hashed_uid}
          viewPosition={study.view || 'PA'}
          windowLevel={windowLevel}
          zoom={zoom}
          modelVersion={analysis?.model_version || '0.1.0'}
        />

        {/* Radiograph & Heatmap Canvas Container */}
        <div
          className="relative transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Base Radiograph */}
          <img
            src={`/api/studies/${study.id}/image`}
            alt={study.hashed_uid}
            className="max-h-[82vh] max-w-[55vw] object-contain filter grayscale pointer-events-none select-none shadow-[0_0_50px_rgba(0,0,0,0.9)]"
            style={{
              filter: `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%) ${
                inverted ? 'invert(100%)' : ''
              }`,
            }}
            draggable={false}
          />

          {/* Grad-CAM++ Film Overlay (PRD Section 12.5 Signature Element 5) */}
          {showHeatmap && aiRevealed && (
            <img
              src={heatmapUrl}
              alt="Grad-CAM++ attention heatmap"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen transition-opacity duration-150"
              style={{ opacity: heatmapOpacity }}
              draggable={false}
            />
          )}

          {/* Mandatory Heatmap Caption (PRD Section 5.4 & 12.5) */}
          {showHeatmap && aiRevealed && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-[#0B0E11]/90 border border-[#26303A] text-[#9AA7B2] text-[10px] font-mono-num px-2.5 py-1 rounded-[2px] tracking-wide pointer-events-none z-30">
              Model attention for {selectedFinding}, not a lesion outline
            </div>
          )}
        </div>

        {/* Heatmap Opacity Slider floating pill */}
        {showHeatmap && aiRevealed && (
          <div className="absolute bottom-4 left-6 bg-[#12171B]/95 border border-[#26303A] px-3 py-1.5 rounded-[4px] flex items-center gap-2.5 font-mono-num text-[11px] text-[#9AA7B2] z-30 shadow-xl">
            <span className="text-[10px] text-[#E04B3A]">CAM INTENSITY:</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={heatmapOpacity}
              onChange={e => setHeatmapOpacity(parseFloat(e.target.value))}
              className="w-20 accent-[#E04B3A] cursor-pointer"
            />
            <span className="w-8 text-[#E6EBEF]">{Math.round(heatmapOpacity * 100)}%</span>
          </div>
        )}
      </div>

      {/* Right Findings & Review Panel (PRD Section 12.6) */}
      <div className="w-96 bg-[#12171B] border-l border-[#26303A] flex flex-col justify-between overflow-hidden flex-shrink-0 z-30">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Header & Urgency Banner */}
          <div className="space-y-2 border-b border-[#26303A] pb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-num text-[#9AA7B2]">
                STATUS: {study.signed_at ? 'SIGNED & LOCKED' : 'AWAITING READ'}
              </span>
              <TierBadge tier={study.priority_tier} />
            </div>

            <div className="flex items-baseline justify-between font-mono-num">
              <span className="text-[11px] text-[#66727D]">PRIORITY SCORE:</span>
              <span className="text-[18px] font-bold text-[#E6EBEF]">
                {study.priority_score?.toFixed(1) || '0.0'}
                <span className="text-[11px] text-[#66727D] font-normal"> / 100</span>
              </span>
            </div>

            {/* Blinded Read Mode Toggle (PRD Section 10 automation-bias mitigation) */}
            <div className="bg-[#1A2127] p-2 rounded-[2px] border border-[#26303A] flex items-center justify-between text-[11px] font-mono-num">
              <span className="text-[#9AA7B2]">Blinded First-Read:</span>
              <button
                onClick={() => setAiRevealed(!aiRevealed)}
                className={`px-2 py-0.5 rounded-[2px] font-medium border transition-colors ${
                  aiRevealed
                    ? 'bg-[#8E9AF0]/20 text-[#8E9AF0] border-[#8E9AF0]/40'
                    : 'bg-[#12171B] text-[#66727D] border-[#26303A]'
                }`}
              >
                {aiRevealed ? 'REVEALED' : 'HIDDEN (BLIND)'}
              </button>
            </div>
          </div>

          {/* Transparent Explanations */}
          {aiRevealed && analysis?.explanations && analysis.explanations.length > 0 && (
            <div className="bg-[#1A2127] p-2.5 rounded-[2px] border border-[#26303A] space-y-1">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#F2A33A]">
                WHY FLAGGED (PRIORITY RULES):
              </div>
              <ul className="text-[11px] text-[#E6EBEF] space-y-1 list-disc list-inside">
                {analysis.explanations.map((exp, i) => (
                  <li key={i} className="leading-snug">
                    {exp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Multi-Label Calibrated Findings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono-num uppercase tracking-wider text-[#66727D]">
              <span>FINDING LIKELIHOODS (95% CI)</span>
              <span>CUTOFF: 0.50</span>
            </div>

            {!aiRevealed ? (
              <div className="p-6 text-center text-[#66727D] font-mono-num text-[11px] bg-[#0B0E11] rounded-[2px] border border-[#26303A] space-y-2">
                <div>AI findings currently hidden for blinded read.</div>
                <button
                  onClick={() => setAiRevealed(true)}
                  className="px-3 py-1 bg-[#8E9AF0]/20 text-[#8E9AF0] rounded-[2px] border border-[#8E9AF0]/40"
                >
                  REVEAL AI FINDINGS
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {analysis?.findings &&
                  Object.entries(analysis.findings).map(([f_name, prob]) => (
                    <FindingRow
                      key={f_name}
                      finding={f_name}
                      probability={prob}
                      interval={analysis.uncertainty_intervals?.[f_name]}
                      isSelectedHeatmap={selectedFinding === f_name && showHeatmap}
                      verdict={verdicts[f_name]}
                      onSelectHeatmap={() => {
                        setSelectedFinding(f_name);
                        setShowHeatmap(true);
                      }}
                      onSetVerdict={v => setVerdicts(prev => ({ ...prev, [f_name]: v }))}
                      readOnly={Boolean(study.signed_at)}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Clinical Context Editor (Dynamic live priority shift per PRD Section 6 F5) */}
          <div className="bg-[#1A2127] p-3 rounded-[2px] border border-[#26303A] space-y-2">
            <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#9AA7B2] flex justify-between">
              <span>CLINICAL CONTEXT MODIFIERS</span>
              <span className="text-[#8E9AF0]">DYNAMIC</span>
            </div>

            <form onSubmit={handleContextSubmit} className="grid grid-cols-2 gap-2 text-[11px] font-mono-num">
              <div>
                <label className="text-[#66727D] block mb-0.5">SpO2 (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 91"
                  value={spo2}
                  onChange={e => setSpo2(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#12171B] border border-[#26303A] px-2 py-1 text-[#E6EBEF] rounded-[2px] focus:outline-none focus:border-[#8E9AF0]"
                />
              </div>

              <div>
                <label className="text-[#66727D] block mb-0.5">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 38.5"
                  value={temp}
                  onChange={e => setTemp(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#12171B] border border-[#26303A] px-2 py-1 text-[#E6EBEF] rounded-[2px] focus:outline-none focus:border-[#8E9AF0]"
                />
              </div>

              <div>
                <label className="text-[#66727D] block mb-0.5">Age</label>
                <input
                  type="number"
                  placeholder="e.g. 72"
                  value={age}
                  onChange={e => setAge(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#12171B] border border-[#26303A] px-2 py-1 text-[#E6EBEF] rounded-[2px] focus:outline-none focus:border-[#8E9AF0]"
                />
              </div>

              <div>
                <label className="text-[#66727D] block mb-0.5">Sex</label>
                <select
                  value={sex}
                  onChange={e => setSex(e.target.value)}
                  className="w-full bg-[#12171B] border border-[#26303A] px-2 py-1 text-[#E6EBEF] rounded-[2px] focus:outline-none focus:border-[#8E9AF0]"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>

              <button
                type="submit"
                className="col-span-2 mt-1 py-1 bg-[#26303A] hover:bg-[#8E9AF0]/20 text-[#8E9AF0] border border-[#26303A] hover:border-[#8E9AF0]/40 rounded-[2px] transition-colors"
              >
                UPDATE CONTEXT & RECALCULATE TIER
              </button>
            </form>
          </div>

          {/* Clinician Review & Override Controls */}
          {!study.signed_at && (
            <div className="bg-[#1A2127] p-3 rounded-[2px] border border-[#26303A] space-y-2.5">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#9AA7B2]">
                CLINICIAN TIER OVERRIDE
              </div>

              <div className="space-y-2 font-mono-num text-[11px]">
                <div>
                  <label className="text-[#66727D] block mb-0.5">Override Tier To:</label>
                  <select
                    value={tierOverride}
                    onChange={e => setTierOverride(e.target.value as PriorityTier)}
                    className="w-full bg-[#12171B] border border-[#26303A] px-2 py-1 text-[#E6EBEF] rounded-[2px]"
                  >
                    <option value="">Keep Model Tier ({study.priority_tier})</option>
                    <option value="Critical">▲ Override to Critical</option>
                    <option value="Urgent">◆ Override to Urgent</option>
                    <option value="Routine">● Override to Routine</option>
                    <option value="Low-confidence">◌ Override to Low-confidence</option>
                  </select>
                </div>

                {tierOverride && (
                  <div>
                    <label className="text-[#FF4D4F] block mb-0.5">
                      * Override Reason Code (Mandatory):
                    </label>
                    <select
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      className="w-full bg-[#12171B] border border-[#FF4D4F]/50 px-2 py-1 text-[#E6EBEF] rounded-[2px]"
                    >
                      <option value="">Select Reason Code...</option>
                      <option value="false_positive">False Positive AI Finding</option>
                      <option value="missed_finding">Missed Clinical Finding</option>
                      <option value="clinical_context">Clinical Context Overrides Image</option>
                      <option value="image_quality">Poor Radiographic Quality / Motion</option>
                      <option value="other">Other Clinical Justification</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[#66727D] block mb-0.5">Reading Physician Notes:</label>
                  <textarea
                    rows={2}
                    placeholder="Enter impressions or justification..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-[#12171B] border border-[#26303A] p-2 text-[#E6EBEF] rounded-[2px] text-[11px] focus:outline-none focus:border-[#8E9AF0]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Sign-Off Footer */}
        <div className="p-3 bg-[#12171B] border-t border-[#26303A] space-y-2 flex-shrink-0 font-mono-num">
          <div className="flex gap-2">
            <button
              onClick={handleOpenReport}
              className="flex-1 py-1.5 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] rounded-[2px] text-[11px] text-[#9AA7B2] hover:text-[#E6EBEF] transition-colors"
            >
              VIEW DRAFT REPORT
            </button>

            {!study.signed_at && (
              <button
                onClick={handleReviewSave}
                className="py-1.5 px-3 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] rounded-[2px] text-[11px] text-[#8E9AF0]"
                title="Save Draft Verdicts"
              >
                SAVE
              </button>
            )}
          </div>

          {!study.signed_at ? (
            <button
              onClick={handleSignOff}
              className="w-full py-2 bg-[#4FB3A5] hover:bg-[#4FB3A5]/90 text-[#0B0E11] font-semibold rounded-[2px] text-[12px] tracking-wide transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>✓</span> SIGN OFF & LOCK AUDIT (SHIFT + S)
            </button>
          ) : (
            <div className="w-full py-2 bg-[#4FB3A5]/20 border border-[#4FB3A5]/40 text-[#4FB3A5] text-[12px] font-semibold text-center rounded-[2px]">
              SIGNED OFF • AUDIT LOCKED
            </div>
          )}
        </div>
      </div>

      {/* Structured Draft Report Modal (PRD Section 6 F6) */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-[#12171B] border border-[#26303A] rounded-[4px] p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#26303A] pb-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#E6EBEF] font-mono-num">
                Structured Draft Report
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-[#66727D] hover:text-[#E6EBEF] font-mono-num text-[14px]"
              >
                ✕
              </button>
            </div>

            <pre className="bg-[#0B0E11] p-4 rounded-[2px] border border-[#26303A] text-[11px] font-mono-num text-[#E6EBEF] whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed">
              {reportText}
            </pre>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] font-mono-num text-[#F2A33A]">
                AI-assisted draft. Requires clinician review.
              </span>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-1.5 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] rounded-[2px] text-[12px] font-mono-num text-[#E6EBEF]"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
