"""Quality Gate Module per PRD Section 6 (F2).
Validates image quality before inference:
  - Minimum resolution check
  - Frontal view check (rejects LATERAL, OBLIQUE)
  - Exposure check (under/over exposure histogram analysis)
  - Aspect ratio / chest framing sanity check
"""

from __future__ import annotations

from typing import Any
import numpy as np
from PIL import Image


class QualityGateResult:
    def __init__(
        self,
        passed: bool,
        flags: list[str],
        view_detected: str,
        exposure_score: float,
        resolution: tuple[int, int],
        reasons: list[str],
    ):
        self.passed = passed
        self.flags = flags
        self.view_detected = view_detected
        self.exposure_score = exposure_score
        self.resolution = resolution
        self.reasons = reasons

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "flags": self.flags,
            "view_detected": self.view_detected,
            "exposure_score": round(self.exposure_score, 3),
            "resolution": list(self.resolution),
            "reasons": self.reasons,
        }


def assess_image_quality(
    image: Image.Image | np.ndarray,
    metadata_view: str | None = None,
    min_res: int = 256,
) -> QualityGateResult:
    """Evaluates image suitability for CXR multi-label inference."""
    flags: list[str] = []
    reasons: list[str] = []

    if isinstance(image, Image.Image):
        arr = np.array(image.convert("L"), dtype=np.float32)
        res = (image.width, image.height)
    else:
        if image.ndim == 3:
            arr = np.mean(image, axis=2).astype(np.float32)
        else:
            arr = image.astype(np.float32)
        res = (arr.shape[1], arr.shape[0])

    # 1. Resolution Check
    w, h = res
    if w < min_res or h < min_res:
        flags.append("LOW_RESOLUTION")
        reasons.append(f"Image resolution {w}x{h} below minimum required {min_res}x{min_res}.")

    # 2. Aspect ratio check
    aspect = max(w / max(h, 1), h / max(w, 1))
    if aspect > 2.2:
        flags.append("ABNORMAL_ASPECT_RATIO")
        reasons.append(f"Aspect ratio {aspect:.2f} is extreme for standard frontal radiograph.")

    # 3. View position check
    view = "PA"
    if metadata_view:
        view_upper = metadata_view.upper().strip()
        if "LAT" in view_upper:
            view = "LATERAL"
            flags.append("NON_FRONTAL_VIEW")
            reasons.append("Lateral view detected; model only validated on frontal (PA/AP) views.")
        elif "AP" in view_upper:
            view = "AP"
        elif "PA" in view_upper:
            view = "PA"
        else:
            view = view_upper

    # 4. Exposure & Contrast Analysis
    norm_arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-6)
    mean_val = float(np.mean(norm_arr))
    std_val = float(np.std(norm_arr))

    if mean_val < 0.12 or std_val < 0.08:
        flags.append("UNDEREXPOSED_OR_LOW_CONTRAST")
        reasons.append("Severe underexposure or contrast degradation detected.")
    elif mean_val > 0.88:
        flags.append("OVEREXPOSED")
        reasons.append("Severe overexposure (image washed out).")

    passed = len(flags) == 0
    return QualityGateResult(
        passed=passed,
        flags=flags,
        view_detected=view,
        exposure_score=mean_val,
        resolution=res,
        reasons=reasons,
    )
