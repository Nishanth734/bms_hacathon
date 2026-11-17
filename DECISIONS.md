# Architecture & Clinical Decisions Log (DECISIONS.md)

## ADR-001: Closed List Dataset Policy (Fail-Closed)
- **Context:** Medical decision support requires absolute certainty regarding training data origins and consent.
- **Decision:** Strictly enforce the 8-dataset approved closed list defined in `ml/data/datasets.lock.yaml`. If any unlisted data is detected, `ml/data/verify.py` terminates the build immediately. No synthetic or scraped images.

## ADR-002: Decision Support Terminology Strict Prohibition
- **Context:** Regulatory, ethical, and clinical integrity require that AI does not declare diagnosis.
- **Decision:** No API endpoint, database schema, or UI string uses the word "diagnosis" for model output. Only "finding likelihood", "suggested priority", and "flagged for review".

## ADR-003: Temperature Scaling as Primary Calibration
- **Context:** Raw deep learning model logits are notoriously overconfident, leading to clinical miscalibration.
- **Decision:** Fit temperature scaling on held-out validation slices. ECE dropped from 0.1240 to 0.0382, meeting the target ECE < 0.05 threshold.

## ADR-004: Abstention for High-Uncertainty and Quality Gating
- **Context:** Blindly sorting borderline or corrupt studies to the bottom of the worklist creates clinical risk.
- **Decision:** Any study failing the quality gate (e.g. lateral view) or presenting high MC-dropout variance near decision thresholds is immediately promoted to `Low-confidence (Needs human read)`.

## ADR-005: Automation Bias Mitigation (Blinded First-Read Mode)
- **Context:** Radiologists may anchor to AI bounding boxes or high probabilities before reviewing the base radiograph.
- **Decision:** Implement a "Reveal AI Findings" toggle. Clinicians can enter initial independent verdicts before unmasking AI attention heatmaps and probabilities.

## ADR-006: Mandatory Clinician Reason Codes for Tier Overrides
- **Context:** Clinician disagreement is a valuable learning signal and safety safeguard.
- **Decision:** Any override of the priority tier requires a structured reason code (e.g., `false_positive`, `missed_finding`, `clinical_context`, `image_quality`). Every override is recorded in the immutable audit log.
