# CXR Triage — Reading Room Web Application

React + TypeScript + Tailwind CSS v4 workstation interface for chest radiograph triage and clinical decision support.

## Key Views

- **Worklist (`/worklist`)**: Prioritized triage rail with SLA countdown rings, dynamic queue health indicators, and filter controls.
- **Reading Room Viewer (`/study/:id`)**: Dual-pane DICOM lightbox with Window/Level interactive canvas adjustment, invert, zoom/pan, multi-label probability gauge with 95% predictive whiskers, Grad-CAM++ localization heatmap overlay, dynamic clinical context recalculation, blinded first-read mode, and audit-locked sign off.
- **Model Performance (`/performance`)**: Empirical ROC curves, calibration reliability diagrams, decision curves, and PadChest domain shift metrics.
- **Triage Simulation (`/simulation`)**: Dynamic FIFO vs AI-prioritized queue timeline simulation showing critical wait time reduction.
- **Audit Log (`/audit`)**: Immutable chronological ledger of clinical reviews, verdicts, priority overrides, and sign-offs.

## Deployment on Vercel

### Option 1: 1-Click Import via Vercel Dashboard
1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Import repository `https://github.com/Nishanth734/bms_hacathon`.
3. Set **Root Directory** to `frontend`.
4. Deploy!

### Option 2: Vercel CLI
```bash
cd frontend
vercel --prod
```
