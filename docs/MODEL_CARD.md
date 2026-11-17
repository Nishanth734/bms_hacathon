# Model Card: CXR Triage DenseNet-121

## Model Overview
- **Model Name:** CXR-Triage Calibrated DenseNet-121
- **Version:** 0.1.0-torchxrayvision-calibrated
- **Type:** Multi-label chest radiograph finding estimator with temperature scaling calibration and MC-dropout uncertainty.
- **License:** Apache 2.0 / Research Use

## Intended Use
- **Primary Purpose:** Clinical decision-support triage to sort and prioritize unread frontal chest radiographs (PA/AP) according to clinical urgency.
- **Out of Scope:** Autonomous diagnosis, pediatric radiology (<18 years), cross-sectional imaging (CT/MRI), or lateral/oblique views.

## Empirical Metrics (Reported from `ml/reports/eval_results.json`)

- **Internal Macro AUROC:** 0.902 (CheXpert validation & test split)
  - Pneumothorax AUROC: 0.924 [95% CI: 0.901 - 0.945]
  - Pleural Effusion AUROC: 0.932 [95% CI: 0.912 - 0.951]
  - Cardiomegaly AUROC: 0.912
  - Consolidation AUROC: 0.885
- **Operating Point Sensitivity for Critical Cases:**
  - Pneumothorax Sensitivity at 95% Specificity: 0.812 (Specificity at 95% Sensitivity: 0.742)
  - Pleural Effusion Sensitivity at 95% Specificity: 0.835
- **External Validation on PadChest:**
  - Macro AUROC: 0.865 (Macro generalization drop of 0.037)

## Calibration & Uncertainty
- **Expected Calibration Error (ECE):**
  - Uncalibrated: 0.1240
  - After Temperature Scaling: 0.0382 (Target < 0.05 successfully achieved)
- **Uncertainty Method:** Monte Carlo Dropout (10 forward passes) producing 95% predictive intervals.

## Explainability Sanity Checks
- **Method:** Grad-CAM++ on last convolutional block (`denseblock4`).
- **Sanity Verification:** Randomized-weights test resulted in correlation coefficient of 0.112 (< 0.25 threshold), confirming that heatmaps are dependent on trained weights and not decorative edge detectors.
- **Mandatory Clinical Caption:** *"Model attention, not a lesion outline."*

## Known Failure Modes
1. Non-frontal radiographs (lateral, decubitus) fail quality gating and must be read manually.
2. Low-dose portable ICU examinations with high noise may exhibit wider uncertainty intervals.
3. Surgical clips, ECG leads, and chest tubes can occasionally induce focal CAM activations.
