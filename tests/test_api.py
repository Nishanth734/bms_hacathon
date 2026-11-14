"""
Pytest tests for the TraceFlow AML API.

Run from d:\bms with:
    pytest tests/test_api.py -v
"""
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == "1.0.0"
    assert "cases_loaded" in body
    assert isinstance(body["cases_loaded"], int)
    assert body["cases_loaded"] > 0


# ---------------------------------------------------------------------------
# Cases list
# ---------------------------------------------------------------------------

def test_cases_list_default():
    response = client.get("/api/cases")
    assert response.status_code == 200
    body = response.json()
    assert "total" in body
    assert "cases" in body
    assert isinstance(body["total"], int)
    assert isinstance(body["cases"], list)
    assert body["total"] > 0
    # Validate first item shape
    first = body["cases"][0]
    assert "cluster_id" in first
    assert "typology" in first
    assert isinstance(first["typology"], list)
    assert "primary_typology" in first
    assert "risk_score" in first
    assert "size" in first
    assert "duration_hours" in first
    assert "account_count" in first
    assert "edge_count" in first


def test_cases_list_pagination():
    resp_all = client.get("/api/cases?limit=200")
    total = resp_all.json()["total"]

    resp_page = client.get("/api/cases?limit=5&offset=0")
    assert resp_page.status_code == 200
    body = resp_page.json()
    assert len(body["cases"]) == min(5, total)
    assert body["total"] == total

    if total > 5:
        resp_offset = client.get("/api/cases?limit=5&offset=5")
        assert resp_offset.status_code == 200
        ids_page1 = {c["cluster_id"] for c in resp_page.json()["cases"]}
        ids_page2 = {c["cluster_id"] for c in resp_offset.json()["cases"]}
        assert ids_page1.isdisjoint(ids_page2), "Paginated pages should not overlap"


def test_cases_list_typology_filter():
    # Collect all unique typologies first
    all_cases = client.get("/api/cases?limit=200").json()["cases"]
    typologies = {t for c in all_cases for t in c["typology"]}
    assert typologies, "Expected at least one typology"

    # Filter by first available typology
    typo = next(iter(typologies))
    response = client.get(f"/api/cases?typology={typo}")
    assert response.status_code == 200
    body = response.json()
    for case in body["cases"]:
        assert typo in case["typology"], f"Expected typology '{typo}' in {case['typology']}"


def test_cases_list_min_score_filter():
    response = client.get("/api/cases?min_score=0.9&limit=200")
    assert response.status_code == 200
    body = response.json()
    for case in body["cases"]:
        assert case["risk_score"] >= 0.9, (
            f"Expected risk_score >= 0.9, got {case['risk_score']}"
        )


def test_cases_list_sorted_by_risk_score_desc():
    response = client.get("/api/cases?limit=200")
    assert response.status_code == 200
    scores = [c["risk_score"] for c in response.json()["cases"]]
    assert scores == sorted(scores, reverse=True), "Cases should be sorted by risk_score descending"


# ---------------------------------------------------------------------------
# Case detail
# ---------------------------------------------------------------------------

def test_case_detail():
    # Get the first case id from the list endpoint
    cases = client.get("/api/cases?limit=1").json()["cases"]
    assert cases, "Need at least one case to test detail"
    case_id = cases[0]["cluster_id"]

    response = client.get(f"/api/cases/{case_id}")
    assert response.status_code == 200
    body = response.json()

    # Required top-level fields
    assert body["cluster_id"] == case_id
    assert isinstance(body["typology"], list)
    assert isinstance(body["primary_typology"], str)
    assert isinstance(body["risk_score"], float)
    assert "window_start" in body
    assert "window_end" in body
    assert isinstance(body["accounts"], list)
    assert len(body["accounts"]) > 0

    # Graph
    graph = body["graph"]
    assert "nodes" in graph
    assert "edges" in graph
    assert isinstance(graph["nodes"], list)
    assert isinstance(graph["edges"], list)

    if graph["nodes"]:
        node = graph["nodes"][0]
        assert "id" in node
        assert "label" in node
        assert "in_degree" in node
        assert "out_degree" in node
        assert "is_suspicious" in node

    if graph["edges"]:
        edge = graph["edges"][0]
        assert "id" in edge
        assert "source" in edge
        assert "target" in edge
        assert "amount" in edge
        assert "currency" in edge
        assert "ts" in edge

    # STR Report
    report = body["report"]
    assert report["case_id"] == case_id
    assert isinstance(report["template_used"], bool)
    assert isinstance(report["verifier_pass"], bool)
    assert isinstance(report["sentences"], list)

    if report["sentences"]:
        sentence = report["sentences"][0]
        assert "text" in sentence
        assert "edge_ids" in sentence
        assert "sentence_index" in sentence


def test_case_not_found():
    response = client.get("/api/cases/nonexistent_case_xyz_999")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body
    assert "nonexistent_case_xyz_999" in body["detail"]


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def test_metrics():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    body = response.json()
    assert "ablation" in body
    assert isinstance(body["ablation"], list)
    assert len(body["ablation"]) > 0

    for row in body["ablation"]:
        assert "method" in row
        assert "label" in row
        assert "precision" in row
        assert "recall" in row
        assert "f1" in row
        assert "pr_auc" in row
        assert "precision_at_k" in row
        assert "false_alerts_per_day" in row
        # All numeric fields should be floats in [0, inf)
        assert isinstance(row["precision"], float)
        assert isinstance(row["recall"], float)
        assert isinstance(row["f1"], float)
        assert isinstance(row["pr_auc"], float)
        assert isinstance(row["precision_at_k"], float)
        assert isinstance(row["false_alerts_per_day"], float)

    # D_traceflow should have the best f1 among all methods
    methods = {r["method"]: r for r in body["ablation"]}
    if "D_traceflow" in methods and "A_threshold" in methods:
        assert methods["D_traceflow"]["f1"] > methods["A_threshold"]["f1"], (
            "TraceFlow should outperform threshold baseline on F1"
        )
