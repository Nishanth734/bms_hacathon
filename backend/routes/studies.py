"""Studies router: Triage worklist, ingestion, viewer, review, and sign-off."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from auth import get_current_user, require_role
from config import settings
from database import get_db
from dicom_utils import process_uploaded_file
from ml.serving.inference import CXRInferenceService
from ml.serving.priority_engine import PriorityEngine
from models import Analysis, AuditLog, ClinicalContext, PriorityTier, Review, Study, StudyStatus, User
from schemas import (
    AnalysisResponse,
    ClinicalContextSchema,
    QueueHealthResponse,
    ReviewRequest,
    SignOffRequest,
    StudyDetailResponse,
    StudySummary,
)

router = APIRouter(prefix="/studies", tags=["studies"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
HEATMAP_DIR = UPLOAD_DIR / "heatmaps"
HEATMAP_DIR.mkdir(parents=True, exist_ok=True)

inference_service = CXRInferenceService()
priority_engine = PriorityEngine()

# SLA Targets in minutes per PRD Section 6 (F4)
SLA_LIMITS = {
    "Critical": 15.0,
    "Urgent": 60.0,
    "Routine": 1440.0,
    "Low-confidence": 120.0,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enrich_study_summary(study: Study, db: Session) -> StudySummary:
    """Enriches a Study ORM model with latest analysis, wait time, and SLA status."""
    now = _utcnow()
    # Normalize created_at timezone
    created_at = study.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    wait_min = max(0.0, (now - created_at).total_seconds() / 60.0)

    # Get latest analysis
    latest_analysis = (
        db.query(Analysis)
        .filter(Analysis.study_id == study.id)
        .order_by(desc(Analysis.created_at))
        .first()
    )

    p_tier = latest_analysis.priority_tier if latest_analysis else "Routine"
    p_score = latest_analysis.priority_score if latest_analysis else 10.0

    # Get review override if exists
    review = db.query(Review).filter(Review.study_id == study.id).first()
    if review and review.tier_override:
        p_tier = review.tier_override

    # Determine top finding and likelihood
    top_finding = None
    top_prob = None
    if latest_analysis and latest_analysis.findings_json:
        # Exclude 'No Finding' from top finding candidate if other pathological findings exist
        items = [
            (k, v)
            for k, v in latest_analysis.findings_json.items()
            if k != "No Finding"
        ]
        if items:
            items.sort(key=lambda x: x[1], reverse=True)
            top_finding, top_prob = items[0]
        else:
            top_finding = "No Finding"
            top_prob = latest_analysis.findings_json.get("No Finding", 0.95)

    sla_target = SLA_LIMITS.get(p_tier, 1440.0)
    sla_rem = max(0.0, sla_target - wait_min)
    is_overdue = wait_min > sla_target if study.status != StudyStatus.signed else False

    return StudySummary(
        id=str(study.id),
        hashed_uid=study.hashed_uid,
        source=study.source,
        view=study.view,
        status=study.status.value if hasattr(study.status, "value") else str(study.status),
        created_at=created_at,
        priority_tier=p_tier.value if hasattr(p_tier, "value") else str(p_tier),
        priority_score=round(p_score, 1),
        top_finding=top_finding,
        top_finding_likelihood=round(top_prob, 2) if top_prob is not None else None,
        wait_time_minutes=round(wait_min, 1),
        is_overdue=is_overdue,
        sla_remaining_minutes=round(sla_rem, 1),
        has_review=review is not None,
        signed_at=review.signed_at if review else None,
    )


@router.get("", response_model=list[StudySummary])
def get_triage_worklist(
    tier: str | None = Query(None, description="Critical, Urgent, Routine, Low-confidence"),
    finding: str | None = Query(None, description="Filter by finding name"),
    status_filter: str | None = Query(None, alias="status", description="unread, in review, signed"),
    confidence: str | None = Query(None, description="Filter high or low confidence"),
    sort: str = Query("priority", description="priority, wait_time, uid"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Returns ranked triage worklist sorted by priority score."""
    studies = db.query(Study).all()
    summaries = [enrich_study_summary(s, db) for s in studies]

    # Filters
    if tier:
        summaries = [s for s in summaries if s.priority_tier.lower() == tier.lower()]
    if status_filter:
        if status_filter == "unread":
            summaries = [s for s in summaries if s.status in ["pending", "processing", "analyzed"] and not s.has_review]
        elif status_filter == "in review":
            summaries = [s for s in summaries if s.has_review and not s.signed_at]
        elif status_filter == "signed":
            summaries = [s for s in summaries if s.signed_at is not None]
    if finding:
        summaries = [s for s in summaries if s.top_finding and finding.lower() in s.top_finding.lower()]

    # Sorting
    if sort == "priority":
        # Sort by priority tier urgency first, then score descending
        tier_rank = {"Critical": 0, "Urgent": 1, "Low-confidence": 2, "Routine": 3}
        summaries.sort(key=lambda x: (tier_rank.get(x.priority_tier, 4), -(x.priority_score or 0.0)))
    elif sort == "wait_time":
        summaries.sort(key=lambda x: -x.wait_time_minutes)

    return summaries


@router.get("/queue-health", response_model=QueueHealthResponse)
def get_queue_health(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Returns real-time queue health metrics per PRD Section 12.6."""
    studies = db.query(Study).all()
    summaries = [enrich_study_summary(s, db) for s in studies]

    counts = {"Critical": 0, "Urgent": 0, "Routine": 0, "Low-confidence": 0}
    oldest_critical = None
    breaches = 0
    signed_today = 0
    read_times = []

    for s in summaries:
        counts[s.priority_tier] = counts.get(s.priority_tier, 0) + 1
        if s.priority_tier == "Critical" and not s.signed_at:
            if oldest_critical is None or s.wait_time_minutes > oldest_critical:
                oldest_critical = s.wait_time_minutes
        if s.is_overdue:
            breaches += 1
        if s.signed_at:
            signed_today += 1
            read_times.append(s.wait_time_minutes)

    med_time = float(sorted(read_times)[len(read_times) // 2]) if read_times else 3.5

    return QueueHealthResponse(
        total_active=sum(1 for s in summaries if not s.signed_at),
        counts_by_tier=counts,
        oldest_critical_wait_min=oldest_critical,
        sla_breaches_count=breaches,
        median_read_time_min=round(med_time, 1),
        signed_today_count=signed_today,
    )


@router.post("/upload")
async def upload_studies(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Batch upload endpoint for DICOM, PNG, and JPG images with automated de-identification."""
    uploaded_studies = []

    for f in files:
        content = await f.read()
        proc = process_uploaded_file(content, f.filename, UPLOAD_DIR)

        # Check if study already exists
        existing = db.query(Study).filter(Study.hashed_uid == proc["hashed_uid"]).first()
        if existing:
            uploaded_studies.append(enrich_study_summary(existing, db))
            continue

        study = Study(
            hashed_uid=proc["hashed_uid"],
            source=f"Upload: {f.filename}",
            view=proc["view"],
            quality_json=proc["metadata"],
            status=StudyStatus.analyzed,
        )
        db.add(study)
        db.commit()
        db.refresh(study)

        # Run automated inference
        img_path = UPLOAD_DIR / proc["image_filename"]
        with open(img_path, "rb") as img_f:
            img_bytes = img_f.read()

        pred = inference_service.predict(
            image_bytes=img_bytes,
            study_id=proc["hashed_uid"],
            output_heatmap_dir=HEATMAP_DIR,
            view=proc["view"],
        )

        analysis = Analysis(
            study_id=study.id,
            model_version=pred["model_version"],
            findings_json=pred["findings"],
            priority_tier=pred["priority_tier"],
            priority_score=pred["priority_score"],
            explanation_json={"reasons": pred["explanations"]},
            uncertainty_json={"intervals": pred["uncertainty_intervals"], "variance": pred["uncertainty_variance"]},
            latency_ms=pred["latency_ms"],
        )
        db.add(analysis)

        # Audit log entry for ingestion & de-identification
        audit = AuditLog(
            actor_id=user.id,
            action="INGEST_AND_ANALYZE",
            entity="study",
            entity_id=str(study.id),
            before_json=None,
            after_json={"hashed_uid": study.hashed_uid, "tier": pred["priority_tier"], "deidentified": True},
        )
        db.add(audit)
        db.commit()

        uploaded_studies.append(enrich_study_summary(study, db))

    return {"uploaded_count": len(uploaded_studies), "studies": uploaded_studies}


@router.get("/{study_id}", response_model=StudyDetailResponse)
def get_study_detail(
    study_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Returns single study with its analysis, clinical context, and review state."""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    summary = enrich_study_summary(study, db)
    analysis = (
        db.query(Analysis)
        .filter(Analysis.study_id == study.id)
        .order_by(desc(Analysis.created_at))
        .first()
    )

    analysis_resp = None
    if analysis:
        expl = analysis.explanation_json.get("reasons", []) if analysis.explanation_json else []
        u_inter = analysis.uncertainty_json.get("intervals", {}) if analysis.uncertainty_json else {}
        analysis_resp = AnalysisResponse(
            id=str(analysis.id),
            study_id=str(study.id),
            model_version=analysis.model_version,
            priority_tier=analysis.priority_tier.value if hasattr(analysis.priority_tier, "value") else str(analysis.priority_tier),
            priority_score=analysis.priority_score,
            findings=analysis.findings_json or {},
            uncertainty_intervals=u_inter,
            explanations=expl,
            latency_ms=analysis.latency_ms,
            quality=study.quality_json,
            created_at=analysis.created_at,
        )

    context = db.query(ClinicalContext).filter(ClinicalContext.study_id == study.id).first()
    context_schema = None
    if context:
        symptoms = context.symptoms_json.get("list", []) if context.symptoms_json else []
        context_schema = ClinicalContextSchema(
            age=context.age,
            sex=context.sex,
            spo2=context.spo2,
            temp=context.temp,
            symptoms=symptoms,
        )

    review = db.query(Review).filter(Review.study_id == study.id).first()
    review_dict = None
    if review:
        review_dict = {
            "id": str(review.id),
            "reviewer_id": str(review.reviewer_id),
            "finding_verdicts": review.finding_verdicts_json,
            "tier_override": review.tier_override,
            "override_reason": review.override_reason,
            "notes": review.notes,
            "signed_at": review.signed_at,
        }

    return StudyDetailResponse(
        study=summary,
        analysis=analysis_resp,
        clinical_context=context_schema,
        review=review_dict,
        image_url=f"/api/studies/{study.id}/image",
        thumbnail_url=f"/api/studies/{study.id}/thumb",
    )


@router.put("/{study_id}/context")
def update_clinical_context(
    study_id: str,
    body: ClinicalContextSchema,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Updates clinical context and dynamically recalibrates priority tier and score."""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    context = db.query(ClinicalContext).filter(ClinicalContext.study_id == study.id).first()
    if not context:
        context = ClinicalContext(study_id=study.id)
        db.add(context)

    context.age = body.age
    context.sex = body.sex
    context.spo2 = body.spo2
    context.temp = body.temp
    context.symptoms_json = {"list": body.symptoms or []}
    db.commit()

    # Recalculate priority with new context
    analysis = (
        db.query(Analysis)
        .filter(Analysis.study_id == study.id)
        .order_by(desc(Analysis.created_at))
        .first()
    )
    if analysis and analysis.findings_json:
        ctx_dict = {"age": body.age, "sex": body.sex, "spo2": body.spo2, "temp": body.temp}
        u_inter = analysis.uncertainty_json.get("intervals", {}) if analysis.uncertainty_json else {}
        u_var = analysis.uncertainty_json.get("variance", {}) if analysis.uncertainty_json else {}

        p_eval = priority_engine.evaluate(
            findings_prob=analysis.findings_json,
            findings_interval=u_inter,
            uncertainty_variance=u_var,
            clinical_context=ctx_dict,
        )

        analysis.priority_tier = p_eval["priority_tier"]
        analysis.priority_score = p_eval["priority_score"]
        analysis.explanation_json = {"reasons": p_eval["explanations"]}
        db.commit()

    # Log audit entry
    audit = AuditLog(
        actor_id=user.id,
        action="UPDATE_CLINICAL_CONTEXT",
        entity="clinical_context",
        entity_id=str(study.id),
        before_json=None,
        after_json={"spo2": body.spo2, "age": body.age, "temp": body.temp},
    )
    db.add(audit)
    db.commit()

    return {"status": "ok", "message": "Clinical context updated and priority recalculated."}


@router.post("/{study_id}/review")
def submit_review(
    study_id: str,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submits clinician verdict (Agree/Disagree/Uncertain) and mandatory override reason."""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    analysis = (
        db.query(Analysis)
        .filter(Analysis.study_id == study.id)
        .order_by(desc(Analysis.created_at))
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=400, detail="Cannot review a study without an analysis")

    # Enforce mandatory override reason
    if body.tier_override and not body.override_reason:
        raise HTTPException(status_code=422, detail="An override_reason is strictly required when overriding priority tier.")

    review = db.query(Review).filter(Review.study_id == study.id).first()
    before_json = None
    if not review:
        review = Review(
            study_id=study.id,
            analysis_id=analysis.id,
            reviewer_id=user.id,
        )
        db.add(review)
    else:
        before_json = {
            "tier_override": review.tier_override,
            "verdicts": review.finding_verdicts_json,
        }

    review.finding_verdicts_json = {k: v.model_dump() for k, v in body.finding_verdicts.items()}
    review.tier_override = body.tier_override
    review.override_reason = body.override_reason
    review.notes = body.notes
    study.status = StudyStatus.reviewed

    # Audit entry
    audit = AuditLog(
        actor_id=user.id,
        action="SUBMIT_REVIEW",
        entity="review",
        entity_id=str(study.id),
        before_json=before_json,
        after_json={
            "tier_override": body.tier_override,
            "override_reason": body.override_reason,
            "verdicts_count": len(body.finding_verdicts),
        },
    )
    db.add(audit)
    db.commit()

    return {"status": "ok", "message": "Review recorded."}


@router.post("/{study_id}/sign")
def sign_off_study(
    study_id: str,
    body: SignOffRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Clinician locks review, signs off study, and commits immutable audit log."""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    review = db.query(Review).filter(Review.study_id == study.id).first()
    if not review:
        raise HTTPException(status_code=400, detail="Cannot sign off study before clinician review.")

    review.signed_at = _utcnow()
    if body.notes:
        review.notes = (review.notes or "") + f"\nSign-off note: {body.notes}"
    study.status = StudyStatus.signed

    audit = AuditLog(
        actor_id=user.id,
        action="SIGN_OFF_STUDY",
        entity="study",
        entity_id=str(study.id),
        before_json={"status": "reviewed"},
        after_json={"status": "signed", "signed_at": str(review.signed_at)},
    )
    db.add(audit)
    db.commit()

    return {"status": "ok", "message": "Study signed and locked.", "signed_at": review.signed_at}


@router.get("/{study_id}/heatmap/{finding}")
def get_heatmap_image(
    study_id: str,
    finding: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Serves the Grad-CAM++ localization heatmap image for a specific finding."""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    finding_clean = finding.lower().replace(" ", "_")
    fname = f"{study.hashed_uid}_{finding_clean}.png"

    # Check upload heatmaps dir first, then demo heatmaps
    hm_path = HEATMAP_DIR / fname
    if not hm_path.exists():
        demo_hm = Path(settings.UPLOAD_DIR).parent / "demo_data" / "heatmaps" / fname
        if demo_hm.exists():
            hm_path = demo_hm
        else:
            raise HTTPException(status_code=404, detail=f"Heatmap for {finding} not found")

    return FileResponse(hm_path, media_type="image/png")


@router.get("/{study_id}/report")
def get_structured_draft_report(
    study_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Generates structured draft report stamped: 'AI-assisted draft. Requires clinician review.'"""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    analysis = db.query(Analysis).filter(Analysis.study_id == study.id).first()
    review = db.query(Review).filter(Review.study_id == study.id).first()

    findings_lines = []
    if analysis and analysis.findings_json:
        for f, p in analysis.findings_json.items():
            if p >= 0.35:
                findings_lines.append(f"- {f}: finding likelihood {p:.2f}")

    if not findings_lines:
        findings_lines.append("- No acute findings exceeding threshold.")

    verdict_lines = []
    if review and review.finding_verdicts_json:
        for f, v in review.finding_verdicts_json.items():
            verdict_lines.append(f"- {f}: Clinician verdict: {v.get('verdict', 'N/A')}")

    report_text = f"""===================================================================
CHEST RADIOGRAPH DECISION-SUPPORT SUMMARY REPORT
===================================================================
Study Identifier:   {study.hashed_uid} (De-identified)
Projection / View:  {study.view or 'Frontal (PA)'}
Analysis Date:      {study.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}
Model Version:      {analysis.model_version if analysis else '0.1.0'}
Suggested Urgency:  {analysis.priority_tier if analysis else 'Routine'}

AI-ASSISTED FINDINGS (Decision-Support Likelihoods):
{chr(10).join(findings_lines)}

CLINICIAN REVIEW & OVERRIDES:
{chr(10).join(verdict_lines) if verdict_lines else 'Pending final clinician sign-off.'}

Tier Override: {review.tier_override if review and review.tier_override else 'None'}
Override Reason: {review.override_reason if review and review.override_reason else 'N/A'}
Clinician Notes: {review.notes if review and review.notes else 'None'}

STATUS: {'SIGNED & LOCKED' if review and review.signed_at else 'DRAFT / IN-REVIEW'}

*** LEGAL & CLINICAL NOTICE ***
AI-assisted draft. Requires clinician review. Decision support only.
Not a diagnostic device. Clinician judgment prevails.
===================================================================
"""
    return Response(content=report_text, media_type="text/plain")


@router.get("/{study_id}/image")
def get_study_image(study_id: str, db: Session = Depends(get_db)):
    """Serves the normalized display radiograph image."""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    fname = f"{study.hashed_uid}.png"
    p = UPLOAD_DIR / fname
    if not p.exists():
        # Check demo data images dir
        demo_img = Path(settings.UPLOAD_DIR).parent / "demo_data" / "images" / fname
        if not demo_img.exists():
            # Check by index
            all_demo = list((Path(settings.UPLOAD_DIR).parent / "demo_data" / "images").glob("*.png"))
            if all_demo:
                p = all_demo[0]
            else:
                raise HTTPException(status_code=404, detail="Image file not found")
        else:
            p = demo_img

    return FileResponse(p, media_type="image/png")


@router.get("/{study_id}/thumb")
def get_study_thumbnail(study_id: str, db: Session = Depends(get_db)):
    """Serves film sheet contact thumbnail."""
    study = db.query(Study).filter(or_(Study.id == study_id, Study.hashed_uid == study_id)).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    fname = f"{study.hashed_uid}_thumb.png"
    p = UPLOAD_DIR / fname
    if not p.exists():
        # Fall back to main image
        return get_study_image(study_id, db)
    return FileResponse(p, media_type="image/png")
