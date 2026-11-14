"""Anti-hallucination fact verifier for STR reports."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class VerifierResult:
    verdict: str  # "PASS" or "FAIL"
    details: list[str] = field(default_factory=list)


class Verifier:
    """Verifies that every fact cited in an STR narrative exists in the evidence."""

    def verify(self, report_text: str, evidence: dict[str, Any]) -> VerifierResult:
        details: list[str] = []
        ev_accounts = set(evidence.get("accounts", []))
        ev_edges = evidence.get("edges", [])
        ev_amounts = [float(e["amount"]) for e in ev_edges]

        # 1. Check account mentions:
        # Accounts match pattern word_word or word_digit, e.g. BankA_1001, Bank_1234
        # We search specifically for tokens that resemble account patterns
        account_tokens = set(re.findall(r"\b[A-Za-z0-9]+_[A-Za-z0-9]+\b", report_text))
        for acc in account_tokens:
            if acc not in ev_accounts:
                details.append(f"Unverified account cited in report: '{acc}'")

        # 2. Check dollar amounts:
        # Look for $X,XXX or $XXX.XX or dollar mentions
        amount_matches = re.findall(r"\$([0-9,]+(?:\.[0-9]+)?)", report_text)
        for amt_str in amount_matches:
            try:
                amt_val = float(amt_str.replace(",", ""))
                # Allow amounts to match if close to any evidence amount
                # (also allow trivial small integers or 0)
                if amt_val > 10.0:  # skip trivial amounts like $1 or $5
                    matched = any(abs(amt_val - ea) < 0.05 for ea in ev_amounts)
                    if not matched:
                        details.append(f"Unverified amount cited in report: ${amt_str}")
            except ValueError:
                pass

        verdict = "PASS" if len(details) == 0 else "FAIL"
        return VerifierResult(verdict=verdict, details=details)
