# Tasks: TraceFlow NFT Fraud & AML Platform

## Phase 1: Database & Data Model Layer
- [x] T001: Implement SQLAlchemy database models in `api/db_models.py` (Dataset, Wallet, Transaction, FraudCluster, InvestigationCase, InvestigationReport).
- [x] T002: Implement SQLite database connection, session management, and table auto-initialization in `api/database.py`.

## Phase 2: Schema Parser & Data Ingestion
- [x] T003: Implement unified schema parser in `traceflow/schema_parser.py` (auto-detects NFT vs Banking CSV schemas, standardizes columns).
- [x] T004: Create realistic sample NFT dataset `data/NFT_WashTrading_Sample.csv` with circular wash trading, price manipulation, and mule transfers.
- [x] T005: Implement dataset management API endpoints in `api/routers/datasets.py` (upload with file preview, listing, selection, deletion).

## Phase 3: Research Algorithms & Fraud Detectors
- [x] T006: Implement Strongly Connected Components (SCC) analysis in `traceflow/scc.py`.
- [x] T007: Implement specialized NFT wash trading detector in `traceflow/detectors/wash_trading.py`.
- [x] T008: Integrate wash trading, SCC, cycles, dwell time, and retention into the unified pipeline runner in `traceflow/pipeline_runner.py`.
- [x] T009: Implement background analysis runner with progress tracking in `api/routers/analysis.py`.

## Phase 4: Wallets, Cases & Investigation APIs
- [x] T010: Implement wallet search, detail, and risk assessment API endpoints in `api/routers/wallets.py`.
- [x] T011: Upgrade case investigation API in `api/routers/cases.py` to support status updates, analyst notes, and tags.
- [x] T012: Implement report generation and verification API in `api/routers/reports.py`.

## Phase 5: Multi-Page Frontend with Contra Labs Design System
- [x] T013: Update TypeScript models in `frontend/src/types/index.ts` to support all 8 pages, datasets, wallets, cases, and analysis state.
- [x] T014: Implement API service client in `frontend/src/services/api.ts` for all backend endpoints.
- [x] T015: Build navigation header with active dataset selector and page tabs in `frontend/src/components/Navbar.tsx`.
- [x] T016: Build Page 1: `Overview.tsx` (Executive summary, network volume, active fraud rings, methodology explanation).
- [x] T017: Build Page 2: `DatasetManagement.tsx` (Drag-and-drop CSV upload, table preview, schema detection, dataset selector).
- [x] T018: Build Page 3: `AnalysisRunner.tsx` (Configurable parameters, step-by-step progress tracker, execution logs).
- [x] T019: Build Page 4: `WalletNetwork.tsx` (Interactive Cytoscape wallet graph, cycle highlighting, wallet inspector).
- [x] T020: Build Page 5: `FraudDetection.tsx` (Typology deep-dive: Wash Trading, Cycles, Mule Relay, Fan-Out with mathematical formulas and flagged clusters).
- [x] T021: Build Page 6: `RiskAssessment.tsx` (Wallet risk rankings, factor weights, transaction-level citations).
- [x] T022: Build Page 7: `InvestigationCases.tsx` (Case triage, priority, status workflow, analyst notes).
- [x] T023: Build Page 8: `EvidenceReports.tsx` (Verified STR narrative, anti-hallucination verification audit, export options).
- [x] T024: Connect all pages in `frontend/src/App.tsx`.

## Phase 6: Automated Testing & End-to-End Verification
- [x] T025: Add comprehensive unit tests in `tests/` for schema parser, SCC, wash trading detector, and new API routes.
- [x] T026: Run full test suite with pytest and ensure 100% pass rate.
- [x] T027: Test frontend build with `npm run build`.
- [x] T028: Live end-to-end verification via browser subagent.
