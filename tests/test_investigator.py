"""Tests for investigator, verifier, and narrator modules."""
import json
from traceflow.investigator import build_evidence
from traceflow.verifier import Verifier
from traceflow.narrator import Narrator

def test_evidence_has_all_keys(sample_cluster, tiny_df, sample_config):
    ev = build_evidence(sample_cluster, tiny_df, sample_config)
    for key in ["cluster_id", "typology", "primary_typology", "risk_score", "window_start", "window_end", "accounts", "edges", "dwell", "retention"]:
        assert key in ev

def test_verifier_pass_correct_report(sample_evidence):
    narrator = Narrator()
    report = narrator.generate(sample_evidence)
    verifier = Verifier()
    full_text = " ".join(s["text"] for s in report["sentences"])
    res = verifier.verify(full_text, sample_evidence)
    assert res.verdict == "PASS"

def test_verifier_fail_fake_account(sample_evidence):
    verifier = Verifier()
    bad_text = "Account UnknownBank_999 transferred $50,000.00 to B2_B."
    res = verifier.verify(bad_text, sample_evidence)
    assert res.verdict == "FAIL"
    assert any("UnknownBank_999" in d for d in res.details)

def test_verifier_fail_wrong_amount(sample_evidence):
    verifier = Verifier()
    bad_text = "Account B1_A transferred $999,999.00 to B2_B."
    res = verifier.verify(bad_text, sample_evidence)
    assert res.verdict == "FAIL"
    assert any("999,999" in d for d in res.details)

def test_narrator_report_sentences_have_edge_ids(sample_evidence):
    narrator = Narrator()
    report = narrator.generate(sample_evidence)
    assert "sentences" in report
    assert len(report["sentences"]) > 0
    # Sentences describe the money trail with edge IDs
    for s in report["sentences"]:
        assert "text" in s
        assert "edge_ids" in s
