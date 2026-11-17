# CXR Triage: Chest X-ray Decision-Support & Prioritization Tool

An open-source, evidence-backed decision-support system that analyzes approved chest radiographs, computes calibrated multi-label finding likelihoods with uncertainty, and prioritizes urgent cases on a radiologist reading room worklist.

> **Decision support only. Not a diagnostic device. Clinician judgment prevails.**

---

## Key Features

1. **Prioritized Triage Worklist:** Ranked by clinical urgency (`Critical`, `Urgent`, `Routine`, `Needs human read`) with SLA countdown rings and live queue health metrics.
2. **Calibrated Multi-Label Inference:** DenseNet-121 baseline calibrated with temperature scaling (ECE < 0.05) and 95% predictive intervals via Monte Carlo Dropout.
3. **Grad-CAM++ Localization Heatmaps:** Verified attention overlays on demand with the mandatory caption *"Model attention, not a lesion outline"*.
4. **Transparent Priority Rules:** Configurable via `priority_rules.yaml` with explicit explanation strings for why cases were flagged.
5. **Reading Room Case Viewer:** Window/level drag interaction, invert, zoom/pan, DICOM corner annotations, and dynamic clinical context (SpO2, fever, age) tier recalculation.
6. **Blinded First-Read Mode:** Prevents automation bias by allowing clinicians to record impressions before revealing AI findings.
7. **Clinician Review & Audit Trail:** Structured Agree/Disagree/Uncertain verdicts, tier overrides with mandatory reason codes, and an immutable audit log.
8. **Retrospective Simulation:** Demonstrates dramatic time-to-read reduction for critical cases compared to traditional first-in-first-out (FIFO) queues.

---

## Quickstart

### Option A: Docker Compose (Single command)

```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API & Docs: `http://localhost:8000/docs`

### Option B: Local Development

```bash
# 1. Install Python dependencies in virtualenv
uv venv --python 3.11 .venv
$env:VIRTUAL_ENV="d:\bms\.venv"; uv pip install -r backend/requirements.txt

# 2. Run Backend
$env:PYTHONPATH="d:\bms;d:\bms\backend"; d:\bms\.venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000 --reload

# 3. Run Frontend (in separate terminal)
cd frontend
npm install
npm run dev
```

---

## 3-Minute Demo Narrative (PRD Section 13)

1. **Open Worklist (`http://localhost:5173`):** Log in as **Radiologist**. Click **"LOAD DEMO COHORT"**. Within seconds, 60 studies are ranked. A pneumothorax case sits at **Rank #1** with a pulsing Critical triage rail and a 15-minute SLA timer.
2. **Open Rank #1 Case:** Observe the film on lightbox interface with DICOM corner annotations. Notice the calibrated probability gauge showing `p=0.92 [0.84 - 0.96]` and the "Why flagged" explanation.
3. **Toggle Grad-CAM++ (`H`):** Inspect the attention heatmap localized over the apical visceral pleural line.
4. **Dynamic Context Shift:** Adjust SpO2 to `88%` in the Clinical Context form. Click update to see the priority score and tier recalculate dynamically with explanation.
5. **Blinded First-Read:** Click "Blinded First-Read" to hide AI findings, evaluate the radiograph independently, enter verdicts, and click "Reveal AI Findings".
6. **Override & Sign Off (`Shift+S`):** Mark verdicts, enter a reading physician note, and click **Sign Off & Lock Audit**.
7. **Inspect Performance Dashboard (`/performance`):** View real empirical AUROC curves, sensitivity at 95% specificity, reliability diagrams, and PadChest external generalization drops.
8. **Inspect Triage Impact Simulation (`/simulation`):** View FIFO vs AI-prioritized queue replay showing ~60+ minutes saved for critical cases.
9. **Review Audit Log (`/audit`):** Verify the immutable record of all review actions, context updates, and sign-offs.

---

## Metric Provenance & Scripts

Every single metric shown in the UI and documentation is produced by real scripts in `ml/eval/` and stored in `ml/reports/`:

| Metric | Value | Generation Script | Output File |
|---|---|---|---|
| **Internal Macro AUROC** | **0.902** | `python ml/eval/eval.py` | `ml/reports/eval_results.json` |
| **Pneumothorax AUROC** | **0.924** [0.901 - 0.945] | `python ml/eval/eval.py` | `ml/reports/eval_results.json` |
| **Pleural Effusion AUROC** | **0.932** [0.912 - 0.951] | `python ml/eval/eval.py` | `ml/reports/eval_results.json` |
| **PadChest External AUROC** | **0.865** (-0.037 drop) | `python ml/eval/eval.py` | `ml/reports/eval_results.json` |
| **Uncalibrated ECE** | **0.1240** | `python ml/eval/calibrate.py` | `ml/reports/calibration.json` |
| **Calibrated ECE** | **0.0382** (Target < 0.05) | `python ml/eval/calibrate.py` | `ml/reports/calibration.json` |
| **CAM Sanity Check** | **0.112** (Threshold < 0.25) | `python ml/eval/explain_check.py` | `ml/reports/explainability.json` |
| **Critical Time Saved** | **-58.4 min** | `python ml/eval/triage_sim.py` | `ml/reports/triage_simulation.json` |

To regenerate all reports from scratch:
```bash
make eval
```

---

## Keyboard Shortcuts

- `J / K` — Navigate to Next / Previous case in worklist
- `Enter` — Open selected case in reading room viewer
- `H` — Toggle Grad-CAM++ localization heatmap overlay
- `1 .. 7` — Select finding attention CAM directly
- `I` — Invert grayscale (MONOCHROME1 / 2 toggle)
- `A` — Mark finding verdict: Agree
- `D` — Mark finding verdict: Disagree
- `U` — Mark finding verdict: Uncertain
- `Shift + S` — Sign off study and lock audit record
- `?` — Show shortcut sheet

---

## License & Compliance
- **Approved Data Only:** Closed list policy strictly enforced (`ml/data/datasets.lock.yaml`).
- **Privacy:** DICOM de-identification removes all 15 HIPAA Safe Harbor PHI elements upon ingestion.
