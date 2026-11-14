"""Narrator module: generates evidence-linked, verified STR reports."""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

from traceflow.verifier import Verifier

logger = logging.getLogger(__name__)


class Narrator:
    """Generates plain-language STR narratives with hover-to-edge tags and verification."""

    def __init__(self, template_dir: str | None = None):
        if template_dir is None:
            template_dir = str(Path(__file__).parent / "templates")
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.verifier = Verifier()

    def generate(self, evidence: dict[str, Any], use_llm: bool = False) -> dict[str, Any]:
        """Generate verified STR report."""
        template_report = self._fill_template(evidence)

        # Verification check
        full_text = " ".join(s["text"] for s in template_report["sentences"])
        verif_res = self.verifier.verify(full_text, evidence)

        template_report["verifier_pass"] = (verif_res.verdict == "PASS")
        template_report["verifier_details"] = verif_res.details

        if use_llm and os.getenv("LLM_ENABLED", "false").lower() == "true":
            # Attempt LLM polish if configured
            try:
                llm_report = self._llm_rephrase(template_report, evidence)
                llm_text = " ".join(s["text"] for s in llm_report["sentences"])
                llm_verif = self.verifier.verify(llm_text, evidence)
                if llm_verif.verdict == "PASS":
                    llm_report["verifier_pass"] = True
                    llm_report["verifier_details"] = []
                    return llm_report
                else:
                    logger.warning("LLM draft failed verification: %s. Falling back to template.", llm_verif.details)
            except Exception as e:
                logger.warning("LLM rephrasing failed: %s. Using template report.", e)

        return template_report

    def _fill_template(self, evidence: dict[str, Any]) -> dict[str, Any]:
        template = self.env.get_template("str_report.j2")
        rendered = template.render(**evidence)

        sentences = []
        pattern = r"##SENTENCE:(.*?)##\s*(.*?)\s*##END##"
        matches = re.findall(pattern, rendered, re.DOTALL)

        for idx, (edge_ids_str, text) in enumerate(matches):
            e_ids = [e.strip() for e in edge_ids_str.split(",") if e.strip()]
            sentences.append({
                "text": text.strip(),
                "edge_ids": e_ids,
                "sentence_index": idx,
            })

        # Fallback if no tags found
        if not sentences:
            sentences = [{
                "text": rendered.strip(),
                "edge_ids": [e["edge_id"] for e in evidence.get("edges", [])],
                "sentence_index": 0,
            }]

        return {
            "case_id": evidence.get("cluster_id", ""),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "template_used": True,
            "verifier_pass": True,
            "verifier_details": [],
            "sentences": sentences,
        }

    def _llm_rephrase(self, draft: dict[str, Any], evidence: dict[str, Any]) -> dict[str, Any]:
        # Optional local model calling stub (safe fallback built-in)
        return draft
