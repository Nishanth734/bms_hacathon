# PRD: CXR Triage, Chest X-ray Decision-Support & Prioritization Tool

*Build brief for the IDE agent. Read the whole document before writing code. Build in the phase order in section 14.*

---

## 0. Instructions to the IDE agent

You are building a complete, runnable, end-to-end web application, not a mockup. Requirements:

1. Everything in sections 1 to 13 must work locally with one command (`docker compose up`, or `make dev` as a fallback).
2. The ML pipeline must be real: training scripts, evaluation scripts, calibrated inference. If GPU or full datasets are unavailable, ship a **pretrained-weights path** (e.g. `torchxrayvision` DenseNet) plus the fine-tuning scripts, and clearly mark which numbers in the UI come from which model.
3. Never invent metrics. Every number shown in the UI or README must come from a script in `/ml/eval` that produced it. Store results in `ml/reports/*.json` and read them at runtime.
4. The product is **decision support**. No screen, string, or API field may say "diagnosis" as a model output. Use "finding likelihood", "suggested priority", "flagged for review".
5. Follow the design system in section 12 exactly. Do not substitute generic UI-kit defaults.
6. Ask nothing; where something is ambiguous, choose the option stated here and note the decision in `DECISIONS.md`.

**Dataset rule (overrides everything else in this document):** use only the datasets listed in section 4, obtained from their official sources, with every one recorded in `datasets.lock.yaml`. No synthetic, scraped or unlisted data. If a dataset is missing, the pipeline stops and the UI says so; it never substitutes.

---

## 1. Problem statement (official)

> Develop a decision-support tool that analyzes approved medical images or clinical datasets to identify potential signs of disease and help healthcare professionals prioritize cases for further assessment.

### Our interpretation

| Phrase | What we build |
| --- | --- |
| decision-support | AI proposes, clinician decides. Every AI output is overridable and logged. |
| approved images/datasets | Only public, de-identified datasets. DICOM de-identification and audit built in. |
| potential signs of disease | Calibrated per-finding likelihoods plus localization heatmaps, never hard labels. |
| prioritize cases | A **triage worklist** ranking studies by urgency. This is the hero feature. |

---

## 2. Product summary

**CXR Triage** ingests chest X-rays (DICOM, PNG, JPG), runs a calibrated multi-label model, converts findings into a clinical urgency tier (**Critical / Urgent / Routine / Low-confidence**), and presents a ranked worklist to a radiologist. The radiologist opens a study in a viewer, sees the AI's findings with heatmaps and uncertainty, and confirms, edits, or overrides. Every action is stored in an audit trail. Overrides feed an evaluation dashboard showing how the model performs against clinician judgment.

### Target users

- **Primary: Radiologist / reading physician.** Needs fast, trustworthy ranking so critical cases are read first.
- **Secondary: ED physician / referring clinician.** Wants a quick, explained flag on their patient's study.
- **Tertiary: Clinical lead / QA admin.** Monitors model performance, overrides, turnaround time.

### Success definition

A reviewer should be able to upload 50 mixed studies and see the critical ones float to the top within seconds, open any one, understand *why*, and see honest evidence the system works.

---

## 3. Scope

### In scope (MVP)

- Findings: **Pneumothorax, Pleural effusion, Consolidation/Pneumonia, Cardiomegaly, Edema, Atelectasis, Lung opacity, No finding.** Optional stretch: TB pattern screening, nodule/mass.
- Image ingestion: DICOM, PNG, JPG. Batch upload and folder upload.
- Quality gate: reject or flag non-chest, rotated, low-quality, or lateral-only images.
- Calibrated multi-label inference with uncertainty.
- Grad-CAM (or better) localization heatmaps.
- Priority engine with transparent, configurable rules.
- Radiologist worklist and image viewer.
- Clinician review (confirm / edit / override) with reason codes.
- Optional clinical context (age, sex, SpO2, temperature, symptoms) that adjusts priority.
- Audit log, role-based access, de-identification.
- Model performance dashboard (AUROC, sensitivity at fixed specificity, calibration, external validation).
- PDF/Markdown case summary export (draft, requires clinician sign-off).

### Out of scope

- Autonomous diagnosis, treatment recommendations, regulatory (FDA/CE) claims.
- Real PACS/HL7/FHIR integration (provide a mock adapter and a documented interface only).
- Real patient data. **Only public de-identified datasets, as listed in section 4.**

---

## 4. Data strategy

**Strict rule: only the datasets in this table may be used.** They are published, de-identified, research-approved chest X-ray collections, which is what "approved medical images" means in the problem statement. Anything not listed here is forbidden, including scraped images, re-uploaded copies on random mirrors, generated or synthetic images, and any real hospital or clinic data. Download every dataset from its official source only. Before use, read each dataset's license or data use agreement and record its exact terms in `docs/DATA.md`; do not rely on the summary in this table.

| Dataset | Role in this project | Official source and access | Key facts | Ship images in repo? |
| --- | --- | --- | --- | --- |
| **CheXpert** (Stanford AIMI) | Primary training and validation | Stanford AIMI portal; free registration and research-use agreement | 224,316 chest radiographs, 65,240 patients, 14 observations with uncertainty labels (labeler-derived) | No |
| **NIH ChestX-ray14** | Second training source; the only source of the demo cohort | NIH Clinical Center public release | 112,120 frontal images, 30,805 patients, 14 labels mined from reports (noisy); public domain (CC0) | Demo subset only |
| **MIMIC-CXR-JPG** | Optional extra training or external test | PhysioNet, credentialed access (training course and data use agreement) | De-identified hospital radiographs with report-derived labels | Never |
| **PadChest** | External validation | BIMCV, Hospital San Juan Alicante; free access on request | De-identified Spanish hospital radiographs | No |
| **VinDr-CXR** | External validation and heatmap localization check | PhysioNet | Radiologist-annotated findings with bounding boxes | No |
| **SIIM-ACR Pneumothorax** | Optional check of pneumothorax heatmaps against masks | Kaggle competition page | Pneumothorax segmentation masks | No |
| **RSNA Pneumonia Detection** | Optional check of pneumonia localization | Kaggle competition page | Boxes for pneumonia-like opacities | No |
| **NLM Montgomery and Shenzhen** | Stretch goal only: TB screening | U.S. National Library of Medicine | Public TB chest X-ray sets | No |

### Data rules

- **Closed list, fail closed.** Create `ml/data/datasets.lock.yaml` with, per dataset: name, official URL, version or download date, license, access type, citation, file count, and SHA-256 of the archive or manifest. `ml/data/verify.py` must fail the build if any file belongs to an unlisted dataset or a hash does not match. Training and evaluation scripts must refuse to start until verification passes.
- **No fake or substitute data, ever.** If a dataset is not yet downloaded, the UI shows "Dataset unavailable" for the metrics that depend on it. Never fill the gap with synthetic images, a different dataset, or placeholder numbers. Metrics are reported only for datasets that were actually used.
- **Respect access tiers.** CheXpert, MIMIC-CXR, PadChest and VinDr-CXR require the person running the project to accept the terms with their own account. Never commit or redistribute their images. The `/demo_data` cohort is built only from the public-domain NIH ChestX-ray14 test split (60 cases, seeded, manifest committed).
- **Patient-level splits.** Use each dataset's official split where one exists. No patient appears in more than one of train, validation, calibration or test. Seeds and split manifests are committed.
- **External validation must be genuinely external.** Train on CheXpert (and optionally NIH), calibrate on a held-out slice, and report external results on PadChest or VinDr-CXR. Never tune thresholds on the external set.
- **Pretrained weights need provenance.** For any pretrained backbone, record in `docs/DATA.md` which datasets it was trained on. If a test or external set was seen during that pretraining, say so in the model card as contamination, or choose weights or an external set that avoid the overlap.
- **Label honesty.** CheXpert and NIH labels are derived from reports by automated labelers, so call them "labeler-derived reference", never "ground truth". Use radiologist-annotated sets (CheXpert's radiologist-labeled validation set, VinDr-CXR) for the most trustworthy evaluation.
- **Runtime uploads are inference-only.** Studies a user uploads are never added to any training, calibration or evaluation set.
- **Provenance in the UI.** The Model Card page's "Training data" section is generated from `datasets.lock.yaml`: dataset names, versions, counts, licenses, citations, label method and known limitations.

---

## 5. ML requirements

### 5.1 Model

- Backbone: **DenseNet-121** (baseline, well-validated for CXR) and **ConvNeXt-Tiny or EfficientNetV2-S** (comparison). Choose the better on validation.
- Initialize from pretrained weights (`torchxrayvision` or ImageNet). Fine-tune multi-label with BCE (class-weighted or focal loss for imbalance).
- Input: 320 to 384 px, grayscale replicated to 3 channels, CLAHE optional (ablate it).
- Augmentation: small rotation, scale, brightness/contrast, no horizontal flip (cardiac position matters) unless ablation shows it is safe.
- Mixed precision, early stopping on validation macro-AUROC, 3-seed ensemble or checkpoint averaging if time allows.

### 5.2 Accuracy plan (the honest way)

Do **not** headline raw accuracy. Report:

1. **AUROC per finding** with 95% bootstrap confidence intervals.
2. **AUPRC per finding** (because prevalence is low for some).
3. **Sensitivity at 90% and 95% specificity** per finding, plus **specificity at 95% sensitivity** for critical findings (pneumothorax, large effusion). Triage tools must not miss critical cases.
4. **Calibration**: reliability diagram and Expected Calibration Error before and after calibration.
5. **External validation** on a different dataset, reported next to internal results, including the drop (be honest).
6. **Subgroup analysis** by sex and age band where metadata exist.
7. **Triage-level metrics**: how well the *final priority tier* matches a reference ordering (e.g. proportion of true critical cases in the top 10%, mean rank of critical cases, simulated time-to-read reduction vs first-in-first-out).

Target (aspirational, report whatever is true): AUROC ≥ 0.85 macro on internal test; ≥ 0.90 for pneumothorax and effusion where data supports it; ECE < 0.05 after calibration.

### 5.3 Calibration and uncertainty

- Fit **temperature scaling** (and compare with per-class Platt/isotonic) on a held-out calibration split.
- Uncertainty via **MC-dropout or a 3 to 5 model ensemble**; expose a predictive interval per finding.
- **Abstention rule**: if max finding probability sits inside an uncertainty band (e.g. 0.35 to 0.65) with high ensemble variance, or the quality gate fails, the study gets tier **Low-confidence → needs human read** and is never silently placed at the bottom. Low-confidence cases are surfaced visibly, not hidden.
- **Out-of-distribution check**: Mahalanobis or energy-based score on penultimate features, plus a simple classifier for "is this a frontal chest X-ray".

### 5.4 Explainability

- **Grad-CAM++** on the last conv block per finding; show on demand per finding.
- Sanity checks included in the eval folder: randomized-weights test and a deletion-curve test, so heatmaps are not decorative. Show a small *"Heatmap reliability"* note in the model card.
- Heatmaps are labeled *"Model attention, not a lesion outline"*.

### 5.5 Priority engine (transparent rules, not a black box)

Priority is computed from calibrated probabilities with a config file `priority_rules.yaml`:

```yaml
critical_findings:
  pneumothorax: {critical: 0.60, urgent: 0.35}
  pleural_effusion: {critical: 0.85, urgent: 0.55}
urgent_findings:
  consolidation: {urgent: 0.50}
  edema: {urgent: 0.55}
routine_findings:
  cardiomegaly: {routine: 0.50}
  atelectasis: {routine: 0.50}
context_modifiers:
  spo2_lt_92: +1 tier
  age_gt_65_with_consolidation: +0.1 score
  fever_with_consolidation: +0.1 score
priority_score: weighted_max(finding_prob * severity_weight) + modifiers
abstain_if: [quality_fail, ood, high_uncertainty_near_threshold]
```

- Output: `priority_tier`, `priority_score (0-100)`, and an **explanation string list** such as *"Pneumothorax likelihood 0.82 (interval 0.74 to 0.89), above critical threshold 0.60"*.
- Thresholds are tuned on validation to hit a **target sensitivity (≥ 95%) for critical findings**, and the resulting false-positive rate is displayed openly.

---

## 6. Functional requirements

### F1. Ingestion

- Drag-and-drop single or batch upload; folder upload; "Load demo cohort" button.
- DICOM parsing (`pydicom`): extract modality, view position, pixel spacing; apply window/level and photometric interpretation (MONOCHROME1 inversion).
- **De-identification on ingest**: strip or hash PHI tags (PatientName, PatientID, DOB, etc.); store a hashed study ID only. Show a "De-identified" badge.
- Background processing queue with progress per study.

### F2. Quality gate

Checks: is chest, is frontal, rotation, exposure, minimum resolution. Failing studies get a visible reason (e.g. "Lateral view, not supported") and tier *Needs human read*.

### F3. Inference service

`POST /api/studies/{id}/analyze` returns per-finding calibrated probability, interval, heatmap path, quality flags, model version, latency.

### F4. Triage worklist (hero screen)

- Ranked list, sorted by priority score. Columns: rank, study ID (hashed), thumbnail, top finding with probability, tier, wait time, status.
- Filters: tier, finding, status (unread, in review, signed), confidence.
- Live re-sorting as new studies finish processing, with a subtle insertion animation.
- SLA timers: each tier has a target read time (Critical 15 min, Urgent 60 min, Routine 24 h). Show overdue state.
- Bulk actions: assign, mark reviewed.

### F5. Case viewer

- Zoom, pan, window/level, invert, measurement tool, side-by-side with heatmap, opacity slider, per-finding heatmap selection.
- Findings panel: each finding with probability bar, uncertainty whisker, threshold marker, and *"Why flagged"* text.
- Clinical context form (optional) that updates priority live.
- Prior-study comparison slot (stub; upload a second image to compare side by side).

### F6. Clinician review

- Per finding: **Agree / Disagree / Uncertain** plus optional free text.
- Override priority tier with required reason code (false positive, missed finding, clinical context, image quality, other).
- Sign-off action locks the review and writes an audit entry.
- Draft report text generated from structured findings, clearly stamped *"AI-assisted draft. Requires clinician review."* (template-based, no hallucinating LLM required; an LLM option may be added behind a flag).

### F7. Audit and compliance

- Immutable audit log: who, when, what changed, model version, before/after values.
- Roles: **Radiologist, Referrer, Admin**, with JWT auth and role-based route guards.
- Consent/disclaimer banner and data-use notice on first login.

### F8. Model performance dashboard

- Pulls from `ml/reports/*.json`.
- ROC and PR curves, sensitivity-at-specificity table, reliability diagram, internal vs external comparison, subgroup chart.
- **Live clinician-agreement panel**: override rate, agreement per finding, from review data.
- Model card page: intended use, training data, limitations, known failure modes, version, date.

### F9. Simulation view (differentiator)

A "Triage impact" page replays the demo cohort as a FIFO queue vs the AI-prioritized queue and shows time-to-read for critical cases under both, with a clear note that it is a simulation on retrospective data.

---

## 7. Non-functional requirements

- Inference latency target < 3 s per study on CPU for demo model; < 500 ms with GPU.
- Worklist loads < 1 s for 500 studies.
- Accessibility: keyboard navigation in worklist and viewer, WCAG AA contrast, never encode tier by color alone (use icon + label).
- Reproducibility: pinned dependencies, seeded training, `make train`, `make eval`, `make demo`.
- Security: no PHI persisted, uploads size-limited and type-validated, secrets via env, CORS locked down, rate limiting on analyze endpoints.
- Observability: structured logs, model version stamped on every prediction.

---

## 8. Architecture

```
/frontend        React + TypeScript + Vite
/backend         FastAPI (Python 3.11)
/ml
  /data          prepare.py, split manifests
  /train         train.py, configs/
  /eval          eval.py, calibrate.py, explain_check.py, triage_sim.py
  /reports       generated JSON + PNG
  /serving       inference.py (loads weights, calibration, ensemble)
/demo_data       curated demo cohort + manifest.json
/docs            DATA.md, MODEL_CARD.md, DESIGN.md, DECISIONS.md
docker-compose.yml
Makefile
```

- **Backend**: FastAPI, SQLAlchemy, SQLite for dev (Postgres-ready), Alembic migrations, background tasks via `asyncio` queue or Celery+Redis if time allows.
- **ML serving**: in-process module with lazy model loading; ONNX export option for CPU speed.
- **Frontend**: React, TypeScript, TanStack Query, Zustand, a canvas-based viewer (Cornerstone.js or a custom canvas with WebGL window/level). Charts via Recharts or visx.
- **Storage**: local filesystem for images and heatmaps under hashed IDs.

### Data model (core tables)

- `users(id, role, name, email_hash)`
- `studies(id, hashed_uid, source, view, quality_json, status, created_at)`
- `analyses(id, study_id, model_version, findings_json, priority_tier, priority_score, explanation_json, uncertainty_json, latency_ms, created_at)`
- `clinical_context(study_id, age, sex, spo2, temp, symptoms_json)`
- `reviews(id, study_id, analysis_id, reviewer_id, finding_verdicts_json, tier_override, override_reason, notes, signed_at)`
- `audit_log(id, actor_id, action, entity, before_json, after_json, ts)`

### Key API endpoints

```
POST   /api/auth/login
POST   /api/studies/upload            (multipart, batch)
GET    /api/studies?tier=&status=&sort=priority
GET    /api/studies/{id}
POST   /api/studies/{id}/analyze
PUT    /api/studies/{id}/context
POST   /api/studies/{id}/review
POST   /api/studies/{id}/sign
GET    /api/studies/{id}/heatmap/{finding}
GET    /api/metrics/model            (reads ml/reports)
GET    /api/metrics/agreement
GET    /api/simulation/triage
GET    /api/audit?entity=
```

---

## 9. Screens

1. **Login / role select** with disclaimer.
2. **Triage worklist** (home).
3. **Case viewer** with findings panel.
4. **Upload & processing** screen with queue progress.
5. **Performance & model card** dashboard.
6. **Triage impact simulation.**
7. **Audit log** (admin).

---

## 10. Safety & ethics requirements

- Persistent footer on clinical screens: *"Decision support only. Not a diagnostic device. Clinician judgment prevails."*
- Model card shows known limitations (e.g. performance drop on portable films, devices/lines as shortcut features, noisy labels).
- Fairness view: subgroup performance with the gap visible.
- Automation-bias mitigation: AI findings are hidden behind a **"Reveal AI findings"** toggle option for blinded first-read mode (config flag), and the clinician's verdict is stored before the reveal when enabled.
- All claims in README/UI must be traceable to a report file.

---

## 11. Acceptance criteria

1. `docker compose up` brings up working frontend and backend; "Load demo cohort" populates a ranked worklist.
2. Uploading a new PNG/DICOM yields findings, heatmap, tier, and explanation within the latency target.
3. Test set metrics exist in `ml/reports` and render in the dashboard, including external-validation numbers and calibration plot.
4. At least 95% sensitivity for critical findings at the chosen operating point on the test set, or the dashboard states the true achieved value and the operating point used.
5. Low-confidence and quality-fail studies appear as *Needs human read*, not buried.
6. Override flow requires a reason code, and each action appears in the audit log.
7. No raw patient identifiers appear anywhere in the DB, logs, or UI.
8. Triage simulation shows time-to-read for critical cases under FIFO vs AI-prioritized queue.
9. Keyboard-only user can reach the top case, open it, toggle a heatmap, and sign off.
10. Lighthouse accessibility ≥ 90 on worklist and viewer.

---

## 12. Design strategy

### 12.1 Concept: "The reading room, not the dashboard"

Radiologists work in dim rooms, looking at grayscale images on calibrated monitors. Everything bright steals contrast from the image. So the interface should feel like **reading-room software**: dark, quiet, precise, with the radiograph as the hero and color reserved strictly for clinical meaning.

Visual metaphor: **film on a light box**, with **DICOM-style corner annotations**, thin technical rules, and instrument-panel data. It should feel like a serious medical instrument that a design-aware person built, not a SaaS template.

### 12.2 Anti-slop rules (hard bans)

- No purple/blue gradient hero, no glassmorphism cards stacked on gradients.
- No stock "AI brain", glowing neural network, or robot imagery.
- No emoji icons, no generic 3-column feature grid, no rounded-everything pill soup.
- No default Inter-on-white with shadcn defaults and grey-on-grey cards.
- No decorative charts. Every chart answers a clinical or trust question.
- No lorem ipsum or fake round numbers. Demo data comes from the manifest.
- No red used for anything except clinical criticality.

### 12.3 Color system

Neutrals carry the whole UI. Color means something.

| Token | Hex | Use |
| --- | --- | --- |
| `--bg-0` | `#0B0E11` | App background (near-black, slight cool cast like a monitor) |
| `--bg-1` | `#12171B` | Panels |
| `--bg-2` | `#1A2127` | Raised rows, hover |
| `--line` | `#26303A` | Hairline rules (1px) |
| `--text-0` | `#E6EBEF` | Primary text (not pure white) |
| `--text-1` | `#9AA7B2` | Secondary |
| `--text-2` | `#66727D` | Tertiary / annotations |
| `--film` | `#C9D4DB` | Highlights that echo X-ray film |
| `--critical` | `#FF4D4F` | Critical tier only |
| `--urgent` | `#F2A33A` | Urgent tier |
| `--routine` | `#4FB3A5` | Routine tier (muted teal) |
| `--review` | `#8E9AF0` | Low-confidence / needs human read (the only cool accent) |
| `--heat` | gradient `#1B2A6B → #E04B3A → #FFD84D` | Heatmap overlay ramp, used only on images |

Contrast: verify AA for all text tokens against their backgrounds. Provide an optional light "clinic" theme with the same token names for presentation on projectors, but dark is the default and the hero.

### 12.4 Typography

- **UI & headings**: *IBM Plex Sans* (sober, technical, medical-adjacent without being cold).
- **Data, IDs, timestamps, probabilities**: *IBM Plex Mono* with tabular numerals, so values align in columns.
- Optional single display accent: *Fraunces* or *Source Serif 4* **only** for the product wordmark and the model-card headings, to give a human, editorial touch.
- Scale: 12 / 13 / 14 / 16 / 20 / 28. Small, dense sizes are normal here, with 1.4 line height. Uppercase 11px tracked-out labels for panel titles.

### 12.5 Signature elements (what makes it visually specific to the topic)

1. **DICOM corner annotations** on the viewer: patient hash top-left, study info top-right, W/L and zoom bottom-left, model version and "AI-assisted" bottom-right, in 11px mono with low-contrast text. They are functional and instantly signal "medical imaging".
2. **Orientation markers** (R / L) on the image and an actual window/level drag interaction (hold left-click and drag, as on real workstations).
3. **Triage rail**: a slim vertical strip at the left edge of the worklist rows colored by tier, with a tier glyph (filled triangle for Critical, diamond for Urgent, circle for Routine, dashed ring for Needs review). Color is never the only cue.
4. **Probability gauge with uncertainty whisker**: a thin horizontal track, a tick for the threshold, a dot for the calibrated probability, and a whisker for the interval. It teaches the user uncertainty at a glance and is the product's visual identity.
5. **Heatmap as film overlay**: heatmap blends via `mix-blend-mode: screen/overlay`, fades with an opacity slider, and carries the permanent caption *"Model attention, not a lesion outline"*.
6. **Thumbnail strip as film sheet**: worklist thumbnails are shown as small grayscale film frames with a hairline border and a tiny frame number, like a contact sheet.
7. **SLA clock rings**: a thin circular countdown on Critical and Urgent rows. It turns from film-white to amber to red as time remaining shrinks.
8. **Wordmark**: simple lettering "CXR·TRIAGE" with a small mark made from a rib-curve or a lung-field silhouette drawn as two negative-space arcs. Keep it a single-color glyph.

### 12.6 Layout

- **Worklist**: three zones. Left slim nav (icons + tooltips), center ranked list as a dense table with hairlines (no cards), right collapsible **"Queue health"** panel (counts per tier, oldest critical, SLA breaches, throughput).
- **Viewer**: image fills the center on near-black with no chrome around it. Left vertical toolbar (zoom, pan, W/L, invert, measure, heatmap). Right panel **Findings & Review**, resizable. Bottom thin strip with keyboard hints.
- **Dashboard**: a grid built on a strict 8px baseline; charts use thin 1.5px strokes, direct labels instead of legends, and small multiples for per-finding metrics.
- Spacing 4/8/12/16/24. Corner radius 2 to 4px max, giving it an instrument-like crispness.

### 12.7 Motion

- Purposeful only: new studies slide into the worklist with a 180 ms ease and a brief tier-colored edge pulse; heatmap crossfade 150 ms; probability dots animate to position on load.
- Respect `prefers-reduced-motion`.
- No bouncy springs, no parallax, no confetti on sign-off. A quiet checkmark and timestamp is enough.

### 12.8 Voice & microcopy

Clinical, calm, specific. Examples:

- "Pneumothorax likelihood 0.82 (0.74 to 0.89)" not "We think there might be a collapsed lung!"
- "Needs human read: image is a lateral view."
- Empty states explain the next action ("No studies awaiting review. Load the demo cohort to see triage in action.").
- Errors are factual and offer a fix.

### 12.9 Keyboard shortcuts (power-user feel)

`J/K` next/prev case, `Enter` open, `H` toggle heatmap, `1..7` select finding, `I` invert, `A/D/U` agree/disagree/uncertain, `Shift+S` sign off, `?` shortcut sheet.

### 12.10 Design deliverables

Create `docs/DESIGN.md` with the tokens above as CSS variables and a Tailwind config (or CSS modules) implementing them, and build a small component library: `TierBadge`, `ProbabilityGauge`, `FilmThumb`, `SlaRing`, `DicomOverlay`, `FindingRow`, `QueueHealth`, `ReliabilityChart`, `RocChart`.

---

## 13. Demo narrative (build the app so this story works in 3 minutes)

1. Open worklist: 60 studies, ranked. A pneumothorax sits at rank 1 with a pulsing Critical rail.
2. Open it: heatmap over the apex, gauge showing 0.88 with a tight interval, "Why flagged" explanation.
3. Change SpO2 in clinical context: priority score shifts, with the change explained.
4. Show a Low-confidence case that the system refused to rank low and routed to a human.
5. Override one finding with a reason, sign off, then show the audit entry.
6. Open Performance: ROC, sensitivity at 95% specificity, calibration, internal vs external drop.
7. Open Triage impact: critical cases read X minutes sooner than FIFO (value computed by the sim script).

---

## 14. Build phases (follow this order)

**Phase 1: Foundations.** Repo scaffold, Docker, Makefile, DB models, auth, design tokens and component skeletons.

**Phase 2: ML core.** Data prep and splits, baseline training, evaluation script, calibration, saved reports. If compute is limited, wire pretrained `torchxrayvision` weights first so the app is functional, then replace with fine-tuned weights.

**Phase 3: Inference service.** Quality gate, ensemble/MC-dropout uncertainty, Grad-CAM++, priority engine with `priority_rules.yaml`, analyze endpoint.

**Phase 4: Worklist & viewer.** Upload, queue, ranked worklist, viewer with W/L and heatmap overlay, findings panel.

**Phase 5: Review & audit.** Verdicts, overrides, sign-off, audit log, role guards, de-identification.

**Phase 6: Trust layer.** Performance dashboard, model card, fairness view, agreement panel, triage simulation.

**Phase 7: Polish.** Keyboard shortcuts, accessibility pass, empty states, motion, demo cohort, README with exact reproduction commands, final `DECISIONS.md`.

### Definition of done

All acceptance criteria in section 11 pass, the 3-minute demo in section 13 runs without manual fixes, and README lists every metric with the script that produced it.

---

## 15. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Dataset download or compute limits | Pretrained weights path, smaller subset, clearly labeled provenance |
| Noisy labels cap accuracy | Use uncertainty labels, report CIs, validate externally, document limitation |
| Overclaiming accuracy | Metrics only from scripts; show internal vs external drop |
| Heatmaps misleading | Sanity-check tests, mandatory caption, never presented as segmentation |
| Automation bias | Blinded-read mode, mandatory reason for overrides, agreement dashboard |
| Missed critical case | Threshold tuned for ≥ 95% sensitivity, abstention routes uncertainty to humans |
