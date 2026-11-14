# TraceFlow: Forensic Anti-Money Laundering & Fraud Investigation Platform

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![LightGBM](https://img.shields.io/badge/LightGBM-4.5+-brightgreen.svg)](https://lightgbm.readthedocs.io/)
[![Tests](https://img.shields.io/badge/tests-66%20passed-success.svg)]()

> **TraceFlow** is a time-respecting, graph-native forensic intelligence platform engineered for Tier-1 AML analysts, compliance officers, and blockchain investigators. It uncovers coordinated wash trading rings, forward-time cyclic round-tripping, and rapid mule relays with verifiable transaction evidence, an automated safety gate, and a continuous human-approved learning loop.

---

## 🌟 Core Novelty & Technical Contributions

TraceFlow departs fundamentally from traditional rule engines, static graph query tools, and hallucination-prone generative AI workflows through five architectural innovations:

### 1. Causal Time-Monotonic Graph Traversal (vs. Static Graph Loops)
- **The Problem**: Conventional graph databases (Neo4j, NetworkX) detect cycles statically: if $A \to B$, $B \to C$, and $C \to A$ exist at *any* point in history, the loop is flagged. In high-volume financial networks, this floods investigators with benign commercial loops.
- **TraceFlow Novelty**: TraceFlow enforces strict causal monotonicity:
  $$\Delta T_{\text{cycle}} = t(e_k) - t(e_1) \le 24.0\text{ hours} \quad \text{where} \quad t(e_1) < t(e_2) < \dots < t(e_k)$$
  Transfers must occur strictly in temporal sequence within a sliding window. Any out-of-order transaction automatically invalidates the candidate laundering cycle.

### 2. Dual Flow Pacing & Dwell-Time Forensic Signatures
- **The Problem**: Simple thresholding (e.g. flagging any transaction over \$10,000) yields 98%+ false positive rates.
- **TraceFlow Novelty**: TraceFlow isolates **Mule Pass-Through Relays** using physical transit invariants:
  - **Dwell Time Pacing**: Intermediaries hold capital for minimal durations before forwarding:
    $$d(v) = \min (t_{\text{out}} - t_{\text{in}}) \le 1.0\text{ hour}$$
  - **Flow Conservation Ratio**: Measures near-exact principal preservation across relay hops:
    $$\rho(v) = \frac{\text{OutFlow}(v)}{\text{InFlow}(v)} \in [0.85, 1.05]$$
  This separates legitimate merchants (who accumulate savings or pay overhead) from disposable layering conduits.

### 3. Continuous Human-in-the-Loop "Learning Loop" Model
TraceFlow features a self-improving forensic ML architecture that adapts as new laundering schemes emerge, governed by automated safety constraints:

```
┌─────────────────┐      Confirm/Reject/Unsure      ┌───────────────────────────┐
│   Tier-1 AML    ├────────────────────────────────►│ Human-Approved Case Store │
│ Analyst Console │                                 │   (case_store.parquet)    │
└────────▲────────┘                                 └─────────────┬─────────────┘
         │                                                        │ Approved Rows
         │ Rescores All Cases                                     │ (Sample Weight ≤ 20%)
┌────────┴────────┐      Safety Gate Pass (≤ 0.01)  ┌─────────────▼─────────────┐
│ Production Model│◄────────────────────────────────┤   LightGBM Retrainer      │
│  (ranker_vN)    │                                 │ (models/versions/ranker)  │
└─────────────────┘                                 └─────────────▲─────────────┘
                                                                  │
                                                    Frozen Validation Split
                                                       (splits.json)
```

- **Controlled Analyst Feedback & Case Store**:
  Analyst decisions (`Confirm` = 1, `Reject` = 0, `Unsure` = Priority Review) and newly caught laundering incident reports are ingested into `data/case_store.parquet` with complete audit tracking in `data/case_store_log.csv`.
- **Base Ledger Immutability via Offset Partitioning**:
  External incident transactions receive synthetic offset IDs ($tx\_id \ge 10,000,000,000$) in `data/incident_edges.parquet`, ensuring the base historical financial ledger is byte-identical and immutable.
- **Sample Weight Capping**:
  Approved cases are given higher sample weights ($5.0\times$), but their cumulative weight is mathematically capped at $\le 20\%$ of total training weight share ($\text{share} \le 0.20$), preventing catastrophic forgetting of historical patterns.
- **The Automated Safety Gate**:
  Autonomous models can degrade or overfit. TraceFlow evaluates every retrained candidate against a **chronologically frozen validation split**:
  $$\text{PR-AUC}_{\text{candidate}} \ge \text{PR-AUC}_{\text{current}} - 0.01 \quad \land \quad \text{F1}_{\text{candidate}} \ge \text{F1}_{\text{current}} - 0.01$$
  - If the gate **passes**, the model is atomically promoted (`models/ranker.txt`), versioned in `models/registry.json`, and immediately re-scores `data/scores.parquet`.
  - If the gate **fails**, the candidate is blocked, production remains untouched, and the failure is logged.
- **Zero-Downtime Rollback**:
  Investigators can roll back to any past version in one click (`POST /api/models/rollback`), instantly re-scoring all clusters across the active database.
- **Uncertainty Review Queue**:
  Prioritizes edge cases where model uncertainty is highest ($|\text{score} - 0.5|$) and prepends any case marked "Unsure" for senior review.

### 4. Zero-Hallucination Anti-Fact Grounding Verifier
- **The Problem**: LLM-based STR/SAR narrative generators hallucinate entity accounts, transaction counts, and dollar amounts.
- **TraceFlow Novelty**: An automated verifier acts as a deterministic barrier between model output and analyst filing:
  - Every sentence maps directly to verifiable edge IDs (`edge_ids: [...]`).
  - Extracted intelligence parses accounts and amounts and cross-references source text. Any entity or dollar figure not present in the source text is rejected (`ValueError: Anti-hallucination rejection`).

### 5. Dynamic Multi-Schema Ingestion & End-to-End Reactive Workbench
- Automatically detects and normalizes divergent schemas:
  - **Web3 / NFT Logs**: `tx_hash`, `seller_address`, `buyer_address`, `token_id`, `price_eth`.
  - **Banking Ledgers**: `Timestamp`, `From Bank`, `Account`, `To Bank`, `Account.1`, `Amount Paid`.
- Uploading a dataset triggers an instant reactive workflow: schema validation $\to$ graph decomposition $\to$ SCC cycle discovery $\to$ LightGBM inference $\to$ case queue synchronization without manual server restarts.

---

## 🏛 System Architecture

```
                    ┌─────────────────────────────────────────┐
                    │          Web / UI Dashboard             │
                    │  (React 19 + TypeScript + Vite + SVG)   │
                    └────────────────────▲────────────────────┘
                                         │ REST API
                    ┌────────────────────▼────────────────────┐
                    │             FastAPI Backend             │
                    │      (api/main.py, api/routers/)        │
                    └──────┬─────────────┬─────────────┬──────┘
                           │             │             │
        ┌──────────────────▼──┐   ┌──────▼──────┐   ┌──▼──────────────────┐
        │ Schema Ingestion &  │   │  Graph &    │   │  Learning Loop &    │
        │ Normalization       │   │  Detectors  │   │  Model Registry     │
        │ (schema_parser.py)  │   │ (tracer.py) │   │ (learning/retrain)  │
        └─────────────────────┘   └─────────────┘   └─────────────────────┘
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python 3.11**
- **Node.js 18+** & **npm**
- **Git**

### Step 1: Clone Repository
```bash
git clone https://github.com/Nishanth734/traceflow_final.git
cd traceflow_final
```

### Step 2: Set Up Backend
```bash
# Create and activate Python virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Set Up Frontend
```bash
cd frontend
npm install
cd ..
```

### Step 4: Run Services

#### Terminal 1 — Start FastAPI Server
```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Documentation & Swagger UI: **[http://localhost:8000/docs](http://localhost:8000/docs)**
- Health Check: **[http://localhost:8000/api/health](http://localhost:8000/api/health)**

#### Terminal 2 — Start Frontend Dashboard
```bash
cd frontend
npm run dev
```
- Analyst Workbench: **[http://localhost:5173](http://localhost:5173)**

---

## 🧪 Comprehensive Automated Testing

The platform includes **66 comprehensive unit and integration tests** covering all pipelines:
```bash
# Run all tests
pytest tests/ -v
```

### Test Suite Breakdown:
- `tests/test_learning_retrain.py`: Safety gate passing, adversarial candidate rejection, 20% sample weight capping, model rollback & rescoring.
- `tests/test_learning_incident.py`: Non-colliding transaction offset IDs, immutable base ledger validation, anti-hallucination verification.
- `tests/test_learning_store.py`: Feedback recording, uncertainty queue prioritization, audit logging.
- `tests/test_upload_workflow_e2e.py`: Dynamic CSV uploads, column alias normalization, duplicate handling.
- `tests/test_detectors.py` & `tests/test_tracer.py`: Causal time monotonicity, dwell time, flow retention.
- `tests/test_investigator.py`: Anti-hallucination report sentence grounding.

---

## 🔬 Learning Loop & Safety Gate Demo Script

Run the standalone 5-step learning loop evaluation:
```bash
python scripts/demo_learning.py
```
This script automatically executes:
1. **Plants** a new rapid pass-through mule pattern and computes its initial baseline risk score.
2. **Ingests** the incident as pending and simulates supervisor approval.
3. **Retrains** candidate model with sample weights capped at 20% and evaluates on frozen validation.
4. **Verifies** candidate passes safety gate, promotes to active ranker, and confirms the planted pattern score increases.
5. **Simulates** an adversarial candidate and verifies the safety gate **blocks** deployment, preserving the production model.
6. **Logs** quantitative audit metrics to `data/learning_results.csv` and `CLAIMS_LOG.md`.

---

## 📂 Project Directory Structure

```
├── api/                        # FastAPI application
│   ├── main.py                 # App entrypoint and lifecycle
│   ├── routers/                # REST endpoints
│   │   ├── cases.py            # Case queues and details
│   │   ├── datasets.py         # Dynamic CSV upload and ingestion
│   │   ├── learning.py         # Feedback, retraining, rollback & incidents
│   │   ├── analysis.py         # Parametric pipeline execution
│   │   ├── metrics.py          # 4-way ablation benchmark
│   │   └── reports.py          # STR narrative generation
├── data/                       # Parquet stores, logs, and sample CSVs
│   ├── case_store.parquet      # Human-approved cases
│   ├── scores.parquet          # Active cluster scores and rankings
│   ├── retrain_log.csv         # Audit trail of retraining runs
│   ├── NFT_WashTrading_Sample.csv
│   └── HI-Small_Trans.csv
├── frontend/                   # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Overview.tsx           # High-level forensic telemetry
│   │   │   ├── InvestigationCases.tsx # Case review & Model Feedback buttons
│   │   │   ├── LearningDashboard.tsx  # Retraining, model history & intake
│   │   │   ├── FraudDetection.tsx     # Typology criteria & signatures
│   │   │   ├── DatasetManagement.tsx  # Drag-and-drop CSV upload
│   │   │   ├── AnalysisRunner.tsx     # Hyperparameter tuning & progress
│   │   │   └── WalletNetwork.tsx      # Interactive force-directed graph
│   │   └── services/api.ts            # Typed client API layer
├── models/                     # Production models and registry
│   ├── ranker.txt              # Active LightGBM production weights
│   ├── registry.json           # Model lineage and gate history
│   └── versions/               # Archived versioned models (ranker_vN.txt)
├── scripts/                    # Automation & pipeline runners
│   ├── demo_learning.py        # 5-step Learning Loop demo & gate validation
│   ├── run_pipeline.py         # CLI batch pipeline runner (--with-learning)
│   └── inject_patterns.py      # Ground-truth synthetic pattern generator
├── traceflow/                  # Core Python ML & Graph Engine
│   ├── learning/               # Learning Loop engine
│   │   ├── case_store.py       # Feedback store and uncertainty queue
│   │   ├── incident.py         # Incident intake and anti-hallucination parser
│   │   └── retrain.py          # Retraining engine & safety gate evaluation
│   ├── detectors.py            # SCC, cycle, pass-through, fan-out detectors
│   ├── ranker.py               # LightGBM classifier with sample weighting
│   ├── tracer.py               # Time-respecting multi-hop causal tracer
│   └── schema_parser.py        # Intelligent CSV header mapping
├── tests/                      # 66 comprehensive pytest test suites
├── config.yaml                 # System & learning loop configuration
├── CLAIMS_LOG.md               # Empirical claims and verification evidence
├── CONTRACTS.md                # Strict REST API contracts and schemas
└── PRD.md                      # Product Requirements Document
```

---

## 📜 License & Compliance Notice

This software is developed strictly for anti-money laundering compliance, illicit finance detection, and forensic intelligence research. Synthetic datasets provided within this repository contain randomized, non-personally identifiable mock transactions.
