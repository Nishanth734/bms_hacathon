# TraceFlow: Product Requirements Document (PRD)

**Product Name:** TraceFlow  
**Version:** 2.0.0 (Production Forensic Suite)  
**Authors:** Forensic Architecture & Engineering Team  
**Repository:** [https://github.com/Nishanth734/bms_hacathon.git](https://github.com/Nishanth734/bms_hacathon.git)  

---

## 1. Executive Summary

Traditional transaction monitoring engines (rule-based thresholds) produce overwhelming false positive rates ($>90\%$), miss multi-hop laundering chains, and lack temporal causality awareness. Furthermore, standard graph visualization tools collapse under the weight of large transaction graphs, generating unreadable "hairballs."

**TraceFlow** is a time-respecting, graph-native forensic investigation platform engineered specifically for blockchain analysts, financial compliance officers, and NFT marketplace fraud investigators. It combines:
1. **Dynamic Schema Ingestion**: Drag-and-drop CSV parsing supporting both Web3/NFT marketplace sales and traditional banking AML ledgers.
2. **Causal Graph Algorithms**: Strongly Connected Components (SCC), forward time-ordered cycle detection ($t_1 < t_2 < \dots < t_k$), and NFT wash trading detection.
3. **Flow Conservation & Dwell-Time Tracing**: Tracks per-hop dwell times ($d(v) \le 1\text{h}$) and value retention ($\rho(v) \in [0.85, 1.05]$) to expose mule accounts and circular capital recycling.
4. **Bounded Visual Networks**: Enforces a strict $\le 30$ node subgraph cap per case with collision-free, force-directed layouts.
5. **Anti-Hallucination SAR Narrative Generation**: Generates official Suspicious Activity Reports (SAR/STR) with deterministic regex audit verification.

---

## 2. Target Personas & Core User Workflows

### Personas
- **Forensic Blockchain Analyst**: Investigates suspicious NFT collections, artificial floor price pumping, and wash trading rings.
- **AML Compliance Officer**: Triages high-risk wallet clusters, evaluates regulatory exposure, writes and files verified SARs.
- **Marketplace Fraud Lead**: Monitors collection volumes to flag coordinated sybil farming in real-time.

### Primary Workflow
```
[1. Ingest Dataset] ➔ [2. Detect Rings & SCC] ➔ [3. Triage in Cases] ➔ [4. Inspect Network] ➔ [5. Export Verified SAR]
```

---

## 3. Core Functional Requirements (FR)

### Ingestion & Dataset Management
- **FR-01**: Drag-and-drop CSV upload with instant validation preview and row count calculation.
- **FR-02**: Automatic schema inference supporting:
  - **NFT Schema**: `tx_hash`, `timestamp`, `seller_address`, `buyer_address`, `token_id`, `collection_address`, `price_eth`, `currency`.
  - **Banking AML Schema**: `Timestamp`, `From Bank`, `Account`, `To Bank`, `Account.1`, `Amount Paid`, `Payment Currency`, `Is Laundering`.
- **FR-03**: One-click switching between active datasets with persistent database isolation.

### Research Graph Algorithms
- **FR-04 (Strongly Connected Components)**: Computes maximal directed components ($|V| \ge 2$) to isolate closed circular transaction syndicates.
- **FR-05 (NFT Wash Trading Detector)**:
  - Invariants: Same `token_id`, circular buyer/seller re-acquisition within $\Delta T \le 72\text{h}$, net change in economic ownership $= 0$.
- **FR-06 (Temporal Forward Cycles)**:
  - Enforces strict monotonic timestamp sequencing: $t(e_1) < t(e_2) < \dots < t(e_k) \le t(e_1) + \Delta T$.
- **FR-07 (Pass-Through Mule Relays)**:
  - Bounded dwell time: $d(v) = \min \{ t_{\text{out}} - t_{\text{in}} \} \le 1.0\text{ hour}$.
  - Flow conservation: $\rho(v) = \text{OutFlow}(v) / \text{InFlow}(v) \in [0.85, 1.05]$.
- **FR-08 (Risk Scoring Engine)**:
  - Multi-factor risk attribution combining SCC membership, dwell time penalties, and flow retention conservation.

### Analyst Workbench UI (Contra Labs Visual System)
- **FR-09 (Top Horizontal Navigation Bar)**: Clean horizontal header with shortest meaningful tabs:
  `Dashboard`, `Cases`, `Graph`, `Typologies`, `Wallets`, `Datasets`, `Analysis`, `Evidence`.
- **FR-10 (Collision-Free Graph Visualization)**:
  - Cytoscape.js rendering subgraphs strictly bounded to $\le 30$ nodes.
  - Floating pill backgrounds on node labels to prevent visual collision with edges.
  - Responsive **Entity Inspector** displaying live inflows, outflows, risk factors, and transaction histories.
- **FR-11 (Case Management Workspace)**:
  - Status transitions (`NEW`, `UNDER_INVESTIGATION`, `ESCALATED`, `RESOLVED`, `FALSE_POSITIVE`).
  - Priority management (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
  - Editable analyst notes and investigator assignment.
- **FR-12 (Evidence & Anti-Hallucination Reports)**:
  - Plain-language narrative report linked directly to transaction edge IDs.
  - Deterministic fact verifier auditing every cited address and monetary amount.
  - One-click export to official Suspicious Activity Report (`.md` format).

---

## 4. Technical Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Vite + React 19 Frontend            │
│  (Contra Labs Aesthetic: Parchment, Mint, Deep Teal)   │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (port 5173 -> 8000)
┌───────────────────────────▼────────────────────────────┐
│                  FastAPI Backend Server                │
│   ├── /api/datasets     ├── /api/cases                 │
│   ├── /api/analysis     ├── /api/reports               │
│   ├── /api/wallets      ├── /api/metrics               │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
┌─────────────▼──────────┐  ┌─────────────▼──────────────┐
│ SQLite + SQLAlchemy DB │  │    TraceFlow ML Engine     │
│  (traceflow.db)        │  │  - Polars Ingest & Parser  │
│  - Datasets            │  │  - NetworkX Graph Builder  │
│  - Wallets             │  │  - SCC & Cycle Detectors   │
│  - Transactions        │  │  - Dwell / Retention Tracer│
│  - FraudClusters       │  │  - LightGBM Ranker         │
│  - InvestigationCases  │  │  - Anti-Hallucination Fact │
│  - Reports             │  │    Verifier                │
└────────────────────────┘  └────────────────────────────┘
```

---

## 5. Four-Way Ablation Benchmark

Evaluated on an identical chronological test split (60% train / 20% validation / 20% test):

| Method | Precision | Recall | F1 Score | PR-AUC | P@20 | False Alerts / Day |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **A: Amount Threshold Baseline** | 0.0795 | 0.7000 | 0.1429 | 0.6385 | 0.7000 | 57.56 |
| **B: Graph Features + LightGBM** | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.00 |
| **C: Graph + Dwell & Retention** | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.00 |
| **D: TraceFlow (Full System)** | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **0.00** |

---

## 6. Verification & Test Suite

TraceFlow includes 45 comprehensive unit and integration tests passing at 100%:
- Schema parser & auto-detection tests
- Strongly Connected Components (SCC) tests
- NFT Wash Trading detector tests
- Forward time-ordered cycle monotonicity tests
- Rapid pass-through dwell-time tests
- Anti-hallucination fact verifier tests
- End-to-end FastAPI endpoint tests
