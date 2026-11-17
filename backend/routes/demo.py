"""Demo cohort loader router per PRD Section 6 (F1, F4)."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_user
from config import settings
from database import get_db
from models import Analysis, AuditLog, ClinicalContext, Study, StudyStatus, User

router = APIRouter(prefix="/demo", tags=["demo"])

DEMO_DIR = Path(__file__).resolve().parents[2] / "demo_data"
MANIFEST_PATH = DEMO_DIR / "manifest.json"
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
HEATMAP_DIR = UPLOAD_DIR / "heatmaps"


@router.post("/load")
def load_demo_cohort(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Loads or resets the 60-case NIH ChestX-ray14 test split demo cohort into the database."""
    if not MANIFEST_PATH.exists():
        return {"error": "Demo manifest not found"}

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        cohort = json.load(f)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    HEATMAP_DIR.mkdir(parents=True, exist_ok=True)

    loaded_count = 0
    now = datetime.now(timezone.utc)

    for item in cohort:
        study_id_str = item["study_id"].replace("STD-", "")
        # Copy image file to upload dir
        src_img = DEMO_DIR / "images" / item["filename"]
        dest_img = UPLOAD_DIR / f"{study_id_str}.png"
        dest_thumb = UPLOAD_DIR / f"{study_id_str}_thumb.png"

        if src_img.exists() and not dest_img.exists():
            shutil.copy(src_img, dest_img)
            shutil.copy(src_img, dest_thumb)

        # Check existing
        existing = db.query(Study).filter(Study.hashed_uid == study_id_str).first()
        if existing:
            continue

        # Stagger arrival timestamps so wait times reflect realistic triage queue
        stagger_minutes = (item["index"] - 1) * 4.2
        arrival_time = now - timedelta(minutes=stagger_minutes)

        study = Study(
            hashed_uid=study_id_str,
            source=f"NIH ChestX-ray14 ({item['view']})",
            view=item["view"],
            quality_json={"quality_flag": item["quality_flag"], "deidentified": True},
            status=StudyStatus.analyzed,
            created_at=arrival_time,
        )
        db.add(study)
        db.commit()
        db.refresh(study)

        # Create clinical context
        context = ClinicalContext(
            study_id=study.id,
            age=item["age"],
            sex=item["sex"],
            spo2=item["spo2"],
            temp=item["temp"],
            symptoms_json={"list": ["Cough", "Dyspnea"] if item["expected_tier"] in ["Critical", "Urgent"] else ["Routine pre-op"]},
        )
        db.add(context)

        # Attach precomputed analysis
        analysis_data = item.get("precomputed_analysis")
        if analysis_data:
            analysis = Analysis(
                study_id=study.id,
                model_version=analysis_data.get("model_version", "0.1.0-torchxrayvision-calibrated"),
                findings_json=analysis_data.get("findings", {}),
                priority_tier=analysis_data.get("priority_tier", item["expected_tier"]),
                priority_score=analysis_data.get("priority_score", 50.0),
                explanation_json={"reasons": analysis_data.get("explanations", [])},
                uncertainty_json={
                    "intervals": analysis_data.get("uncertainty_intervals", {}),
                    "variance": analysis_data.get("uncertainty_variance", {}),
                },
                latency_ms=analysis_data.get("latency_ms", 185),
                created_at=arrival_time,
            )
            db.add(analysis)

        # Copy heatmaps if available
        for hm_src in (DEMO_DIR / "heatmaps").glob(f"*{study_id_str}*"):
            shutil.copy(hm_src, HEATMAP_DIR / hm_src.name)

        loaded_count += 1

    # Record audit log
    audit = AuditLog(
        actor_id=user.id,
        action="LOAD_DEMO_COHORT",
        entity="cohort",
        entity_id="60_cases",
        before_json=None,
        after_json={"loaded_count": loaded_count, "source": "NIH ChestX-ray14"},
    )
    db.add(audit)
    db.commit()

    return {
        "status": "ok",
        "loaded_cases": loaded_count,
        "total_cohort_size": len(cohort),
        "message": f"Successfully loaded {loaded_count} cases from the NIH ChestX-ray14 test split demo cohort.",
    }
