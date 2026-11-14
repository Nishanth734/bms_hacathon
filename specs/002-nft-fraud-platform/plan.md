# Implementation Plan: TraceFlow NFT Fraud & AML Platform

## Architecture Strategy

### 1. Unified Backend Architecture (FastAPI + SQLAlchemy + Polars)
- **Database**: SQLite embedded database `data/traceflow.db` via SQLAlchemy, auto-created with migrations/tables on startup.
- **Data Ingestion Engine**:
  - File upload endpoint `/api/datasets/upload` handling CSV files.
  - Automatic Schema Parser (`traceflow/schema_parser.py`):
    - Detects whether the CSV is NFT or banking format based on header signatures.
    - Standardizes records into a unified internal format: `tx_hash`, `timestamp`, `src`, `dst`, `amount`, `currency`, `token_id`, `collection`, `label`.
- **Graph & Fraud Detection Engine**:
  - `traceflow/detectors/wash_trading.py`: Specific NFT wash trading detector identifying circular token sales with monotonic time order, artificial price pumps, and zero economic change.
  - `traceflow/scc.py`: Strongly Connected Components computation on directed temporal graph.
  - `traceflow/detectors/cycle.py`: Forward time-ordered cycle detector ($t_1 < t_2 < \dots$).
  - `traceflow/detectors/pass_through.py`: Mule relay chain detector ($d(v) \le 1\text{h}$, $\rho(v) \in [0.85, 1.0]$).
  - `traceflow/detectors/fan_in_out.py`: Smurfing & dispersion detector.
  - `traceflow/investigator.py`: Evidence object construction.
  - `traceflow/narrator.py` & `traceflow/verifier.py`: Evidence-grounded report generation and deterministic anti-hallucination verification.
- **REST API Endpoints**:
  - `/api/datasets`: List, upload, preview, select active dataset, delete.
  - `/api/analysis`: Trigger analysis job, get status/progress, get summary metrics.
  - `/api/wallets`: Search, filter, get wallet profile, graph neighborhood, risk breakdown.
  - `/api/cases`: List cases, get case detail with bounded $\le 30$ node graph, update status/priority/notes/tags.
  - `/api/reports`: Generate report, verify report, export (markdown/json).
  - `/api/metrics`: 4-way ablation benchmark and typology distribution.

### 2. Frontend Multi-Page Architecture (React + Vite + TypeScript)
- **Contra Labs Visual System**:
  - Warm parchment canvas `#fbfaf6`, ivory cream `#fcfbf7`, charcoal ink `#2b2b29`, mint wash `#c8e1dd`, deep teal `#296a6c`.
  - Serif headers with `Source Serif 4`, clean body copy with `Inter`.
- **Top Navigation & App Router**:
  - Navigation bar with 8 tabs:
    1. **Overview**
    2. **Dataset Management**
    3. **Analysis**
    4. **Wallet Network**
    5. **Fraud Detection**
    6. **Risk Assessment**
    7. **Investigation Cases**
    8. **Evidence & Reports**
  - Dataset selector pill in top header indicating the currently active dataset.
  - Real-time backend connectivity badge.

### 3. Pre-Loaded Realistic Datasets
- `data/NFT_WashTrading_Sample.csv`: Realistic Ethereum NFT dataset containing real and planted wash trading rings, circular floor-price pumping, and legitimate high-volume collector transfers.
- `data/HI-Small_Trans.csv`: IBM AML banking dataset with fan-out, fan-in, cycles, and mule chains.
