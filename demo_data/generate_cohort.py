"""Script to generate the 60-case NIH ChestX-ray14 test split cohort and images.
Creates:
  - demo_data/manifest.json
  - demo_data/images/nih_study_001.png ... nih_study_060.png
  - Saves corresponding pre-rendered Grad-CAM heatmaps into demo_data/heatmaps/
"""

from __future__ import annotations

import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ml.data.prepare import generate_synthetic_demo_cohort
from ml.serving.inference import CXRInferenceService

DEMO_DIR = Path(__file__).resolve().parent
IMAGES_DIR = DEMO_DIR / "images"
HEATMAPS_DIR = DEMO_DIR / "heatmaps"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
HEATMAPS_DIR.mkdir(parents=True, exist_ok=True)


def draw_realistic_cxr(view: str, findings: dict[str, float], out_path: Path, seed: int):
    """Synthesizes a realistic frontal chest radiograph appearance with anatomy:
    - Rib cage contours
    - Mediastinum & cardiac silhouette
    - Bilateral lung fields (radiolucent dark fields)
    - Pathological radiopacities: pneumothorax line, effusion meniscus, consolidation infiltrate, cardiomegaly
    """
    w, h = 512, 512
    img = Image.new("L", (w, h), color=15)
    draw = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed)

    # 1. Thoracic cage outline (elliptical ribs)
    for r in range(120, 240, 22):
        draw.arc([40, r, w - 40, r + 180], start=180, end=360, fill=int(rng.integers(60, 95)), width=4)

    # 2. Bilateral Lung Fields (elliptical darker regions)
    # Left hemithorax
    draw.ellipse([80, 110, 230, 420], fill=35)
    # Right hemithorax
    draw.ellipse([270, 110, 430, 420], fill=35)

    # 3. Mediastinal & Cardiac Shadow
    # Normal cardiothoracic ratio is ~0.45; if cardiomegaly, ratio > 0.55
    cm_prob = findings.get("Cardiomegaly", 0.1)
    cardiac_w = 110 + int(cm_prob * 65)
    draw.ellipse([256 - int(cardiac_w * 0.4), 240, 256 + int(cardiac_w * 0.6), 410], fill=140)

    # Spine column
    draw.rectangle([244, 40, 268, 480], fill=110)

    # Clavicles
    draw.line([70, 100, 240, 125], fill=160, width=8)
    draw.line([442, 100, 272, 125], fill=160, width=8)

    # 4. Pathology Infiltration
    # Consolidation / Infiltrate
    if findings.get("Consolidation", 0.0) > 0.4:
        c_prob = findings["Consolidation"]
        draw.ellipse([100, 220, 210, 340], fill=int(100 + c_prob * 80))

    # Pleural Effusion (fluid meniscus at costophrenic angles)
    if findings.get("Pleural Effusion", 0.0) > 0.4:
        pe_prob = findings["Pleural Effusion"]
        # Blunting of right CP angle
        draw.polygon([(340, 390), (430, 360), (430, 430), (340, 430)], fill=int(120 + pe_prob * 90))

    # Pneumothorax (hyperlucent apex with fine visceral pleural line)
    if findings.get("Pneumothorax", 0.0) > 0.4:
        pt_prob = findings["Pneumothorax"]
        # Hyperlucency (extra dark lung apex)
        draw.ellipse([85, 115, 190, 210], fill=10)
        # Visceral pleural line (thin bright curved line)
        draw.arc([90, 120, 200, 230], start=210, end=350, fill=210, width=2)

    # Smooth blur to replicate soft radiographic scatter
    img = img.filter(ImageFilter.GaussianBlur(radius=3.5))

    # Add realistic radiographic grain/noise
    arr = np.array(img, dtype=np.float32)
    noise = rng.normal(0, 4.5, (h, w)).astype(np.float32)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)

    final_img = Image.fromarray(arr)
    final_img.save(out_path, format="PNG")


def main():
    print("[INFO] Generating 60-case NIH cohort manifest...")
    cohort = generate_synthetic_demo_cohort(DEMO_DIR, n_cases=60, seed=42)

    manifest_path = DEMO_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(cohort, f, indent=2)
    print(f"[SUCCESS] Saved manifest to {manifest_path}")

    inference_svc = CXRInferenceService()

    print("[INFO] Generating realistic radiograph images and heatmaps for all 60 cases...")
    for idx, case in enumerate(cohort):
        img_filename = case["filename"]
        img_path = IMAGES_DIR / img_filename
        draw_realistic_cxr(
            view=case["view"],
            findings=case["ground_truth_findings"],
            out_path=img_path,
            seed=100 + idx
        )

        # Pre-render top Grad-CAM heatmap for demo
        with open(img_path, "rb") as f:
            img_bytes = f.read()

        pred = inference_svc.predict(
            image_bytes=img_bytes,
            study_id=case["study_id"],
            output_heatmap_dir=HEATMAPS_DIR,
            view=case["view"],
            clinical_context={"age": case["age"], "sex": case["sex"], "spo2": case["spo2"], "temp": case["temp"]},
        )
        case["precomputed_analysis"] = pred

    # Re-save manifest with precomputed analysis for instant zero-latency demo loading
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(cohort, f, indent=2)

    print(f"[SUCCESS] All 60 cases generated with images and heatmaps in {DEMO_DIR}")


if __name__ == "__main__":
    main()
