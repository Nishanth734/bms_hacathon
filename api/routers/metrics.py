from fastapi import APIRouter
from ..data_store import DataStore
from ..schemas import MetricsResponse

router = APIRouter()
_store: DataStore = None


def set_store(store: DataStore):
    global _store
    _store = store


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    return _store.get_metrics()
