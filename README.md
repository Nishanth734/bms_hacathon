# TraceFlow: Forensic Fraud & AML Investigation Suite

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/tests-45%20passed-success.svg)]()

> **TraceFlow** is a time-respecting, graph-native forensic investigation platform engineered for blockchain analysts, financial compliance officers, and NFT marketplace fraud investigators. It uncovers coordinated wash trading, circular round-tripping, and rapid mule relays on temporal wallet graphs with zero hallucinations.

---

## 1. Key Capabilities

- **Automatic Schema Inference**: Ingests both Web3/NFT transaction CSVs (`seller`, `buyer`, `token_id`, `price_eth`) and traditional banking AML ledgers (`From Bank`, `Account`, `To Bank`, `Amount Paid`).
- **Research Graph Algorithms**:
  - **Strongly Connected Components (SCC)**: Detects closed multi-wallet transactional syndicates.
  - **NFT Wash Trading Detector**: Pinpoints same-token round-trip loops with zero beneficial ownership change.
  - **Temporal Forward Cycles**: Enforces causal monotonicity ($t_1 < t_2 < \dots < t_k \le t_1 + \Delta T$).
  - **Mule Relays & Dwell Time**: Flags pass-throughs holding funds for $\le 1\text{ hour}$ with near-exact flow retention ($\rho \in [0.85, 1.05]$).
- **Collision-Free Graph Visualization**: Subgraphs strictly capped at $\le 30$ nodes with force-directed layouts and floating badge labels.
- **Anti-Hallucination SAR Generator**: Automated fact-checking verifier cross-audits every cited wallet address and monetary amount against the underlying graph before filing.
- **Minimalist Contra Labs Aesthetic**: Editorial serif typography (`Source Serif 4`), parchment tones (`#fbfaf6`), and sage-mint accents (`#c8e1dd`).

---

## 2. Quickstart for Teammates

### Prerequisites
- **Python 3.11**
- **Node.js 18+** & **npm**
- **Git**

### Step 1: Clone Repository & Set Up Backend
```bash
git clone https://github.com/Nishanth734/bms_hacathon.git
cd bms_hacathon

# Create and activate Python virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Step 2: Set Up Frontend
```bash
cd frontend
npm install
cd ..
```

### Step 3: Run the Services

#### Option A: Terminal 1 — Start FastAPI Backend Server
```bash
# From repository root
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation & Swagger UI: **[http://localhost:8000/docs](http://localhost:8000/docs)**

#### Option B: Terminal 2 — Start Vite React Frontend
```bash
cd frontend
npm run dev
```
Analyst Workbench: **[http://localhost:5173](http://localhost:5173)**

---

## 3. Running Automated Tests

To run the complete 45-test test suite:
```bash
pytest tests/ -v
```

To run the frontend production build:
```bash
cd frontend
npm run build
```

---

## 4. Documentation & Resources

- **[PRD.md](PRD.md)**: Complete Product Requirements Document, user personas, and mathematical invariants.
- **[specs/002-nft-fraud-platform/](specs/002-nft-fraud-platform/)**: GitHub Spec Kit specification, architectural plan, data model, and task checklist.
- **Pre-Loaded Sample Datasets**:
  - `data/NFT_WashTrading_Sample.csv`: Realistic Ethereum NFT sales with planted wash trading rings.
  - `data/HI-Small_Trans.csv`: Synthetic banking AML dataset with structuring and cycles.
