# CXR Triage — Implementation Tasks (Spec Kit Automated)

## Status: COMPLETE
**Target**: Complete, runnable decision-support triage web application
**Constitution**: Validated against `.specify/memory/constitution.md`

### Task Breakdown

- [x] **T1. Foundations**
  - [x] Repo scaffold (/frontend, /backend, /ml, /demo_data, /docs)
  - [x] Database models (users, studies, analyses, clinical_context, reviews, audit_log)
  - [x] JWT authentication and role-based access control (Radiologist, Referrer, Admin)
  - [x] Docker Compose and Makefile setup
  - [x] Design system tokens (PRD Section 12) & Tailwind configuration

- [x] **T2. Data & Accuracy Strategy**
  - [x] `ml/data/datasets.lock.yaml` (Closed list, 8 approved datasets)
  - [x] `ml/data/verify.py` (Integrity check, fail-closed policy)
  - [x] `ml/data/prepare.py` (Patient-level splits, CheXpert/NIH formats, uncertainty handling)
  - [x] `priority_rules.yaml` (Transparent clinical rules & threshold configuration)

- [x] **T3. ML Engine & Inference Service**
  - [x] `ml/serving/quality_gate.py` (Chest/frontal/rotation/exposure/resolution gates)
  - [x] `ml/serving/priority_engine.py` (Tiers: Critical, Urgent, Routine, Low-confidence with explanation strings)
  - [x] `ml/serving/inference.py` (DenseNet multi-label inference, temperature calibration, MC-dropout intervals, Grad-CAM++ heatmaps, OOD energy score)
  - [x] `ml/eval/eval.py` (Per-finding AUROC, AUPRC, bootstrap 95% CIs, sensitivity@specificity)
  - [x] `ml/eval/calibrate.py` (Temperature scaling, ECE computation, reliability diagrams)
  - [x] `ml/eval/explain_check.py` (Randomized weights & deletion curve tests)
  - [x] `ml/eval/triage_sim.py` (FIFO vs AI prioritization queue replay simulation)
  - [x] Execute eval scripts and store reports in `ml/reports/*.json`

- [x] **T4. Demo Cohort & Ingestion**
  - [x] `demo_data/manifest.json` (60 seeded cases from NIH ChestX-ray14 test split)
  - [x] Generate demo images (DICOM & PNG) with ground truth findings
  - [x] DICOM parser with window/level, MONOCHROME1 inversion, and PHI de-identification

- [x] **T5. Backend API Services**
  - [x] `/api/studies/upload` (Batch/folder upload, de-identification badge)
  - [x] `/api/studies` (Triage worklist with filters, sorting by priority score)
  - [x] `/api/studies/{id}` & `/api/studies/{id}/analyze`
  - [x] `/api/studies/{id}/context` (Clinical context dynamic modifiers)
  - [x] `/api/studies/{id}/review` & `/api/studies/{id}/sign` (Verdicts, override with reason codes, audit trail)
  - [x] `/api/studies/{id}/heatmap/{finding}` & `/api/studies/{id}/report`
  - [x] `/api/demo/load` (Instant loading of 60-case demo cohort)
  - [x] `/api/metrics/model`, `/api/metrics/agreement`, `/api/simulation/triage`, `/api/audit`

- [x] **T6. Frontend "Reading Room" UI (PRD Section 12)**
  - [x] Setup npm dependencies (lucide-react, canvas tools)
  - [x] Core components: TierBadge, ProbabilityGauge, FilmThumb, SlaRing, DicomOverlay, FindingRow, QueueHealth, ShortcutModal, PersistentFooter
  - [x] Screen 1: Login / Role select with disclaimer & consent banner
  - [x] Screen 2: Triage Worklist (Hero screen: dense table, triage rail, SLA rings, queue health, live filters)
  - [x] Screen 3: Case Viewer (Dark reading room, W/L drag interaction, Grad-CAM++ blend overlay, findings & uncertainty, clinical context form, blinded-read toggle, review & sign-off)
  - [x] Screen 4: Upload & processing progress queue
  - [x] Screen 5: Performance Dashboard (ROC/PR curves, reliability diagram, subgroup analysis, agreement panel)
  - [x] Screen 6: Triage Impact Simulation (FIFO vs AI time-to-read reduction)
  - [x] Screen 7: Audit Log (Immutable administrative trail)
  - [x] Screen 8: Model Card (Intended use, provenance from datasets.lock.yaml, limitations)
  - [x] Keyboard shortcuts (J/K, Enter, H, 1-7, I, A/D/U, Shift+S, ?)

- [x] **T7. Verification & End-to-End Walkthrough**
  - [x] Run backend tests & API validation
  - [x] Verify frontend build & run dev server
  - [x] Walk through 3-minute demo narrative (PRD Section 13)
