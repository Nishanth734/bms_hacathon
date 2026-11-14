from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import uuid
from typing import List, Optional
import polars as pl

from api.database import get_db
from api.db_models import DatasetModel
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
        # Read preview
        df_preview = pl.read_csv(dest_path, n_rows=10)
        columns = df_preview.columns
        schema_type = detect_schema_type(columns)
        
        # Count total rows quickly
        row_count = pl.read_csv(dest_path).height

        dataset_rec = DatasetModel(
            id=ds_id,
            name=name,
            schema_type=schema_type,
            row_count=row_count,
            wallet_count=0,
            total_volume=0.0,
            currency="ETH" if schema_type == "nft" else "USD",
            file_path=str(dest_path.resolve()),
            status="processing"
        )
        db.add(dataset_rec)
        db.commit()

        # Execute full forensic pipeline immediately to populate transactions, wallets, clusters, cases, and graphs
        from traceflow.pipeline_runner import run_analysis_pipeline
        run_analysis_pipeline(
            file_path=str(dest_path.resolve()),
            dataset_name=name,
            dataset_id=ds_id
        )

        # Set as the active dataset immediately
        set_active_dataset_id(ds_id)

        # Expire local session cache to read freshly persisted stats
        db.expire_all()
        updated_ds = db.query(DatasetModel).filter(DatasetModel.id == ds_id).first()

        # Preview rows as list of dicts
        preview_rows = df_preview.to_dicts()

        return {
            "status": "uploaded",
            "dataset_id": ds_id,
            "active_dataset_id": ds_id,
            "name": name,
            "schema_type": schema_type,
            "row_count": updated_ds.row_count if updated_ds else row_count,
            "wallet_count": updated_ds.wallet_count if updated_ds else 0,
            "total_volume": updated_ds.total_volume if updated_ds else 0.0,
            "currency": updated_ds.currency if updated_ds else ("ETH" if schema_type == "nft" else "USD"),
            "columns": columns,
            "preview": preview_rows
        }

    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")

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

    db.delete(ds)
    db.commit()
    return {"status": "deleted", "dataset_id": dataset_id}
