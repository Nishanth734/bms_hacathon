# Data Strategy & Dataset Governance

**Strict Rule:** Only the datasets listed in `ml/data/datasets.lock.yaml` may be used. Closed list, fail closed. No synthetic, scraped, or unapproved hospital data.

## Approved Datasets Registry

| Dataset | Provider | Access Type | Role in Project | License |
|---|---|---|---|---|
| **CheXpert** | Stanford AIMI | Registration & Research DUA | Primary training and validation split | Non-commercial Research |
| **NIH ChestX-ray14** | NIH Clinical Center | Open Public Download | Second training source; 60-case demo cohort | Public Domain (CC0) |
| **MIMIC-CXR-JPG** | PhysioNet / MIT | Credentialed (CITI + DUA) | External test evaluation | PhysioNet Credentialed |
| **PadChest** | BIMCV, Spain | Free on request | Genuinely external validation | ODbL 1.0 |
| **VinDr-CXR** | PhysioNet | Credentialed | External test & bounding box CAM check | PhysioNet Credentialed |
| **SIIM-ACR Pneumothorax** | SIIM / Kaggle | Competition Login | Pneumothorax mask localization check | Research Use |
| **RSNA Pneumonia** | RSNA / NIH | Kaggle Login | Pneumonia opacity localization check | Research Use |
| **NLM Montgomery/Shenzhen** | U.S. NLM | Open Download | TB pattern screening (stretch) | Open Public |

## Pretrained Weights Provenance

- **Backbone Architecture:** DenseNet-121
- **Checkpoint Source:** `torchxrayvision` (all-dataset pretrained weights initialized on CheXpert and NIH ChestX-ray14).
- **Contamination Disclosure:** Pretrained weights incorporate CheXpert and NIH public training slices. External validation on **PadChest (Spain)** is completely independent and was never seen during pretraining or hyperparameter tuning.

## Patient-Level Splitting Rules

- No patient may ever appear in more than one split (Train, Val, Calibration, Test).
- Deterministic cryptographic hashing (`ml/data/prepare.py` `patient_hash_split`) guarantees reproducible splits across executions.
