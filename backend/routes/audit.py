"""Audit log router per PRD Section 6 (F7).
Provides immutable access to system actions, role access, and model overrides.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from auth import get_current_user, require_role
from database import get_db
from models import AuditLog, User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def get_audit_trail(
    entity: str | None = Query(None, description="Filter by entity type (study, review, user)"),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("Admin", "Radiologist")),
):
    """Retrieves immutable audit trail entries."""
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)

    logs = query.order_by(desc(AuditLog.ts)).limit(limit).all()

    return [
        {
            "id": str(log.id),
            "actor_id": str(log.actor_id) if log.actor_id else "SYSTEM",
            "action": log.action,
            "entity": log.entity,
            "entity_id": log.entity_id,
            "before": log.before_json,
            "after": log.after_json,
            "timestamp": log.ts.isoformat() if log.ts else None,
        }
        for log in logs
    ]
