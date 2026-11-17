"""SQLAlchemy 2.0 ORM models for the CXR Triage database."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    Radiologist = "Radiologist"
    Referrer = "Referrer"
    Admin = "Admin"


class StudyStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    analyzed = "analyzed"
    reviewed = "reviewed"
    signed = "signed"


class PriorityTier(str, enum.Enum):
    Critical = "Critical"
    Urgent = "Urgent"
    Routine = "Routine"
    Low_confidence = "Low-confidence"


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    role: Mapped[str] = mapped_column(Enum(UserRole), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    reviews: Mapped[list["Review"]] = relationship(back_populates="reviewer")


class Study(Base):
    __tablename__ = "studies"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    hashed_uid: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False
    )
    source: Mapped[str] = mapped_column(String(128), nullable=False)
    view: Mapped[str | None] = mapped_column(String(32), nullable=True)
    quality_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(StudyStatus), nullable=False, default=StudyStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    analyses: Mapped[list["Analysis"]] = relationship(back_populates="study")
    clinical_context: Mapped["ClinicalContext | None"] = relationship(
        back_populates="study", uselist=False
    )
    reviews: Mapped[list["Review"]] = relationship(back_populates="study")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    study_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("studies.id"), nullable=False
    )
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    findings_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    priority_tier: Mapped[str] = mapped_column(
        Enum(PriorityTier), nullable=False
    )
    priority_score: Mapped[float] = mapped_column(Float, nullable=False)
    explanation_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    uncertainty_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    study: Mapped["Study"] = relationship(back_populates="analyses")
    reviews: Mapped[list["Review"]] = relationship(back_populates="analysis")


class ClinicalContext(Base):
    __tablename__ = "clinical_context"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    study_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("studies.id"), unique=True, nullable=False
    )
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    spo2: Mapped[float | None] = mapped_column(Float, nullable=True)
    temp: Mapped[float | None] = mapped_column(Float, nullable=True)
    symptoms_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    study: Mapped["Study"] = relationship(back_populates="clinical_context")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    study_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("studies.id"), nullable=False
    )
    analysis_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analyses.id"), nullable=False
    )
    reviewer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    finding_verdicts_json: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )
    tier_override: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )
    override_reason: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    study: Mapped["Study"] = relationship(back_populates="reviews")
    analysis: Mapped["Analysis"] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship(back_populates="reviews")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    actor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    before_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
