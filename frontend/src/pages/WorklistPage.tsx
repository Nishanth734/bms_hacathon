import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { StudySummary, QueueHealthData, PriorityTier } from '../types';
import { TierBadge } from '../components/TierBadge';
import { FilmThumb } from '../components/FilmThumb';
import { SlaRing } from '../components/SlaRing';
import { QueueHealth } from '../components/QueueHealth';

export const WorklistPage: React.FC = () => {
  const navigate = useNavigate();
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [queueHealth, setQueueHealth] = useState<QueueHealthData | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isHealthOpen, setIsHealthOpen] = useState(true);

  // Filters
  const [tierFilter, setTierFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchWorklist = async () => {
    try {
      const data = await api.getStudies({
        tier: tierFilter || undefined,
        status: statusFilter || undefined,
      });
      setStudies(data);
      const health = await api.getQueueHealth();
      setQueueHealth(health);
    } catch (err) {
      console.error('Failed to load studies', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorklist();
    const interval = setInterval(fetchWorklist, 10000);
    return () => clearInterval(interval);
  }, [tierFilter, statusFilter]);

  // Keyboard navigation: J/K to move up/down, Enter to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(studies.length - 1, prev + 1));
      } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter' && studies.length > 0) {
        e.preventDefault();
        const target = filteredStudies[selectedIndex] || filteredStudies[0];
        if (target) {
          navigate(`/study/${target.id}`);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studies, selectedIndex]);

  const handleLoadDemoCohort = async () => {
    setLoadingCohort(true);
    try {
      await api.loadDemoCohort();
      await fetchWorklist();
    } catch (err: any) {
      alert(`Error loading cohort: ${err.message}`);
    } finally {
      setLoadingCohort(false);
    }
  };

  const filteredStudies = studies.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.hashed_uid.toLowerCase().includes(q) ||
      (s.top_finding && s.top_finding.toLowerCase().includes(q)) ||
      s.priority_tier.toLowerCase().includes(q)
    );
  });

  // Triage Rail color styling
  const railColors: Record<PriorityTier, string> = {
    Critical: 'bg-[#FF4D4F]',
    Urgent: 'bg-[#F2A33A]',
    Routine: 'bg-[#4FB3A5]',
    'Low-confidence': 'bg-[#8E9AF0]',
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0B0E11] text-[#E6EBEF]">
      {/* Main Worklist Zone */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Worklist Action & Filter Bar */}
        <div className="h-12 bg-[#12171B] border-b border-[#26303A] px-4 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-[14px] font-semibold tracking-wider uppercase font-mono-num text-[#E6EBEF]">
              Triage Worklist
            </h1>
            <span className="text-[11px] font-mono-num bg-[#1A2127] border border-[#26303A] text-[#9AA7B2] px-2 py-0.5 rounded-[2px]">
              {filteredStudies.length} STUDIES
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              className="bg-[#1A2127] border border-[#26303A] text-[#E6EBEF] text-[11px] font-mono-num rounded-[2px] px-2 py-1 focus:outline-none focus:border-[#8E9AF0]"
            >
              <option value="">ALL TIERS</option>
              <option value="Critical">▲ CRITICAL ONLY</option>
              <option value="Urgent">◆ URGENT ONLY</option>
              <option value="Low-confidence">◌ NEEDS HUMAN READ</option>
              <option value="Routine">● ROUTINE</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#1A2127] border border-[#26303A] text-[#E6EBEF] text-[11px] font-mono-num rounded-[2px] px-2 py-1 focus:outline-none focus:border-[#8E9AF0]"
            >
              <option value="">ALL STATUSES</option>
              <option value="unread">UNREAD</option>
              <option value="in review">IN REVIEW</option>
              <option value="signed">SIGNED</option>
            </select>

            <input
              type="text"
              placeholder="Search UID / finding..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#1A2127] border border-[#26303A] text-[#E6EBEF] text-[11px] font-mono-num rounded-[2px] px-2 py-1 w-44 placeholder-[#66727D] focus:outline-none focus:border-[#8E9AF0]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadDemoCohort}
              disabled={loadingCohort}
              className="px-3 py-1 bg-[#1A2127] hover:bg-[#26303A] border border-[#8E9AF0]/40 text-[#8E9AF0] rounded-[2px] text-[11px] font-mono-num font-medium transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#8E9AF0]" />
              {loadingCohort ? 'LOADING 60 CASES...' : 'LOAD DEMO COHORT'}
            </button>

            <button
              onClick={() => navigate('/upload')}
              className="px-3 py-1 bg-[#4FB3A5]/15 hover:bg-[#4FB3A5]/25 border border-[#4FB3A5]/40 text-[#4FB3A5] rounded-[2px] text-[11px] font-mono-num font-medium transition-colors"
            >
              + UPLOAD DICOM / CXR
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#66727D] font-mono-num text-[12px] space-y-2">
              <div className="w-5 h-5 border-2 border-[#26303A] border-t-[#8E9AF0] rounded-full animate-spin" />
              <span>SYNCHRONIZING READING ROOM WORKLIST...</span>
            </div>
          ) : filteredStudies.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3 font-mono-num">
              <div className="text-[13px] text-[#9AA7B2]">No studies awaiting review in active filter.</div>
              <div className="text-[11px] text-[#66727D] max-w-sm">
                Load the 60-case NIH ChestX-ray14 cohort to evaluate live urgency sorting, SLA timers, and Grad-CAM++ heatmaps.
              </div>
              <button
                onClick={handleLoadDemoCohort}
                className="mt-2 px-4 py-1.5 bg-[#8E9AF0]/20 hover:bg-[#8E9AF0]/30 border border-[#8E9AF0]/40 text-[#8E9AF0] rounded-[2px] text-[12px] font-mono-num transition-colors"
              >
                LOAD 60-CASE DEMO COHORT
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed select-none">
              <thead className="bg-[#12171B] border-b border-[#26303A] text-[10px] font-mono-num uppercase tracking-wider text-[#66727D] sticky top-0 z-10">
                <tr>
                  <th className="w-12 py-2.5 px-3">Rank</th>
                  <th className="w-16 py-2.5 px-2">Film</th>
                  <th className="w-32 py-2.5 px-3">Study ID</th>
                  <th className="w-28 py-2.5 px-3">Urgency</th>
                  <th className="w-24 py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Leading Finding Likelihood</th>
                  <th className="w-28 py-2.5 px-3">SLA / Wait</th>
                  <th className="w-24 py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26303A] text-[12px]">
                {filteredStudies.map((s, idx) => {
                  const isSelected = idx === selectedIndex;
                  const isCritical = s.priority_tier === 'Critical';

                  return (
                    <tr
                      key={s.id}
                      onClick={() => {
                        setSelectedIndex(idx);
                        navigate(`/study/${s.id}`);
                      }}
                      className={`cursor-pointer transition-colors group row-insert-anim relative ${
                        isSelected
                          ? 'bg-[#1A2127]'
                          : idx % 2 === 0
                          ? 'bg-[#0B0E11] hover:bg-[#12171B]'
                          : 'bg-[#0E1216] hover:bg-[#12171B]'
                      }`}
                    >
                      {/* Triage Rail: Left edge strip (PRD Section 12.5) */}
                      <td className="py-2.5 px-3 font-mono-num relative">
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${
                            railColors[s.priority_tier] || 'bg-[#4FB3A5]'
                          } ${isCritical && !s.signed_at ? 'animate-pulse' : ''}`}
                        />
                        <span className="font-semibold text-[#9AA7B2] ml-1">
                          #{idx + 1}
                        </span>
                      </td>

                      {/* Film Sheet Contact Thumbnail */}
                      <td className="py-1.5 px-2">
                        <FilmThumb
                          src={`/api/studies/${s.id}/thumb`}
                          alt={s.hashed_uid}
                          frameNumber={idx + 1}
                        />
                      </td>

                      {/* Study UID */}
                      <td className="py-2.5 px-3 font-mono-num font-medium text-[#E6EBEF] truncate">
                        {s.hashed_uid}
                        <div className="text-[10px] text-[#66727D] font-normal">
                          {s.view || 'PA'} • {s.source.split(' ')[0]}
                        </div>
                      </td>

                      {/* Tier Badge */}
                      <td className="py-2.5 px-3">
                        <TierBadge tier={s.priority_tier} size="sm" />
                      </td>

                      {/* Priority Score (0-100) */}
                      <td className="py-2.5 px-3 font-mono-num font-semibold text-[13px]">
                        <span
                          className={
                            s.priority_score >= 80
                              ? 'text-[#FF4D4F]'
                              : s.priority_score >= 60
                              ? 'text-[#F2A33A]'
                              : 'text-[#E6EBEF]'
                          }
                        >
                          {s.priority_score != null ? Number(s.priority_score).toFixed(1) : '0.0'}
                        </span>
                        <span className="text-[10px] text-[#66727D] font-normal">/100</span>
                      </td>

                      {/* Top Finding with Likelihood */}
                      <td className="py-2.5 px-3">
                        {s.top_finding ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-[#E6EBEF] truncate">
                              {s.top_finding}
                            </span>
                            {s.top_finding_likelihood != null && (
                              <span className="text-[11px] font-mono-num text-[#9AA7B2] bg-[#12171B] border border-[#26303A] px-1.5 py-0.2 rounded-[2px]">
                                p={Number(s.top_finding_likelihood).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#66727D] text-[11px]">Pending analysis</span>
                        )}
                      </td>

                      {/* SLA Countdown Ring & Wait Time */}
                      <td className="py-2.5 px-3">
                        {s.signed_at ? (
                          <span className="text-[11px] font-mono-num text-[#4FB3A5]">
                            READ COMPLETE
                          </span>
                        ) : (
                          <SlaRing
                            waitMinutes={s.wait_time_minutes}
                            tier={s.priority_tier}
                            isOverdue={s.is_overdue}
                          />
                        )}
                      </td>

                      {/* Review / Sign Status */}
                      <td className="py-2.5 px-3 font-mono-num text-[11px]">
                        {s.signed_at ? (
                          <span className="text-[#4FB3A5] font-semibold flex items-center gap-1">
                            <span>✓</span> SIGNED
                          </span>
                        ) : s.has_review ? (
                          <span className="text-[#F2A33A] font-medium">IN REVIEW</span>
                        ) : (
                          <span className="text-[#66727D]">UNREAD</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Collapsible Right Queue Health Panel */}
      <QueueHealth
        data={queueHealth}
        isOpen={isHealthOpen}
        onToggle={() => setIsHealthOpen(!isHealthOpen)}
      />
    </div>
  );
};
