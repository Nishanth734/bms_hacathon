"""Priority Engine Module per PRD Section 5.5.
Transparent, rule-based clinical prioritization:
  - Maps calibrated probabilities to Priority Tiers (Critical, Urgent, Routine, Low-confidence)
  - Computes composite Priority Score (0 - 100)
  - Applies clinical context modifiers (SpO2, fever, age)
  - Generates transparent, human-readable clinical explanation strings
  - Enforces explicit abstention rules (quality failure, OOD, high uncertainty)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
import yaml

DEFAULT_RULES_PATH = Path(__file__).resolve().parents[2] / "priority_rules.yaml"


class PriorityEngine:
    def __init__(self, config_path: Path | str | None = None):
        path = Path(config_path) if config_path else DEFAULT_RULES_PATH
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                self.config = yaml.safe_load(f)
        else:
            self.config = self._fallback_config()

    def _fallback_config(self) -> dict:
        return {
            "critical_findings": {
                "pneumothorax": {"critical": 0.60, "urgent": 0.35, "weight": 1.0},
                "pleural_effusion": {"critical": 0.85, "urgent": 0.55, "weight": 0.95},
            },
            "urgent_findings": {
                "consolidation": {"urgent": 0.50, "weight": 0.80},
                "edema": {"urgent": 0.55, "weight": 0.85},
            },
            "routine_findings": {
                "cardiomegaly": {"routine": 0.50, "weight": 0.50},
                "atelectasis": {"routine": 0.50, "weight": 0.45},
                "lung_opacity": {"routine": 0.50, "weight": 0.40},
            },
            "context_modifiers": {
                "spo2_lt_92_tier_bump": 1,
                "age_gt_65_consolidation_score": 10,
                "fever_consolidation_score": 10,
            },
            "uncertainty_bounds": {
                "lower": 0.35,
                "upper": 0.65,
                "max_variance_for_abstain": 0.08,
            },
        }

    def evaluate(
        self,
        findings_prob: dict[str, float],
        findings_interval: dict[str, tuple[float, float]] | None = None,
        uncertainty_variance: dict[str, float] | None = None,
        quality_passed: bool = True,
        quality_reasons: list[str] | None = None,
        is_ood: bool = False,
        clinical_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Evaluates findings and context to output tier, score, and explanations."""
        explanations: list[str] = []
        findings_interval = findings_interval or {}
        uncertainty_variance = uncertainty_variance or {}
        context = clinical_context or {}

        # 1. Check Abstention Criteria First (Safety rule)
        if not quality_passed:
            q_msg = "; ".join(quality_reasons) if quality_reasons else "Quality check failed"
            return {
                "priority_tier": "Low-confidence",
                "priority_score": 45.0,
                "explanations": [f"Needs human read: {q_msg}"],
                "abstained": True,
                "abstain_reason": "quality_fail",
            }

        if is_ood:
            return {
                "priority_tier": "Low-confidence",
                "priority_score": 50.0,
                "explanations": ["Needs human read: Image is out-of-distribution (features deviate from reference chest radiographs)."],
                "abstained": True,
                "abstain_reason": "ood",
            }

        # Check for high uncertainty in borderline probability regime
        u_cfg = self.config.get("uncertainty_bounds", {})
        u_lower = u_cfg.get("lower", 0.35)
        u_upper = u_cfg.get("upper", 0.65)
        max_var = u_cfg.get("max_variance_for_abstain", 0.08)

        for f_name, prob in findings_prob.items():
            f_norm = f_name.lower().replace(" ", "_")
            var = uncertainty_variance.get(f_name, 0.0)
            if u_lower <= prob <= u_upper and var > max_var:
                interval = findings_interval.get(f_name, (prob - 0.15, prob + 0.15))
                return {
                    "priority_tier": "Low-confidence",
                    "priority_score": 55.0,
                    "explanations": [
                        f"Needs human read: {f_name} likelihood {prob:.2f} has high uncertainty ({interval[0]:.2f} to {interval[1]:.2f}) near clinical decision threshold."
                    ],
                    "abstained": True,
                    "abstain_reason": "high_uncertainty_near_threshold",
                }

        # 2. Base Tier and Score Calculation
        tier = "Routine"
        base_score = 10.0  # baseline routine score

        # Normalize finding keys for lookup
        norm_probs = {k.lower().replace(" ", "_"): (k, v) for k, v in findings_prob.items()}

        crit_cfg = self.config.get("critical_findings", {})
        urg_cfg = self.config.get("urgent_findings", {})
        rout_cfg = self.config.get("routine_findings", {})

        # Evaluate Critical Findings
        for f_key, cfg in crit_cfg.items():
            if f_key in norm_probs:
                orig_name, prob = norm_probs[f_key]
                crit_thresh = cfg.get("critical", 0.60)
                urg_thresh = cfg.get("urgent", 0.35)
                interval = findings_interval.get(orig_name, (max(0.0, prob - 0.05), min(1.0, prob + 0.05)))

                if prob >= crit_thresh:
                    tier = "Critical"
                    score_cand = 80.0 + (prob - crit_thresh) / (1.0 - crit_thresh + 1e-6) * 20.0
                    base_score = max(base_score, score_cand)
                    explanations.append(
                        f"{orig_name} likelihood {prob:.2f} (interval {interval[0]:.2f} to {interval[1]:.2f}) above critical threshold {crit_thresh:.2f}"
                    )
                elif prob >= urg_thresh and tier != "Critical":
                    tier = "Urgent"
                    score_cand = 60.0 + (prob - urg_thresh) / (crit_thresh - urg_thresh + 1e-6) * 19.0
                    base_score = max(base_score, score_cand)
                    explanations.append(
                        f"{orig_name} likelihood {prob:.2f} (interval {interval[0]:.2f} to {interval[1]:.2f}) above urgent threshold {urg_thresh:.2f}"
                    )

        # Evaluate Urgent Findings
        for f_key, cfg in urg_cfg.items():
            if f_key in norm_probs:
                orig_name, prob = norm_probs[f_key]
                urg_thresh = cfg.get("urgent", 0.50)
                interval = findings_interval.get(orig_name, (max(0.0, prob - 0.05), min(1.0, prob + 0.05)))

                if prob >= urg_thresh and tier != "Critical":
                    tier = "Urgent"
                    score_cand = 60.0 + (prob - urg_thresh) / (1.0 - urg_thresh + 1e-6) * 19.0
                    base_score = max(base_score, score_cand)
                    explanations.append(
                        f"{orig_name} likelihood {prob:.2f} (interval {interval[0]:.2f} to {interval[1]:.2f}) above urgent threshold {urg_thresh:.2f}"
                    )

        # Evaluate Routine Findings
        for f_key, cfg in rout_cfg.items():
            if f_key in norm_probs:
                orig_name, prob = norm_probs[f_key]
                rout_thresh = cfg.get("routine", 0.50)
                if prob >= rout_thresh:
                    score_cand = 20.0 + prob * 35.0
                    base_score = max(base_score, score_cand)
                    if tier == "Routine":
                        explanations.append(f"{orig_name} likelihood {prob:.2f} noted (routine)")

        # 3. Clinical Context Modifiers
        final_score = base_score
        spo2 = context.get("spo2")
        age = context.get("age")
        temp = context.get("temp")

        has_consolidation = False
        if "consolidation" in norm_probs:
            has_consolidation = norm_probs["consolidation"][1] >= 0.35

        # SpO2 < 92% Tier Promotion
        if spo2 is not None and float(spo2) < 92.0:
            final_score = min(100.0, final_score + 15.0)
            if tier == "Urgent":
                tier = "Critical"
                explanations.append(f"Clinical context: SpO2 {spo2}% < 92% promotes tier to Critical")
            elif tier == "Routine":
                tier = "Urgent"
                explanations.append(f"Clinical context: SpO2 {spo2}% < 92% promotes tier to Urgent")
            else:
                explanations.append(f"Clinical context: SpO2 {spo2}% < 92% confirms Critical urgency (+15 score)")

        # Age > 65 with Consolidation
        if age is not None and int(age) > 65 and has_consolidation:
            final_score = min(100.0, final_score + 10.0)
            explanations.append("Clinical context: Age > 65 with consolidation suspected (+10 score)")

        # Fever (>= 38.0 C) with Consolidation
        if temp is not None and float(temp) >= 38.0 and has_consolidation:
            final_score = min(100.0, final_score + 10.0)
            explanations.append(f"Clinical context: Fever ({temp}°C) with consolidation suspected (+10 score)")

        if not explanations:
            explanations.append("No acute findings exceeding prioritization thresholds. Routine read.")

        return {
            "priority_tier": tier,
            "priority_score": round(float(final_score), 1),
            "explanations": explanations,
            "abstained": False,
            "abstain_reason": None,
        }
