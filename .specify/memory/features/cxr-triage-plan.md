# CXR Triage — Implementation Plan

## Phase 1: Foundations
- Repo scaffold: `/frontend`, `/backend`, `/ml`, `/demo_data`, `/docs`
- Docker Compose (backend + frontend + dev DB)
- Makefile with targets: `dev`, `train`, `eval`, `demo`, `test`
- DB models with Alembic migrations (users, studies, analyses, clinical_context, reviews, audit_log)
- JWT auth with role-based guards (Radiologist, Referrer, Admin)
- Design tokens as CSS variables + Tailwind config per PRD section 12
- Component skeletons: TierBadge, ProbabilityGauge, FilmThumb, SlaRing, DicomOverlay, FindingRow

## Phase 2: ML Core
- `ml/data/datasets.lock.yaml` and `ml/data/verify.py`
- Data preparation scripts for CheXpert/NIH format
- Patient-level split generation with seeds
- Training script: DenseNet-121 with BCE/focal loss, mixed precision, early stopping
- Evaluation script: AUROC, AUPRC, sensitivity@specificity, per-finding with bootstrap CIs
- Calibration: temperature scaling + per-class Platt/isotonic comparison
- Save reports to `ml/reports/*.json`
- Wire torchxrayvision pretrained weights as functional baseline

## Phase 3: Inference Service
- Quality gate module (is_chest, is_frontal, rotation, exposure, resolution checks)
- Inference pipeline: load model, preprocess, predict, calibrate, uncertainty (MC-dropout)
- Grad-CAM++ generation per finding
- Priority engine with `priority_rules.yaml` parsing
- OOD detection (energy-based score on penultimate features)
- `POST /api/studies/{id}/analyze` endpoint
- Background processing queue with status tracking

## Phase 4: Worklist & Viewer
- Upload endpoint (multipart, batch, DICOM parsing with pydicom)
- De-identification module (strip/hash PHI tags)
- Triage worklist page: ranked table, tier rail, SLA timers, filters, live re-sort
- Case viewer: canvas-based with zoom/pan/W-L/invert, heatmap overlay, opacity slider
- Findings panel with probability gauges, uncertainty whiskers, threshold markers
- Clinical context form with live priority update
- Demo cohort loader (60 cases from NIH ChestX-ray14 test split)

## Phase 5: Review & Audit
- Per-finding verdict buttons (Agree/Disagree/Uncertain)
- Override flow with required reason codes
- Sign-off action with audit entry
- Draft report generation (template-based)
- Immutable audit log with before/after values
- Role-based route guards on all endpoints
- Disclaimer/consent banner

## Phase 6: Trust Layer
- Performance dashboard pulling from `ml/reports/*.json`
- ROC/PR curves, sensitivity tables, reliability diagrams
- Internal vs external validation comparison
- Subgroup analysis by sex and age band
- Live clinician-agreement panel
- Model card page (intended use, training data, limitations, version)
- Triage simulation: FIFO vs AI replay with time-to-read metrics

## Phase 7: Polish
- Keyboard shortcuts (J/K/Enter/H/1-7/I/A/D/U/Shift+S/?)
- Accessibility pass: WCAG AA, keyboard navigation, screen reader
- Empty states with guidance text
- Motion: 180ms worklist insertion, 150ms heatmap crossfade
- `prefers-reduced-motion` support
- Final demo cohort validation
- README with reproduction commands
- DECISIONS.md final pass
