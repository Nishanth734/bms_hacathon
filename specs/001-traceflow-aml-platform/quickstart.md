# Quickstart Validation Guide: TraceFlow AML Investigation Platform

## Prerequisites

- Python 3.11+ installed
- Node.js 20+ and npm installed
- IBM HI-Small CSV dataset downloaded and placed at `data/HI-Small_Trans.csv`

## Setup

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Copy environment template
cp .env.example .env
# Edit .env to set IBM_CSV_PATH and other optional settings
```

## End-to-End Validation

### Step 1: Run the data loader (validates schema + builds graph)
```bash
python -m traceflow.loader --csv data/HI-Small_Trans.csv --out results/transactions.parquet
# Expected: "Loaded N transactions. Schema OK. Node IDs built."
```

### Step 2: Run the threshold baseline
```bash
python scripts/run_pipeline.py --mode baseline --out results/
# Expected: results/baseline_metrics.json with precision, recall, F1, PR-AUC
```

### Step 3: Run the full pipeline (detectors + tracer + ranker)
```bash
python scripts/run_pipeline.py --mode full --out results/
# Expected: results/clusters.parquet with scored clusters
# Expected: results/evidence/*.json with evidence objects
```

### Step 4: Run the ablation
```bash
python scripts/run_ablation.py --out results/ablation.csv
# Expected: results/ablation.csv with 4 rows (methods A, B, C, D)
# Expected: printed table with precision, recall, F1, PR-AUC per method
```

### Step 5: Run pytest
```bash
pytest tests/ -v
# Expected: All tests PASS
# Key tests: test_loader, test_detectors (3 cases each), test_tracer, test_verifier
```

### Step 6: Start the API
```bash
uvicorn api.main:app --reload --port 8000
# Expected: "Application startup complete." on http://localhost:8000
# Test: curl http://localhost:8000/api/health → {"status": "ok"}
# Test: curl http://localhost:8000/api/cases → JSON array
# Test: curl http://localhost:8000/api/metrics → JSON ablation table
```

### Step 7: Start the dashboard
```bash
cd frontend && npm run dev
# Expected: "Local: http://localhost:5173"
# Open browser → ranked case list appears
# Click a case → subgraph renders (Cytoscape.js)
# Click a report sentence → graph edges highlight
```

## Integration Scenarios

### Scenario A: Planted Pattern Detection
```bash
python scripts/inject_patterns.py --type cycle --inject-count 3 --csv data/HI-Small_Trans.csv --out data/HI-Small_Injected.csv
python -m traceflow.detectors.cycle --csv data/HI-Small_Injected.csv
# Expected: All 3 planted cycles found; at least 1 with correct edge IDs
```

### Scenario B: Verifier Blocks Fabricated Account
```python
from traceflow.verifier import Verifier
from traceflow.investigator import build_evidence
evidence = build_evidence("test_cluster")
# Inject a fake account into the report
bad_report = "Account FAKE_ACCOUNT_999 sent $50,000."
result = Verifier().verify(bad_report, evidence)
assert result.verdict == "FAIL"
assert "FAKE_ACCOUNT_999" in result.details
```

### Scenario C: LLM Fallback
```bash
# Start with LLM enabled but unavailable
LLM_ENABLED=true LLM_HOST=http://localhost:9999 python scripts/run_pipeline.py --mode full --case <case_id>
# Expected: LLM connection failure logged; report generated from template; Verifier PASS
```

## Expected Outcomes

| Step | Pass Condition |
|------|---------------|
| Loader | N transactions loaded, schema validated, no null tx_id/ts/src/dst |
| Baseline | ablation.csv row A has non-zero precision, recall, F1 |
| Full pipeline | clusters.parquet has ≥ 1 row with risk_score > 0 |
| Ablation | All 4 rows present; method D F1 ≥ method A F1 |
| pytest | All tests green |
| API /health | {"status": "ok"} |
| API /cases | JSON array, sorted by risk_score descending |
| Dashboard | Subgraph renders with ≤ 30 nodes; hover highlights edges |
