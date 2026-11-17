# CXR Triage — Specification

## Feature: Complete CXR Triage Decision-Support System

### User Story
As a radiologist, I need a tool that ingests chest X-rays, runs a calibrated multi-label AI model, ranks studies by clinical urgency, and lets me review/override findings — so critical cases are read first and my workflow is transparent and auditable.

### Findings Supported
Pneumothorax, Pleural effusion, Consolidation/Pneumonia, Cardiomegaly, Edema, Atelectasis, Lung opacity, No finding.

### Core Capabilities
1. **Image Ingestion**: DICOM/PNG/JPG, batch upload, folder upload, demo cohort loading, de-identification on ingest
2. **Quality Gate**: Reject/flag non-chest, lateral, rotated, low-quality images
3. **ML Inference**: Calibrated multi-label predictions with uncertainty (MC-dropout/ensemble), Grad-CAM++ heatmaps
4. **Priority Engine**: Transparent rules from `priority_rules.yaml`, 4 tiers (Critical/Urgent/Routine/Low-confidence), explanation strings
5. **Triage Worklist**: Ranked list sorted by priority score, SLA timers, filters, live re-sorting
6. **Case Viewer**: Zoom/pan/W-L/invert, heatmap overlay with opacity slider, findings panel with probability gauges
7. **Clinician Review**: Agree/Disagree/Uncertain per finding, override with reason codes, sign-off with audit
8. **Performance Dashboard**: ROC/PR curves, calibration plots, internal vs external validation, clinician agreement
9. **Triage Simulation**: FIFO vs AI-prioritized queue replay showing time-to-read improvement
10. **Audit Log**: Immutable trail of all actions, role-based access (Radiologist/Referrer/Admin)

### Accuracy Requirements
- AUROC ≥ 0.85 macro (aspirational), ≥ 0.90 for pneumothorax/effusion
- ECE < 0.05 after calibration
- ≥ 95% sensitivity for critical findings at chosen operating point
- Report whatever is true; never inflate

### Tech Stack
- Backend: FastAPI, Python 3.11, SQLAlchemy, SQLite (Postgres-ready), Alembic
- Frontend: React, TypeScript, Vite, TanStack Query, Zustand, Cornerstone.js/Canvas
- ML: PyTorch, torchxrayvision, DenseNet-121 baseline
- Infra: Docker Compose, Makefile
