# CXR Triage Constitution

## Core Principles

### I. Decision Support Only
Every AI output is advisory. No screen, string, API field, or log may use the word "diagnosis" for a model output. Use "finding likelihood", "suggested priority", "flagged for review". Clinician judgment always prevails.

### II. Data Integrity — Closed List, Fail Closed
Only the eight datasets listed in the PRD (CheXpert, NIH ChestX-ray14, MIMIC-CXR-JPG, PadChest, VinDr-CXR, SIIM-ACR Pneumothorax, RSNA Pneumonia Detection, NLM Montgomery/Shenzhen) may be used. If a dataset is unavailable, the pipeline stops and the UI says so. Never substitute synthetic, scraped, or unlisted data. Every dataset is recorded in `datasets.lock.yaml` with provenance.

### III. Metric Honesty — No Invented Numbers
Every number shown in the UI or README must come from a script in `/ml/eval` that produced it. Results are stored in `ml/reports/*.json` and read at runtime. Never invent, round, or fabricate metrics.

### IV. Privacy by Design
No raw patient identifiers anywhere in DB, logs, or UI. DICOM de-identification on ingest. Hashed study IDs only. Runtime uploads are inference-only — never added to training/calibration/evaluation sets.

### V. Calibration & Uncertainty First
Probabilities must be calibrated (temperature scaling minimum). Uncertainty must be exposed (MC-dropout or ensemble). Low-confidence and quality-fail studies are surfaced visibly as "Needs human read", never buried.

### VI. Reproducibility
Pinned dependencies, seeded training, deterministic splits. `make train`, `make eval`, `make demo` must work. Patient-level splits enforced — no patient in more than one split.

### VII. Reading Room Design
Dark-first, medical-instrument aesthetic. Color is reserved for clinical meaning only. Follow the design system in PRD section 12 exactly. No generic SaaS templates.

## Technical Standards

- Python 3.11+, FastAPI backend, React+TypeScript+Vite frontend
- DenseNet-121 baseline with torchxrayvision pretrained weights
- SQLite for dev (Postgres-ready), Alembic migrations
- Docker Compose for single-command startup
- All decisions documented in `DECISIONS.md`

## Governance

This constitution supersedes all other practices. Every PR and code change must comply. Ambiguities are resolved by choosing the option stated in the PRD and noting the decision in `DECISIONS.md`.

**Version**: 1.0.0 | **Ratified**: 2026-11-17 | **Last Amended**: 2026-11-17
