"""FastAPI application entry-point for CXR Triage backend."""

from __future__ import annotations

import hashlib
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import logging
import structlog
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import (
    LoginRequest,
    TokenResponse,
    create_access_token,
    get_current_user,
)
from config import settings
from database import engine, get_db
from models import Base, User, UserRole
from routes.audit import router as audit_router
from routes.demo import router as demo_router
from routes.metrics import router as metrics_router
from routes.studies import router as studies_router

# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------

log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(log_level),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Seed default users
# ---------------------------------------------------------------------------

def seed_demo_users():
    with Session(engine) as db:
        demo_accounts = [
            ("radiologist@hospital.org", "Radiologist", "Dr. Alex Rivera, MD (Radiology)"),
            ("referrer@hospital.org", "Referrer", "Dr. Sarah Chen, MD (Emergency Medicine)"),
            ("admin@hospital.org", "Admin", "Admin QA Lead Davies"),
        ]
        for email, role_str, name in demo_accounts:
            e_hash = hashlib.sha256(email.lower().encode()).hexdigest()
            user = db.query(User).filter(User.email_hash == e_hash).first()
            if not user:
                user = User(
                    role=UserRole(role_str),
                    name=name,
                    email_hash=e_hash,
                )
                db.add(user)
        db.commit()


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

# Create tables on import for development and testing
Base.metadata.create_all(bind=engine)
seed_demo_users()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("startup", database_url=settings.DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    seed_demo_users()
    yield
    log.info("shutdown")


# ---------------------------------------------------------------------------
# App & middleware
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CXR Triage API",
    version=settings.MODEL_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

api_router = APIRouter(prefix="/api")


# -- Health --

class HealthResponse(BaseModel):
    status: str
    version: str


@api_router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", version=settings.MODEL_VERSION)


# -- Auth --

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Authenticate a user by email + password or role name and return a JWT."""
    email_clean = body.email.lower().strip()

    # Direct role alias support for quick role selection
    if email_clean in ["radiologist", "referrer", "admin"]:
        email_clean = f"{email_clean}@hospital.org"

    email_hash = hashlib.sha256(email_clean.encode()).hexdigest()
    user = db.query(User).filter(User.email_hash == email_hash).first()

    if user is None:
        # Create user dynamically for seamless demo experience
        role_map = {
            "radiologist": UserRole.Radiologist,
            "referrer": UserRole.Referrer,
            "admin": UserRole.Admin,
        }
        chosen_role = UserRole.Radiologist
        for r_k, r_v in role_map.items():
            if r_k in email_clean:
                chosen_role = r_v
                break

        user = User(
            role=chosen_role,
            name=f"{chosen_role.value} User",
            email_hash=email_hash,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value if hasattr(user.role, "value") else str(user.role), "name": user.name}
    )
    return TokenResponse(access_token=token)


@auth_router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "name": user.name,
    }


api_router.include_router(auth_router)
api_router.include_router(studies_router)
api_router.include_router(metrics_router)
api_router.include_router(audit_router)
api_router.include_router(demo_router)

# Mount on app
app.include_router(api_router)
