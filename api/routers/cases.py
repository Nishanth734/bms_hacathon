from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from api.database import get_db
from api.db_models import InvestigationCaseModel, FraudClusterModel, InvestigationReportModel
from api.routers.datasets import get_active_dataset_id
from ..data_store import DataStore

router = APIRouter(prefix="/api/cases", tags=["cases"])
_store: Optional[DataStore] = None

def set_store(store: DataStore):
    global _store
    _store = store

class UpdateCaseRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    assigned_analyst: Optional[str] = None

@router.get("")
def list_cases(
    dataset_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    typology: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db)
):
    target_id = dataset_id or get_active_dataset_id()
    
    # Query database
    q = db.query(InvestigationCaseModel).join(
        FraudClusterModel, InvestigationCaseModel.case_id == FraudClusterModel.cluster_id
    ).filter(
        InvestigationCaseModel.dataset_id == target_id,
        FraudClusterModel.risk_score >= min_score
    )

    if typology:
        q = q.filter(FraudClusterModel.primary_typology == typology)
    if priority:
        q = q.filter(InvestigationCaseModel.priority == priority)
    if status:
        q = q.filter(InvestigationCaseModel.status == status)

    total = q.count()
    cases = q.order_by(FraudClusterModel.risk_score.desc()).offset(offset).limit(limit).all()

    if total == 0 and _store:
        # Fallback to legacy store with normalized case_id
        store_res = _store.get_cases(
            limit=limit,
            offset=offset,
            typology_filter=typology,
            min_score=min_score,
        )
        for c in store_res.get("cases", []):
            if "case_id" not in c:
                c["case_id"] = c.get("cluster_id")
        return store_res

    res_cases = []
    for c in cases:
        cluster = c.cluster
        res_cases.append({
            "case_id": c.case_id,
            "cluster_id": c.cluster_id,
            "title": c.title,
            "status": c.status,
            "priority": c.priority,
            "assigned_analyst": c.assigned_analyst,
            "notes": c.notes,
            "tags": c.tags or [],
            "typology": cluster.typology if cluster else [],
            "primary_typology": cluster.primary_typology if cluster else "unknown",
            "risk_score": cluster.risk_score if cluster else 0.0,
            "size": cluster.size if cluster else 0,
            "duration_hours": cluster.duration_hours if cluster else 0.0,
            "start_time": str(cluster.start_time) if cluster else "",
            "end_time": str(cluster.end_time) if cluster else "",
            "account_count": cluster.size if cluster else 0,
            "edge_count": cluster.edge_count if cluster else 0,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })

    return {"total": total, "cases": res_cases}

@router.get("/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)):
    c = db.query(InvestigationCaseModel).filter(
        (InvestigationCaseModel.case_id == case_id) | (InvestigationCaseModel.cluster_id == case_id)
    ).first()
    if not c:
        if _store:
            detail = _store.get_case_detail(case_id)
            if detail:
                if "case_id" not in detail:
                    detail["case_id"] = detail.get("cluster_id") or case_id
                if "title" not in detail:
                    detail["title"] = f"Case #{detail['case_id'][:8]}"
                if "status" not in detail:
                    detail["status"] = "UNDER_INVESTIGATION"
                if "priority" not in detail:
                    detail["priority"] = "HIGH"
                if "notes" not in detail:
                    detail["notes"] = ""
                if "evidence" not in detail:
                    detail["evidence"] = {
                        "cluster_id": detail.get("cluster_id"),
                        "primary_typology": detail.get("primary_typology", "suspicious"),
                        "typology": detail.get("typology", []),
                        "risk_score": detail.get("risk_score", 0.8),
                        "duration_hours": detail.get("duration_hours", 2.0),
                        "size": detail.get("size", len(detail.get("accounts", []))),
                        "accounts": detail.get("accounts", []),
                        "edge_ids": detail.get("edge_ids", []),
                        "token_ids": []
                    }
                return detail
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    cluster = c.cluster
    report = db.query(InvestigationReportModel).filter(InvestigationReportModel.case_id == case_id).first()

    ev = cluster.evidence_json if cluster else {}
    accounts_list = ev.get("accounts", [])

    raw_graph = cluster.graph_json if cluster else {"nodes": [], "edges": []}
    nodes_formatted = []
    for n in raw_graph.get("nodes", []):
        nodes_formatted.append({
            "id": n.get("id"),
            "label": n.get("label") or n.get("id"),
            "role": n.get("role", "member"),
            "risk_score": n.get("risk_score", 0.5),
            "in_degree": n.get("in_degree", 0),
            "out_degree": n.get("out_degree", 0),
            "is_suspicious": n.get("is_suspicious", True)
        })

    edges_formatted = []
    for e in raw_graph.get("edges", []):
        edges_formatted.append({
            "id": e.get("id") or e.get("edge_id") or f"{e.get('source')}->{e.get('target')}",
            "edge_id": e.get("edge_id") or e.get("id"),
            "source": e.get("source"),
            "target": e.get("target"),
            "amount": e.get("amount", 0.0),
            "currency": e.get("currency", "ETH"),
            "ts": str(e.get("ts") or e.get("timestamp") or ""),
            "timestamp": e.get("timestamp"),
            "token_id": e.get("token_id"),
            "is_cluster_edge": e.get("is_cluster_edge", True)
        })

    return {
        "case_id": c.case_id,
        "cluster_id": c.cluster_id,
        "title": c.title,
        "status": c.status,
        "priority": c.priority,
        "assigned_analyst": c.assigned_analyst,
        "notes": c.notes,
        "tags": c.tags or [],
        "typology": cluster.typology if cluster else [],
        "primary_typology": cluster.primary_typology if cluster else "unknown",
        "risk_score": cluster.risk_score if cluster else 0.0,
        "size": cluster.size if cluster else 0,
        "duration_hours": cluster.duration_hours if cluster else 0.0,
        "window_start": str(cluster.start_time) if cluster else "",
        "window_end": str(cluster.end_time) if cluster else "",
        "accounts": accounts_list if accounts_list else [n["id"] for n in nodes_formatted],
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "graph": {"nodes": nodes_formatted, "edges": edges_formatted},
        "evidence": ev,
        "report": {
            "case_id": c.case_id,
            "title": report.title if report else c.title,
            "template_used": True,
            "narrative_markdown": report.narrative_markdown if report else "",
            "sentences": report.sentences if report else [],
            "verification_status": report.verification_status if report else "VERIFIED",
            "unverified_claims": report.unverified_claims if report else [],
            "verifier_pass": (report.verification_status == "VERIFIED") if report else True
        }
    }

@router.patch("/{case_id}")
def update_case(case_id: str, req: UpdateCaseRequest, db: Session = Depends(get_db)):
    c = db.query(InvestigationCaseModel).filter(InvestigationCaseModel.case_id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    if req.status is not None:
        c.status = req.status
    if req.priority is not None:
        c.priority = req.priority
    if req.notes is not None:
        c.notes = req.notes
    if req.tags is not None:
        c.tags = req.tags
    if req.assigned_analyst is not None:
        c.assigned_analyst = req.assigned_analyst

    db.commit()
    db.refresh(c)
    return {"status": "updated", "case_id": c.case_id, "case_status": c.status, "notes": c.notes}
