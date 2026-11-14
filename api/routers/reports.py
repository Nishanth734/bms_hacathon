from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import Optional

from api.database import get_db
from api.db_models import InvestigationReportModel, InvestigationCaseModel, FraudClusterModel
from api.routers.cases import _store

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/{case_id}")
def get_report(case_id: str, db: Session = Depends(get_db)):
    report = db.query(InvestigationReportModel).filter(
        (InvestigationReportModel.case_id == case_id) | (InvestigationReportModel.report_id == case_id)
    ).first()
    if not report:
        if _store:
            detail = _store.get_case_detail(case_id)
            if detail and "report" in detail:
                r = detail["report"]
                return {
                    "report_id": f"rep-{case_id}",
                    "case_id": case_id,
                    "title": f"Suspicious Activity Report - Case {case_id[:8]}",
                    "narrative_markdown": " ".join(s["text"] for s in r.get("sentences", [])),
                    "sentences": r.get("sentences", []),
                    "verification_status": "VERIFIED" if r.get("verifier_pass") else "FAILED",
                    "unverified_claims": r.get("verifier_details", []),
                    "case_metadata": {
                        "title": f"Case #{case_id[:8]}",
                        "priority": "HIGH",
                        "status": "UNDER_INVESTIGATION",
                        "risk_score": detail.get("risk_score", 0.8),
                        "primary_typology": detail.get("primary_typology", "suspicious"),
                        "accounts_count": len(detail.get("accounts", [])),
                        "edges_count": len(detail.get("edge_ids", [])),
                        "created_at": None
                    }
                }
        raise HTTPException(status_code=404, detail="Report not found for this case")

    case = db.query(InvestigationCaseModel).filter(
        (InvestigationCaseModel.case_id == case_id) | (InvestigationCaseModel.cluster_id == case_id)
    ).first()
    cluster = db.query(FraudClusterModel).filter(FraudClusterModel.cluster_id == case_id).first()

    return {
        "report_id": report.report_id,
        "case_id": report.case_id,
        "title": report.title,
        "narrative_markdown": report.narrative_markdown,
        "sentences": report.sentences,
        "verification_status": report.verification_status,
        "unverified_claims": report.unverified_claims,
        "case_metadata": {
            "title": case.title if case else "",
            "priority": case.priority if case else "",
            "status": case.status if case else "",
            "risk_score": cluster.risk_score if cluster else 0.0,
            "primary_typology": cluster.primary_typology if cluster else "",
            "accounts_count": cluster.size if cluster else 0,
            "edges_count": cluster.edge_count if cluster else 0,
            "created_at": report.created_at.isoformat() if report.created_at else None
        }
    }

@router.get("/{case_id}/export/markdown", response_class=PlainTextResponse)
def export_report_markdown(case_id: str, db: Session = Depends(get_db)):
    report = db.query(InvestigationReportModel).filter(
        (InvestigationReportModel.case_id == case_id) | (InvestigationReportModel.report_id == case_id)
    ).first()
    
    case = db.query(InvestigationCaseModel).filter(
        (InvestigationCaseModel.case_id == case_id) | (InvestigationCaseModel.cluster_id == case_id)
    ).first()
    cluster = db.query(FraudClusterModel).filter(FraudClusterModel.cluster_id == case_id).first()

    narrative_md = ""
    ver_status = "VERIFIED"
    title_str = f"Case #{case_id[:8]}"
    typ_str = "SUSPICIOUS"
    risk_val = 0.85
    edges_list = []
    accounts = []

    if report:
        narrative_md = report.narrative_markdown
        ver_status = report.verification_status
        title_str = case.title if case else report.title
        typ_str = cluster.primary_typology if cluster else "SUSPICIOUS"
        risk_val = cluster.risk_score if cluster else 0.85
        ev = cluster.evidence_json if cluster else {}
        edges_list = ev.get("edges", [])
        accounts = ev.get("accounts", [])
    elif _store:
        detail = _store.get_case_detail(case_id)
        if detail:
            r = detail.get("report", {})
            narrative_md = " ".join(s["text"] for s in r.get("sentences", []))
            ver_status = "VERIFIED" if r.get("verifier_pass") else "FAILED"
            typ_str = detail.get("primary_typology", "SUSPICIOUS")
            risk_val = detail.get("risk_score", 0.85)
            edges_list = detail.get("graph", {}).get("edges", [])
            accounts = detail.get("accounts", [])
        else:
            raise HTTPException(status_code=404, detail="Report not found")
    else:
        raise HTTPException(status_code=404, detail="Report not found")

    md_content = f"""# Suspicious Activity Report (SAR / STR)
**Document Reference**: TraceFlow-STR-{case_id[:8].upper()}
**Classification**: CONFIDENTIAL / SUSPICIOUS ACTIVITY
**Anti-Hallucination Audit**: {ver_status}

---

## 1. Case Summary
- **Case Title**: {title_str}
- **Primary Typology**: {typ_str.upper()}
- **Composite Risk Score**: {risk_val}
- **Investigated Accounts**: {len(accounts)}
- **Flagged Transactions**: {len(edges_list)}

---

## 2. Narrative Report
{narrative_md}

---

## 3. Transaction Evidence
| Index | Transaction ID | Source | Target | Amount |
| :---: | :--- | :--- | :--- | :--- |
"""
    for idx, e in enumerate(edges_list[:25]):
        md_content += f"| {idx+1} | `{e.get('id') or e.get('edge_id')}` | `{e.get('source') or e.get('src')}` | `{e.get('target') or e.get('dst')}` | {e.get('amount')} {e.get('currency', 'ETH')} |\n"

    md_content += f"""
---
*Automated Verification Verdict: {ver_status}*
"""
    return md_content
    edge_ids = ev.get("edge_ids", [])

    md_content = f"""# Suspicious Activity Report (SAR / STR)
**Document Reference**: TraceFlow-STR-{case_id[:8].upper()}  
**Generated At**: {report.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if report.created_at else 'N/A'}  
**Classification**: CONFIDENTIAL / SUSPICIOUS ACTIVITY  
**Anti-Hallucination Audit**: {report.verification_status}  

---

## 1. Case Header & Summary
- **Case Title**: {case.title if case else 'N/A'}
- **Primary Typology**: {cluster.primary_typology.upper() if cluster else 'UNKNOWN'}
- **Composite Risk Score**: {cluster.risk_score if cluster else 0.0}
- **Case Priority**: {case.priority if case else 'HIGH'}
- **Status**: {case.status if case else 'UNDER_INVESTIGATION'}
- **Assigned Analyst**: {case.assigned_analyst if case else 'Lead Forensic Investigator'}
- **Investigated Accounts**: {len(accounts)}
- **Flagged Transactions**: {len(edge_ids)}

---

## 2. Executive Narrative
{report.narrative_markdown}

---

## 3. Grounded Transaction Evidence
The following transactions constitute the temporal subgraph evidence:

| Index | Transaction ID / Hash | Source Address | Destination Address | Amount |
| :---: | :--- | :--- | :--- | :--- |
"""
    edges_list = ev.get("edges", [])
    for idx, e in enumerate(edges_list[:25]):
        md_content += f"| {idx+1} | `{e.get('edge_id')}` | `{e.get('src')}` | `{e.get('dst')}` | {e.get('amount')} {e.get('currency', 'ETH')} |\n"

    md_content += f"""
---

## 4. Verification & Audit Trail
- **Fact Verifier Verdict**: {report.verification_status}
- **Unverified Claims Detected**: {len(report.unverified_claims or [])}
- **Analyst Assessment**: {case.notes if case else 'No additional notes.'}
"""

    return md_content
