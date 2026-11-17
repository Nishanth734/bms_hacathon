"""Pydantic schemas for CXR Triage API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class StudySummary(BaseModel):
    id: str
    hashed_uid: str
    source: str
    view: str | None = None
    status: str
    created_at: datetime
    # Enriched analysis fields for the triage worklist
    priority_tier: str | None = None
    priority_score: float | None = None
    top_finding: str | None = None
    top_finding_likelihood: float | None = None
    wait_time_minutes: float = 0.0
    is_overdue: bool = False
    sla_remaining_minutes: float | None = None
    has_review: bool = False
    signed_at: datetime | None = None


class ClinicalContextSchema(BaseModel):
    age: int | None = None
    sex: str | None = None
    spo2: float | None = None
    temp: float | None = None
    symptoms: list[str] | None = None


class FindingVerdict(BaseModel):
    verdict: str = Field(..., description="Agree, Disagree, or Uncertain")
    notes: str | None = None


class ReviewRequest(BaseModel):
    finding_verdicts: dict[str, FindingVerdict] = Field(
        ..., description="Verdict per finding: Agree, Disagree, Uncertain"
    )
    tier_override: str | None = Field(
        None, description="Critical, Urgent, Routine, Low-confidence"
    )
    override_reason: str | None = Field(
        None, description="Required if tier_override is provided"
    )
    notes: str | None = None


class SignOffRequest(BaseModel):
    notes: str | None = None
    draft_report_approved: bool = True


class AnalysisResponse(BaseModel):
    id: str
    study_id: str
    model_version: str
    priority_tier: str
    priority_score: float
    findings: dict[str, float]
    uncertainty_intervals: dict[str, list[float]]
    explanations: list[str]
    latency_ms: int
    quality: dict[str, Any] | None = None
    created_at: datetime


class StudyDetailResponse(BaseModel):
    study: StudySummary
    analysis: AnalysisResponse | None = None
    clinical_context: ClinicalContextSchema | None = None
    review: dict[str, Any] | None = None
    image_url: str
    thumbnail_url: str


class QueueHealthResponse(BaseModel):
    total_active: int
    counts_by_tier: dict[str, int]
    oldest_critical_wait_min: float | None = None
    sla_breaches_count: int
    median_read_time_min: float
    signed_today_count: int
