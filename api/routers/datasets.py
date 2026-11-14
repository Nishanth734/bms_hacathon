from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
from typing import List, Optional
import polars as pl

from api.database import get_db
from api.db_models import (
    DatasetModel,
    TransactionModel,
    WalletModel,
    FraudClusterModel,
    InvestigationCaseModel,
    InvestigationReportModel,
)
from traceflow.schema_parser import detect_schema_type, parse_transaction_file

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory active dataset ID tracking
_ACTIVE_DATASET_ID = "nft-sample-001"

def get_active_dataset_id() -> str:
    global _ACTIVE_DATASET_ID
    return _ACTIVE_DATASET_ID

def set_active_dataset_id(ds_id: str):
    global _ACTIVE_DATASET_ID
    _ACTIVE_DATASET_ID = ds_id

@router.get("")
def list_datasets(db: Session = Depends(get_db)):
    datasets = db.query(DatasetModel).order_by(DatasetModel.created_at.desc()).all()
    active_id = get_active_dataset_id()
    return {
        "active_dataset_id": active_id,
        "datasets": [
            {
                "id": d.id,
                "name": d.name,
                "schema_type": d.schema_type,
                "row_count": d.row_count,
                "wallet_count": d.wallet_count,
                "total_volume": d.total_volume,
                "currency": d.currency,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "is_active": d.id == active_id
            }
            for d in datasets
        ]
    }

@router.post("/select")
def select_dataset(dataset_id: str = Form(...), db: Session = Depends(get_db)):
    ds = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    set_active_dataset_id(dataset_id)
    return {"status": "ok", "active_dataset_id": dataset_id, "name": ds.name}

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    ds_id = str(uuid.uuid4())
    name = dataset_name or file.filename
    dest_path = UPLOAD_DIR / f"{ds_id}_{file.filename}"

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Step 1: Pre-validate CSV columns, rows, and datatypes with intelligent normalizer
        df_std, meta = parse_transaction_file(dest_path)
        schema_type = meta["schema_type"]
        row_count = meta["row_count"]

        # Step 2: Register dataset in database
        dataset_rec = DatasetModel(
            id=ds_id,
            name=name,
            schema_type=schema_type,
            row_count=row_count,
            wallet_count=meta["wallet_count"],
            total_volume=meta["total_volume"],
            currency=meta["currency"],
            file_path=str(dest_path.resolve()),
            status="processing"
        )
        db.add(dataset_rec)
        db.commit()

        # Step 3: Execute full forensic pipeline immediately
        from traceflow.pipeline_runner import run_analysis_pipeline
        run_analysis_pipeline(
            file_path=str(dest_path.resolve()),
            dataset_name=name,
            dataset_id=ds_id
        )

        # Step 4: Set as active dataset immediately
        set_active_dataset_id(ds_id)

        # Expire local session cache to read freshly persisted stats
        db.expire_all()
        updated_ds = db.query(DatasetModel).filter(DatasetModel.id == ds_id).first()

        preview_rows = df_std.head(10).to_dicts()

        return {
            "status": "uploaded",
            "dataset_id": ds_id,
            "active_dataset_id": ds_id,
            "name": name,
            "schema_type": schema_type,
            "row_count": updated_ds.row_count if updated_ds else row_count,
            "wallet_count": updated_ds.wallet_count if updated_ds else meta["wallet_count"],
            "total_volume": updated_ds.total_volume if updated_ds else meta["total_volume"],
            "currency": updated_ds.currency if updated_ds else meta["currency"],
            "columns": df_std.columns,
            "preview": preview_rows
        }

    except Exception as e:
        db.rollback()
        # Clean up database record if created
        try:
            db.query(DatasetModel).filter(DatasetModel.id == ds_id).delete()
            db.commit()
        except Exception:
            pass
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(status_code=400, detail=f"CSV Validation Error: {str(e)}")

@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    file_p = Path(ds.file_path)
    if file_p.exists() and "uploads" in str(file_p):
        try:
            file_p.unlink()
        except Exception:
            pass

    # Cascade delete records associated with this dataset
    db.query(TransactionModel).filter(TransactionModel.dataset_id == dataset_id).delete()
    db.query(WalletModel).filter(WalletModel.dataset_id == dataset_id).delete()
    db.query(FraudClusterModel).filter(FraudClusterModel.dataset_id == dataset_id).delete()
    db.query(InvestigationCaseModel).filter(InvestigationCaseModel.dataset_id == dataset_id).delete()
    db.delete(ds)
    db.commit()

    # If the active dataset was deleted, switch to the next available dataset
    if get_active_dataset_id() == dataset_id:
        remaining = db.query(DatasetModel).first()
        if remaining:
            set_active_dataset_id(remaining.id)

    return {"status": "deleted", "dataset_id": dataset_id, "active_dataset_id": get_active_dataset_id()}
