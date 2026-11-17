# Design System: "The Reading Room, Not the Dashboard"

## 1. Visual Metaphor
Radiologists work in dim rooms, examining radiographs on calibrated high-luminance diagnostic monitors. Bright dashboards wash out contrast and fatigue the eye. The CXR Triage design system embraces **reading-room software**: near-black background, hairline geometric rules, instrument-like typography, and color reserved strictly for clinical meaning.

## 2. Color Palette Tokens

| Token | Hex | Role |
|---|---|---|
| `--bg-0` | `#0B0E11` | Application background (near-black with cool cast) |
| `--bg-1` | `#12171B` | Surface panels & toolbars |
| `--bg-2` | `#1A2127` | Raised table rows & active hover |
| `--line` | `#26303A` | Hairline technical rules (1px) |
| `--text-0` | `#E6EBEF` | Primary high-contrast technical text |
| `--text-1` | `#9AA7B2` | Secondary technical labels |
| `--text-2` | `#66727D` | Annotations & tertiary metadata |
| `--film` | `#C9D4DB` | X-ray film highlights |
| `--critical` | `#FF4D4F` | Critical clinical urgency (Pneumothorax, tension) |
| `--urgent` | `#F2A33A` | Urgent clinical finding (Consolidation, acute edema) |
| `--routine` | `#4FB3A5` | Routine / normal finding (Cardiomegaly, atelectasis) |
| `--review` | `#8E9AF0` | Low-confidence / needs human read |

### Grad-CAM++ Color Ramp
`#1B2A6B` (deep blue) → `#E04B3A` (fiery red) → `#FFD84D` (yellow peak). Used exclusively on radiograph heatmaps.

## 3. Typography
- **Headings & Controls:** *IBM Plex Sans* (sober, clean, medical-grade).
- **Data, Measures, Intervals, Probabilities:** *IBM Plex Mono* with tabular figures (`tnum`, `lnum`).
- **Scale:** 10 / 11 / 12 / 13 / 14 / 18 / 24 / 28px.

## 4. Signature Elements
1. **DICOM Corner Annotations:** Patient privacy hash top-left, study metadata top-right, W/L + zoom bottom-left, model version bottom-right.
2. **Triage Rail:** Left-edge color strip with glyphs (▲ Critical, ◆ Urgent, ● Routine, ◌ Low-confidence).
3. **Probability Gauge with Uncertainty Whisker:** Horizontal line with threshold tick, calibrated likelihood dot, and 95% predictive interval bar.
4. **SLA Clock Rings:** Depleting countdown circular gauge for Critical (15 min) and Urgent (60 min) cases.
5. **Film Sheet Contact Thumbnails:** Grayscale contact sheet frames with subtle frame index.
