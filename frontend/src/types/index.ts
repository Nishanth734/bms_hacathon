export type PriorityTier = 'Critical' | 'Urgent' | 'Routine' | 'Low-confidence';
export type StudyStatus = 'pending' | 'processing' | 'analyzed' | 'reviewed' | 'signed';
export type UserRole = 'Radiologist' | 'Referrer' | 'Admin';

export interface StudySummary {
  id: string;
  hashed_uid: string;
  source: string;
  view?: string;
  status: StudyStatus;
  created_at: string;
  priority_tier: PriorityTier;
  priority_score: number;
  top_finding?: string;
  top_finding_likelihood?: number;
  wait_time_minutes: number;
  is_overdue: boolean;
  sla_remaining_minutes?: number;
  has_review: boolean;
  signed_at?: string;
}

export interface AnalysisData {
  id: string;
  study_id: string;
  model_version: string;
  priority_tier: PriorityTier;
  priority_score: number;
  findings: Record<string, number>;
  uncertainty_intervals: Record<string, [number, number]>;
  explanations: string[];
  latency_ms: number;
  quality?: Record<string, any>;
  created_at: string;
}

export interface ClinicalContextData {
  age?: number;
  sex?: string;
  spo2?: number;
  temp?: number;
  symptoms?: string[];
}

export interface FindingVerdict {
  verdict: 'Agree' | 'Disagree' | 'Uncertain';
  notes?: string;
}

export interface ReviewData {
  id: string;
  reviewer_id: string;
  finding_verdicts?: Record<string, FindingVerdict>;
  tier_override?: PriorityTier;
  override_reason?: string;
  notes?: string;
  signed_at?: string;
}

export interface StudyDetail {
  study: StudySummary;
  analysis?: AnalysisData;
  clinical_context?: ClinicalContextData;
  review?: ReviewData;
  image_url: string;
  thumbnail_url: string;
}

export interface QueueHealthData {
  total_active: number;
  counts_by_tier: Record<PriorityTier, number>;
  oldest_critical_wait_min?: number;
  sla_breaches_count: number;
  median_read_time_min: number;
  signed_today_count: number;
}
