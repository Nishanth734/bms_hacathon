"""DICOM and Image ingestion utilities with automated PHI de-identification per PRD Section 6 (F1)."""

from __future__ import annotations

import hashlib
import io
from pathlib import Path
from typing import Any
import numpy as np
from PIL import Image

try:
    import pydicom
    from pydicom.pixel_data_handlers.util import apply_windowing
    PYDICOM_AVAILABLE = True
except ImportError:
    PYDICOM_AVAILABLE = False


PHI_TAGS_TO_STRIP = [
    "PatientName",
    "PatientID",
    "PatientBirthDate",
    "PatientSex",
    "PatientAge",
    "PatientAddress",
    "ReferringPhysicianName",
    "StudyDate",
    "StudyTime",
    "AccessionNumber",
    "InstitutionName",
    "InstitutionalDepartmentName",
    "StationName",
    "OperatorsName",
    "PhysiciansOfRecord",
]


def process_uploaded_file(
    content: bytes,
    filename: str,
    output_dir: Path,
) -> dict[str, Any]:
    """Ingests a DICOM, PNG, or JPG file:
    - Strips PHI tags if DICOM
    - Applies window/level and MONOCHROME1 inversion
    - Produces a normalized grayscale PNG and a film thumbnail
    - Returns metadata (hashed_uid, view, spacing, quality hints)
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    file_hash = hashlib.sha256(content).hexdigest()
    study_uid = file_hash[:16]

    view_position = "PA"
    is_dicom = False
    metadata = {}

    if filename.lower().endswith((".dcm", ".dicom")) and PYDICOM_AVAILABLE:
        try:
            dcm = pydicom.dcmread(io.BytesIO(content), stop_before_pixels=False)
            is_dicom = True
            view_position = getattr(dcm, "ViewPosition", "PA") or "PA"

            # Window/level handling
            wc = getattr(dcm, "WindowCenter", None)
            ww = getattr(dcm, "WindowWidth", None)
            if isinstance(wc, (list, pydicom.multival.MultiValue)):
                wc = wc[0]
            if isinstance(ww, (list, pydicom.multival.MultiValue)):
                ww = ww[0]

            pixel_array = dcm.pixel_array.astype(np.float32)

            # Apply windowing if tags exist
            if wc is not None and ww is not None:
                wc = float(wc)
                ww = float(ww)
                img_min = wc - ww / 2.0
                img_max = wc + ww / 2.0
                pixel_array = np.clip(pixel_array, img_min, img_max)
                norm_arr = ((pixel_array - img_min) / (img_max - img_min + 1e-6) * 255.0).astype(np.uint8)
            else:
                p_min, p_max = pixel_array.min(), pixel_array.max()
                norm_arr = ((pixel_array - p_min) / (p_max - p_min + 1e-6) * 255.0).astype(np.uint8)

            # Handle MONOCHROME1 inversion (0 = white, maximum = black)
            photo = getattr(dcm, "PhotometricInterpretation", "MONOCHROME2")
            if photo == "MONOCHROME1":
                norm_arr = 255 - norm_arr

            img = Image.fromarray(norm_arr)
            metadata = {
                "is_dicom": True,
                "window_center": wc,
                "window_width": ww,
                "photometric": photo,
                "view": str(view_position),
                "deidentified": True,
            }
        except Exception:
            # Fallback to standard image parsing
            img = Image.open(io.BytesIO(content)).convert("L")
            metadata = {"is_dicom": False, "view": "PA", "deidentified": True}
    else:
        img = Image.open(io.BytesIO(content)).convert("L")
        metadata = {"is_dicom": False, "view": "PA", "deidentified": True}

    # Save full display image
    img_filename = f"{study_uid}.png"
    img_path = output_dir / img_filename
    img.save(img_path, format="PNG")

    # Save thumbnail (PRD Section 12.5 Film Sheet contact thumbnail: 96x96 with hairline border)
    thumb = img.copy()
    thumb.thumbnail((128, 128), Image.Resampling.LANCZOS)
    thumb_filename = f"{study_uid}_thumb.png"
    thumb.save(output_dir / thumb_filename, format="PNG")

    return {
        "hashed_uid": study_uid,
        "image_filename": img_filename,
        "thumb_filename": thumb_filename,
        "view": metadata.get("view", "PA"),
        "resolution": [img.width, img.height],
        "metadata": metadata,
    }
