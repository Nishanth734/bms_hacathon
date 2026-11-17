import { StudySummary, StudyDetail, QueueHealthData } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('cxr_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('cxr_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('cxr_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail || errorText;
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string) => 
    request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'demo-password' }),
    }),

  getCurrentUser: () =>
    request<{ id: string; role: string; name: string }>('/auth/me'),

  // Studies
  getStudies: (params: { tier?: string; finding?: string; status?: string; sort?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.tier) query.set('tier', params.tier);
    if (params.finding) query.set('finding', params.finding);
    if (params.status) query.set('status', params.status);
    if (params.sort) query.set('sort', params.sort);
    return request<StudySummary[]>(`/studies?${query.toString()}`);
  },

  getStudyDetail: (id: string) =>
    request<StudyDetail>(`/studies/${id}`),

  getQueueHealth: () =>
    request<QueueHealthData>('/studies/queue-health'),

  uploadStudies: (files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return request<{ uploaded_count: number; studies: StudySummary[] }>('/studies/upload', {
      method: 'POST',
      body: formData,
    });
  },

  updateContext: (id: string, context: { age?: number; sex?: string; spo2?: number; temp?: number; symptoms?: string[] }) =>
    request<{ status: string; message: string }>(`/studies/${id}/context`, {
      method: 'PUT',
      body: JSON.stringify(context),
    }),

  submitReview: (id: string, review: {
    finding_verdicts: Record<string, { verdict: string; notes?: string }>;
    tier_override?: string;
    override_reason?: string;
    notes?: string;
  }) =>
    request<{ status: string; message: string }>(`/studies/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(review),
    }),

  signOffStudy: (id: string, notes?: string) =>
    request<{ status: string; message: string; signed_at: string }>(`/studies/${id}/sign`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  getDraftReport: async (id: string) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/studies/${id}/report`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.text();
  },

  // Demo
  loadDemoCohort: () =>
    request<{ status: string; loaded_cases: number; total_cohort_size: number; message: string }>('/demo/load', {
      method: 'POST',
    }),

  // Metrics & Trust
  getModelMetrics: () =>
    request<{ evaluation: any; calibration: any; explainability: any }>('/metrics/model'),

  getClinicianAgreement: () =>
    request<any>('/metrics/agreement'),

  getTriageSimulation: () =>
    request<any>('/metrics/simulation/triage'),

  // Audit
  getAuditLog: (entity?: string) => {
    const query = entity ? `?entity=${entity}` : '';
    return request<any[]>(`/audit${query}`);
  },
};
