"""
TraceFlow Learning Loop API Router.
Provides non-destructive endpoints for analyst feedback, incident intake,
uncertainty queues, safe model retraining, and version rollbacks.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from traceflow.config import get_config
from traceflow.learning.case_store import (
    record_analyst_feedback,
    list_cases,
    approve,
    reject,
    uncertainty_queue,
    approved_training_rows,
)
from traceflow.learning.incident import (
    IncidentModel,
    TransactionInput,
    ingest_incident,
    extract_incident,
)
from traceflow.learning.retrain import (
    retrain,
    rollback,
    list_models,
    _ensure_registry,
    REGISTRY_PATH,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["learning"])


class FeedbackRequest(BaseModel):
    cluster_id: str
    decision: str = Field(..., description="Decision: 'confirm', 'reject', or 'unsure'")
    notes: Optional[str] = None
    analyst: Optional[str] = "Analyst"


class IncidentExtractionRequest(BaseModel):
    report_text: str


class RetrainRequest(BaseModel):
    force: bool = False


class RollbackRequest(BaseModel):
    version: int


class CaseActionRequest(BaseModel):
    by: Optional[str] = "Supervising Analyst"


# ---------------- Feedback Endpoints ----------------
@router.post("/feedback")
@router.post("/api/feedback")
def submit_feedback(req: FeedbackRequest) -> Dict[str, Any]:
    """Record analyst feedback: confirm (illicit), reject (benign), or unsure."""
    try:
        res = record_analyst_feedback(
            cluster_id=req.cluster_id,
            decision=req.decision,
            notes=req.notes,
            analyst=req.analyst or "Analyst",
        )
        return res
    except Exception as e:
        logger.error(f"Error recording feedback: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


# ---------------- Learning Status & Queue ----------------
@router.get("/learning/status")
@router.get("/api/learning/status")
def get_learning_status() -> Dict[str, Any]:
    """Return learning loop status, case counts, and active model status."""
    config = get_config()
    all_cases = list_cases()
    pending = [c for c in all_cases if c.get("status") == "pending"]
    approved = [c for c in all_cases if c.get("status") == "approved"]
    rejected = [c for c in all_cases if c.get("status") == "rejected"]

    registry = _ensure_registry()
    active_version = registry.get("active_version", 1)
    history = registry.get("history", [])

    last_entry = history[-1] if history else {}
    last_retrain = last_entry.get("timestamp")
    gate_status = "passed" if last_entry.get("gate_passed", True) else "failed"

    return {
        "pending_cases": len(pending),
        "approved_cases": len(approved),
        "rejected_cases": len(rejected),
        "total_cases": len(all_cases),
        "cases_waiting_retrain": len(approved),
        "min_cases_to_retrain": config.LEARNING_MIN_NEW_CASES,
        "active_version": active_version,
        "last_retrain": last_retrain,
        "gate_status": gate_status,
    }


@router.get("/learning/queue")
@router.get("/api/learning/queue")
def get_uncertainty_queue(limit: int = Query(50, ge=1, le=200)) -> List[Dict[str, Any]]:
    """Return review queue sorted by model uncertainty (|score - 0.5| ascending) with unsure cases at front."""
    try:
        queue = uncertainty_queue()
        return queue[:limit]
    except Exception as e:
        logger.error(f"Error fetching uncertainty queue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning/cases")
@router.get("/api/learning/cases")
def get_case_store_cases(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """List cases in human-approved case store, optionally filtered by status."""
    return list_cases(status=status)


# ---------------- Incident Intake Endpoints ----------------
@router.post("/incidents")
@router.post("/api/incidents")
def create_incident(incident: IncidentModel) -> Dict[str, Any]:
    """Ingest caught real-world laundering incident into isolated edges and pending case store."""
    try:
        res = ingest_incident(incident)
        return res
    except Exception as e:
        logger.error(f"Error ingesting incident: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/incidents/extract")
@router.post("/api/incidents/extract")
def extract_incident_from_text(req: IncidentExtractionRequest) -> Dict[str, Any]:
    """Extract incident transactions from text report with strict anti-hallucination verification."""
    try:
        draft = extract_incident(req.report_text)
        return draft
    except Exception as e:
        logger.error(f"Error extracting incident: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/incidents/{case_id}/approve")
@router.post("/api/incidents/{case_id}/approve")
def approve_incident_case(case_id: str, req: Optional[CaseActionRequest] = None) -> Dict[str, Any]:
    """Promote incident case from pending to approved for training."""
    by = req.by if req and req.by else "Supervising Analyst"
    try:
        updated = approve(case_id=case_id, by=by)
        return updated
    except Exception as e:
        logger.error(f"Error approving incident case: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/incidents/{case_id}/reject")
@router.post("/api/incidents/{case_id}/reject")
def reject_incident_case(case_id: str, req: Optional[CaseActionRequest] = None) -> Dict[str, Any]:
    """Reject incident case from training pool."""
    by = req.by if req and req.by else "Supervising Analyst"
    try:
        updated = reject(case_id=case_id, by=by)
        return updated
    except Exception as e:
        logger.error(f"Error rejecting incident case: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


# ---------------- Model Retraining & Versions ----------------
@router.post("/learning/retrain")
@router.post("/api/learning/retrain")
def trigger_retrain(req: Optional[RetrainRequest] = None) -> Dict[str, Any]:
    """Trigger LightGBM retraining with human-approved cases and safety gate."""
    force = req.force if req else False
    try:
        res = retrain(force=force)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error during retraining: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
@router.get("/api/models")
def get_models() -> Dict[str, Any]:
    """List all registered models and active version."""
    return list_models()


@router.post("/models/rollback")
@router.post("/api/models/rollback")
def rollback_model(req: RollbackRequest) -> Dict[str, Any]:
    """Roll back active model to target version."""
    try:
        res = rollback(version=req.version)
        return res
    except FileNotFoundError as fe:
        raise HTTPException(status_code=404, detail=str(fe))
    except Exception as e:
        logger.error(f"Error rolling back model: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
