# Tasks: TraceFlow AML Investigation Platform

**Input**: Design documents from `/specs/001-traceflow-aml-platform/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story?] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, directory structure, environment, and tooling

- [x] T001 Create full project directory structure per plan.md (traceflow/, api/, frontend/, tests/, scripts/, results/, data/, models/)
- [x] T002 Create `requirements.txt` with all Python dependencies: polars, networkx, lightgbm, scikit-learn, fastapi, uvicorn, pydantic, jinja2, numba, duckdb, pyarrow, shap, pytest, python-dotenv, httpx
- [x] T003 Create `pyproject.toml` with package metadata and tool configuration (pytest, black, ruff)
- [x] T004 [P] Create `.env.example` with IBM_CSV_PATH, LLM_ENABLED, LLM_HOST, LLM_MODEL, API_PORT, LOG_LEVEL
- [x] T005 [P] Create `.gitignore` covering Python, Node, data/, models/, results/, .env
- [x] T006 Create `traceflow/config.py` with all configurable parameters: TIME_WINDOW_HOURS=24, FAN_IN_OUT_MIN_COUNTERPARTIES=5, CYCLE_MIN_LENGTH=3, CYCLE_MAX_LENGTH=5, PASS_THROUGH_MIN_HOPS=3, PASS_THROUGH_MAX_DWELL_HOURS=1.0, RETENTION_BAND_LOW=0.85, RETENTION_BAND_HIGH=1.0, CLUSTER_SIZE_CAP=30, CLUSTER_LABEL_ILLICIT_THRESHOLD=0.5, TRAIN_SPLIT=0.6, VAL_SPLIT=0.2, TEST_SPLIT=0.2, AMOUNT_THRESHOLD_BASELINE=10000.0, PRECISION_AT_K=20, IBM_CSV_PATH, RESULTS_DIR, MODELS_DIR
- [x] T007 [P] Initialize frontend: `cd frontend && npm create vite@latest . -- --template react-ts` and install dependencies: cytoscape, react-cytoscapejs, plotly.js, react-plotly.js, @types/react-cytoscapejs, tailwindcss, @tailwindcss/vite
- [x] T008 [P] Create `frontend/src/styles/globals.css` with Contra Labs design tokens as CSS custom properties (all verified tokens from nishanthdesign.txt)
- [x] T009 [P] Configure `tailwind.config.ts` to extend theme with Contra Labs color palette, font families (Source Serif 4, GT Standard → Inter fallback), border radii (card: 8px, pill: 24px), and spacing tokens
- [x] T010 [P] Add data/ and models/ and results/ directories with `.gitkeep` placeholder files

**Checkpoint**: Project structure ready; config and environment established

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data infrastructure that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Create `traceflow/__init__.py` with package version and exports
- [x] T012 Create `traceflow/loader.py`:
  - `load_csv(path: str) -> pl.DataFrame`: reads IBM HI-Small CSV; validates schema (raises SchemaError with expected vs. found columns); combines `From Bank` + `Account` → `src`, `To Bank` + `Account.1` → `dst`; renames to tx_id, ts, src, dst, amount, currency, label; sorts by ts ascending; returns Polars DataFrame
  - `validate_schema(df: pl.DataFrame) -> None`: checks required columns, no nulls in tx_id/ts/src/dst, label ∈ {0,1}
  - CLI: `python -m traceflow.loader --csv <path> --out <parquet_path>`
- [x] T013 Create `traceflow/graph_builder.py`:
  - `build_edge_arrays(df: pl.DataFrame) -> dict`: returns numpy arrays of ts, src_idx, dst_idx, amount, edge_id; builds node_id → int index mapping
  - `build_case_graph(cluster: Cluster, df: pl.DataFrame) -> nx.DiGraph`: NetworkX subgraph for one cluster (≤30 nodes)
  - `get_account_index(node_ids: list[str]) -> dict[str, list[int]]`: per-account sorted edge index for O(log n) lookup
- [x] T014 Create `traceflow/detectors/__init__.py` with Cluster dataclass: cluster_id, typology, accounts, edge_ids, start_time, end_time, duration_hours, size, risk_score (Optional), label (Optional)
- [x] T015 [P] Create `api/schemas.py` with Pydantic models matching all API contracts: CaseListItem, CaseDetail, GraphData, GraphNode, GraphEdge, ReportSentence, STRReport, AblationRow, MetricsResponse
- [x] T016 [P] Create `frontend/src/types/index.ts` with TypeScript interfaces matching all API schemas
- [x] T017 [P] Create `frontend/src/services/api.ts` with typed fetch wrappers for all endpoints: getCases(params?), getCaseDetail(caseId), getMetrics()

**Checkpoint**: Data loading, graph building, schema definitions complete; can proceed to detection

---

## Phase 3: User Story 1 - Data Ingestion & Temporal Graph (Priority: P1) 🎯 MVP

**Goal**: Load IBM HI-Small CSV → validated transaction table → temporal multigraph

**Independent Test**: `pytest tests/test_loader.py -v` — all assertions pass

### Implementation for User Story 1

- [x] T018 [US1] Write `tests/test_loader.py` with tests:
  - `test_load_csv_basic`: loads a tiny synthetic CSV, asserts columns and types
  - `test_node_id_format`: asserts node IDs are `{bank}_{account}` format
  - `test_time_sorted`: asserts output is sorted by ts ascending
  - `test_schema_error`: asserts SchemaError raised on wrong column names
  - `test_zero_amount_retained`: asserts zero-amount rows are kept
- [x] T019 [US1] Write `tests/test_graph_builder.py` with tests:
  - `test_edge_arrays_completeness`: all edges have tx_id, ts, src, dst, amount
  - `test_case_graph_size_cap`: NetworkX graph never exceeds 30 nodes
  - `test_account_index_sorted`: per-account index is time-sorted
- [x] T020 [US1] Implement `traceflow/loader.py` fully (column mapping, schema validation, node ID construction, Parquet output, CLI entrypoint)
- [x] T021 [US1] Implement `traceflow/graph_builder.py` fully (edge arrays with Numba-compatible dtypes, NetworkX case graph builder, account index builder)
- [x] T022 [US1] Create `scripts/run_pipeline.py` stub with argparse: `--mode`, `--csv`, `--out`, `--case-id`; calls loader and prints stats
- [x] T023 [US1] Validate: run `python -m traceflow.loader --csv data/.gitkeep` → expect SchemaError; run pytest tests/test_loader.py → all PASS

**Checkpoint**: Loader and graph builder fully tested and working

---

## Phase 4: User Story 2 - Threshold Baseline & Metrics (Priority: P1)

**Goal**: Chronological split + threshold baseline + metrics harness

**Independent Test**: `pytest tests/test_ranker.py::test_baseline -v` and verify ablation CSV has method A row

### Implementation for User Story 2

- [x] T024 [US2] Write `tests/test_ranker.py` with baseline tests:
  - `test_chronological_split`: 60/20/20 split with no data leakage
  - `test_baseline_flags_above_threshold`: all transactions > threshold get label 1
  - `test_metrics_perfect_predictor`: precision=recall=F1=1.0 on a hand-crafted dataset
  - `test_pr_auc_range`: PR-AUC ∈ [0,1]
- [x] T025 [US2] Create `traceflow/ranker.py`:
  - `chronological_split(df: pl.DataFrame) -> tuple[df, df, df]`: 60/20/20 by ts; returns train, val, test DataFrames
  - `threshold_baseline(df: pl.DataFrame, threshold: float) -> pl.Series`: flags transactions above threshold
  - `compute_metrics(y_true, y_pred, y_score, k=20) -> dict`: precision, recall, F1, PR-AUC, precision@k, false_alerts_per_day
  - `train_lightgbm(X_train, y_train, X_val, y_val) -> lgb.Booster`: trains with scale_pos_weight, early stopping on val
  - `save_model(model, path)`, `load_model(path) -> lgb.Booster`
- [x] T026 [US2] Create `traceflow/features.py`:
  - `build_feature_row(cluster: Cluster, edge_df: pl.DataFrame) -> dict`: extracts all feature columns per data-model.md FeatureRow
  - `build_feature_table(clusters: list[Cluster], edge_df: pl.DataFrame) -> pl.DataFrame`
- [x] T027 [US2] Create `scripts/run_ablation.py`:
  - Loads pre-computed results from results/
  - Runs all 4 methods on the held-out test set
  - Saves results/ablation.csv with columns: method, precision, recall, f1, pr_auc, precision_at_k, false_alerts_per_day
  - Prints formatted table
- [x] T028 [US2] Update `scripts/run_pipeline.py` to support `--mode baseline`: runs loader → split → threshold baseline → metrics → saves results/baseline_metrics.json

**Checkpoint**: Baseline and metrics harness working; can generate method A ablation row

---

## Phase 5: User Story 3 - Three Typology Detectors (Priority: P1)

**Goal**: fan_in_out, cycle, pass_through detectors returning typed Cluster lists

**Independent Test**: `pytest tests/test_detectors.py -v` — planted patterns found, invalid ones rejected

### Implementation for User Story 3

- [x] T029 [US3] Write `tests/test_detectors.py` with tests for each detector:
  - `test_fan_out_found`: planted fan-out (1→5 within window) → found
  - `test_fan_out_not_found_outside_window`: same fan-out but edges > 24h apart → not found
  - `test_fan_in_found`: planted fan-in (5→1 within window) → found
  - `test_cycle_found_time_ordered`: A→B→C→A with ts[A<B<C<A] → found
  - `test_cycle_rejected_out_of_order`: same accounts, edges out of time order → not found
  - `test_pass_through_found_short_dwell`: 3-hop chain, dwell < 1h → found
  - `test_pass_through_rejected_long_dwell`: same chain, dwell > 1h → not found
  - `test_multiple_typologies`: cluster matching fan_out + cycle → both in typology list
- [x] T030 [US3] Implement `traceflow/detectors/fan_in_out.py`:
  - `fan_in_out(edge_df: pl.DataFrame, config: Config) -> list[Cluster]`
  - For each node, count distinct counterparties within TIME_WINDOW_HOURS
  - If in-degree ≥ FAN_IN_OUT_MIN_COUNTERPARTIES → fan_in cluster
  - If out-degree ≥ FAN_IN_OUT_MIN_COUNTERPARTIES → fan_out cluster
  - Build Cluster with all contributing edge IDs, accounts, start/end time
- [x] T031 [US3] Implement `traceflow/detectors/cycle.py`:
  - `cycle(edge_df: pl.DataFrame, config: Config) -> list[Cluster]`
  - Forward-only DFS: for each node, follow time-ordered edges within window
  - Detect cycles of length CYCLE_MIN_LENGTH to CYCLE_MAX_LENGTH
  - Only include cycle if all edges satisfy t[i] < t[i+1] (strict time ordering)
  - Cap at CLUSTER_SIZE_CAP nodes; build Cluster
- [x] T032 [US3] Implement `traceflow/detectors/pass_through.py`:
  - `pass_through(edge_df: pl.DataFrame, config: Config) -> list[Cluster]`
  - Find chains of ≥ PASS_THROUGH_MIN_HOPS hops where each node's dwell ≤ PASS_THROUGH_MAX_DWELL_HOURS * 3600
  - Build Cluster with chain accounts and edge IDs
- [x] T033 [US3] Update `traceflow/detectors/__init__.py` to export `run_all_detectors(edge_df, config) -> list[Cluster]` which merges, deduplicates, and assigns typology lists to overlapping clusters

**Checkpoint**: All three detectors implemented and tested on hand-made graphs

---

## Phase 6: User Story 4 - TraceFlow Tracer (Priority: P1)

**Goal**: Forward time-respecting tracer with dwell + retention filtering

**Independent Test**: `pytest tests/test_tracer.py -v` — planted traces found, out-of-order rejected

### Implementation for User Story 4

- [x] T034 [US4] Write `tests/test_tracer.py`:
  - `test_hop_included_in_window`: t_out ≤ t_in + Δt → hop included
  - `test_hop_excluded_outside_window`: t_out > t_in + Δt → hop excluded
  - `test_retention_computation`: known in/out amounts → retention = out/in correct to 4dp
  - `test_retention_nan_zero_inflow`: zero in-flow → retention NaN, node excluded from band filter
  - `test_retention_band_filtering`: retention 0.7 outside [0.85, 1.0] band → chain excluded
  - `test_tracer_finds_planted_chain`: 5-hop chain within window, correct dwell/retention → found
  - `test_tracer_rejects_out_of_order`: same chain with timestamps reversed → not found
- [x] T035 [US4] Create `traceflow/tracer.py`:
  - `TraceFlow` class with `__init__(self, config: Config)`
  - `trace(edge_df: pl.DataFrame) -> list[TraceCluster]`: main entry point
  - `_build_per_account_index(edge_df)`: builds sorted edge index per account for fast lookup
  - `_forward_trace(src: str, edge_arrays: dict, visited: set) -> list[TraceCluster]`: recursive forward DFS
  - `_compute_dwell(node: str, t_in: float, t_out: float) -> float`: dwell in seconds
  - `_compute_retention(node: str, t_in: float, window: float, edge_arrays: dict) -> float`: retention ratio; returns NaN if in-flow is zero
  - `_filter_by_bands(clusters: list[TraceCluster]) -> list[TraceCluster]`: applies RETENTION_BAND and PASS_THROUGH_MAX_DWELL constraints
  - Numba JIT acceleration for the inner loop using `@numba.njit` where applicable
- [x] T036 [US4] Create `traceflow/agents/tracer_agent.py` wrapping TraceFlow with typed Pydantic inputs/outputs and logging
- [x] T037 [US4] Update `scripts/run_pipeline.py` to support `--mode full`: runs loader → detectors → tracer → merge clusters → features → save results/clusters.parquet

**Checkpoint**: TraceFlow tracer working; combined cluster list with dwell/retention ready for ranking

---

## Phase 7: User Story 5 - Graph-Feature Ranker & Ablation (Priority: P2)

**Goal**: LightGBM ranker producing risk scores; four-way ablation CSV

**Independent Test**: `pytest tests/test_ranker.py -v` and `python scripts/run_ablation.py` → ablation.csv has 4 rows

### Implementation for User Story 5

- [x] T038 [US5] Write tests for ranker and features:
  - `test_feature_row_completeness`: all 20 feature columns present for a cluster
  - `test_lightgbm_trains`: model trains on tiny dataset, outputs scores in [0,1]
  - `test_ablation_csv_format`: ablation.csv has 4 rows with all required columns
  - `test_class_weight_applied`: scale_pos_weight = N_neg/N_pos in model params
  - `test_model_save_load`: saved model loads and scores new clusters identically
- [x] T039 [US5] Implement full `traceflow/features.py`:
  - All 20 feature columns from data-model.md FeatureRow
  - Handles missing dwell/retention (NaN) gracefully for methods A/B
  - `build_feature_table` returns Polars DataFrame with cluster_id + all features + label
- [x] T040 [US5] Implement full `traceflow/ranker.py`:
  - LightGBM training with scale_pos_weight, early stopping (50 rounds), feature importance logging
  - Decision threshold tuning on validation set (maximize F1)
  - Full `compute_metrics` returning all 6 metrics
  - Model save/load with joblib
- [x] T041 [US5] Implement `traceflow/ablation.py`:
  - `run_ablation(tx_df, train_idx, val_idx, test_idx, config) -> list[AblationRow]`
  - Method A: threshold baseline on test transactions
  - Method B: graph features (no dwell/retention) + LightGBM, trained on train, threshold on val, evaluated on test
  - Method C: B + dwell/retention features
  - Method D: C, but only TraceFlow-generated clusters
  - Saves results/ablation.csv; also saves per-method scores for PR curve plotting
- [x] T042 [US5] Update `scripts/run_ablation.py` to call `traceflow.ablation.run_ablation` and print formatted table

**Checkpoint**: Ranker and ablation working; results/ablation.csv generated with real IBM data numbers

---

## Phase 8: User Story 6 - Case Reconstruction & Evidence (Priority: P2)

**Goal**: Evidence object for each top case; Verifier passing reports

**Independent Test**: `pytest tests/test_investigator.py tests/test_verifier.py -v`

### Implementation for User Story 6

- [x] T043 [US6] Write `tests/test_investigator.py`:
  - `test_evidence_object_structure`: all required keys present in output dict
  - `test_evidence_accounts_complete`: all cluster accounts appear in evidence
  - `test_evidence_edges_complete`: all cluster edge_ids appear in evidence edges
  - `test_dwell_retention_values`: dwell ≥ 0; retention ∈ (0, ∞] or NaN
  - `test_subgraph_max_30_nodes`: NetworkX graph never has >30 nodes
- [x] T044 [US6] Write `tests/test_verifier.py`:
  - `test_verifier_pass_correct_report`: report built from evidence → PASS
  - `test_verifier_fail_fake_account`: report with unknown account → FAIL with account name in details
  - `test_verifier_fail_wrong_amount`: report with wrong amount → FAIL
  - `test_verifier_fail_wrong_timestamp`: report with fabricated timestamp → FAIL
  - `test_verifier_fallback_to_template`: verifier fails → system returns template report with PASS
- [x] T045 [US6] Implement `traceflow/investigator.py`:
  - `build_evidence(cluster: Cluster, tx_df: pl.DataFrame) -> EvidenceObject`
  - Uses NetworkX on case subgraph (≤30 nodes) for SCC and shortest-path reconstruction
  - Computes per-node dwell from earliest incoming to latest outgoing within window
  - Computes per-node retention from edge amounts within window
  - Returns fully typed EvidenceObject as dict (JSON-serializable)
  - Saves to results/evidence/{cluster_id}.json
- [x] T046 [US6] Implement `traceflow/verifier.py`:
  - `Verifier` class with `verify(report_text: str, evidence: EvidenceObject) -> VerifierResult`
  - Extracts all numbers, account IDs, timestamps from report text using regex
  - Checks each extracted fact against evidence (amounts within 0.01 tolerance, timestamps within 60s)
  - Returns VerifierResult with verdict (PASS/FAIL) and details list
- [x] T047 [US6] Create `traceflow/agents/investigator_agent.py` and `traceflow/agents/verifier_agent.py` with Pydantic typed I/O and audit logging

**Checkpoint**: Evidence objects generated for top-ranked cases; Verifier tests passing

---

## Phase 9: User Story 7 - Narrative & STR Report (Priority: P2)

**Goal**: Jinja2 template STR reports; every sentence tagged with edge IDs; Verifier passes

**Independent Test**: `pytest tests/test_narrator.py -v` and manually verify report content

### Implementation for User Story 7

- [x] T048 [US7] Write `tests/test_narrator.py`:
  - `test_report_contains_all_accounts`: every account in evidence appears in report
  - `test_report_contains_all_amounts`: every amount in evidence appears in report
  - `test_sentences_have_edge_ids`: all sentences have non-empty edge_ids list
  - `test_verifier_passes_template_report`: template report → Verifier PASS
  - `test_llm_fallback_on_unavailable`: LLM unavailable → template used, verifier passes
- [x] T049 [US7] Create `traceflow/templates/str_report.j2`:
  - Template sections: Header (case_id, typology, risk_score, date)
  - Money Trail Summary: for each hop in the trace, one sentence with account IDs, amount, timestamp
  - Typology Analysis: description of the detected pattern
  - Risk Indicators: dwell times, retention ratios
  - Disclaimer: "All findings are SUSPICIOUS and have not been confirmed as laundering."
  - Each sentence wrapped in a custom delimiter that encodes its edge_ids for extraction
- [x] T050 [US7] Implement `traceflow/narrator.py`:
  - `Narrator` class with `generate(evidence: EvidenceObject, use_llm: bool = False) -> STRReport`
  - `_fill_template(evidence) -> STRReport`: fills Jinja2 template, extracts sentence/edge_id pairs
  - `_llm_rephrase(draft: STRReport, llm_client) -> STRReport`: sends each sentence to LLM for rephrasing; preserves sentence structure
  - `_anti_hallucination_loop(evidence, use_llm) -> STRReport`: fills template → optional LLM → Verifier → retry once → fallback to template
- [x] T051 [US7] Implement optional LLM client in `traceflow/narrator.py`:
  - `OllamaClient` class: POST to LLM_HOST/api/generate with timeout
  - Falls back gracefully (logs error, returns None) if unavailable or LLM_ENABLED=false

**Checkpoint**: STR reports generated and verified; hover edge_ids ready for dashboard

---

## Phase 10: User Story 8 - FastAPI Backend (Priority: P2)

**Goal**: FastAPI serving all endpoints per contracts; tested with httpx

**Independent Test**: `pytest tests/test_api.py -v` with TestClient

### Implementation for User Story 8

- [x] T052 [US8] Write `tests/test_api.py`:
  - `test_health`: GET /api/health → 200, {"status": "ok"}
  - `test_cases_list`: GET /api/cases → 200, list sorted by risk_score desc
  - `test_case_detail`: GET /api/cases/{valid_id} → 200, all required fields present
  - `test_case_not_found`: GET /api/cases/invalid → 404
  - `test_metrics`: GET /api/metrics → 200, 4 ablation rows
- [x] T053 [US8] Implement `api/data_store.py`:
  - `DataStore` class: loads clusters.parquet, evidence/*.json, ablation.csv on startup
  - `get_cases(limit, offset, typology_filter, min_score) -> CaseList`
  - `get_case_detail(case_id) -> CaseDetail | None`
  - `get_metrics() -> MetricsResponse`
- [x] T054 [US8] Implement `api/routers/cases.py` with FastAPI router:
  - GET /api/cases: query params limit, offset, typology, min_score
  - GET /api/cases/{case_id}: 404 if not found
- [x] T055 [US8] Implement `api/routers/metrics.py` with GET /api/metrics
- [x] T056 [US8] Implement `api/main.py`:
  - FastAPI app with CORS middleware (allow localhost:5173)
  - Include cases and metrics routers with /api prefix
  - GET /api/health
  - Startup event: load DataStore
  - Configure uvicorn with PORT from env

**Checkpoint**: API endpoints working; all tests pass; can serve pre-computed results

---

## Phase 11: User Story 8 - React Dashboard (Priority: P2)

**Goal**: Complete React dashboard following Contra Labs design system

**Independent Test**: Visual inspection + `npm run test` passing; hover-to-highlight working

### Implementation for User Story 8 (Frontend)

- [x] T057 [US8] [P] Implement `frontend/src/components/ui/Button.tsx`: primary (charcoal fill + parchment text), secondary (outline, taupe border), hover states per design system
- [x] T058 [US8] [P] Implement `frontend/src/components/ui/Card.tsx`: 8px radius, warm parchment background, 1px ink-10 border, shadow on hover
- [x] T059 [US8] [P] Implement `frontend/src/components/ui/Badge.tsx`: pill shape (24px radius), typology color coding (cycle=teal, fan=olive, pass-through=sage)
- [x] T060 [US8] [P] Implement `frontend/src/components/ui/Spinner.tsx`: loading spinner with Contra Labs colors
- [x] T061 [US8] Implement `frontend/src/hooks/useCases.ts`: fetches /api/cases with pagination and filter params; returns {cases, total, loading, error}
- [x] T062 [US8] Implement `frontend/src/hooks/useCaseDetail.ts`: fetches /api/cases/{id}; returns {caseDetail, loading, error}
- [x] T063 [US8] Implement `frontend/src/hooks/useMetrics.ts`: fetches /api/metrics; returns {ablation, loading, error}
- [x] T064 [US8] Implement `frontend/src/components/CaseList.tsx`:
  - Sidebar panel with ranked case list
  - Each item shows: cluster_id (truncated), typology badge, risk score bar, duration, accounts count
  - Click to select case; selected state highlighted with mint sage accent
  - Filter bar: typology dropdown, min score slider
  - Contra Labs styling: parchment background, charcoal text, Source Serif 4 for case title
- [x] T065 [US8] Implement `frontend/src/components/CaseGraph.tsx`:
  - Cytoscape.js graph with react-cytoscapejs wrapper
  - Force-directed layout (cose or cola)
  - Node style: circle, charcoal fill, size proportional to degree
  - Edge style: width proportional to amount, default color ink-50
  - Highlighted edge style: mint sage (#c8e1dd) with glow effect
  - `highlightEdges(edgeIds: string[])` method exposed via ref for hover-to-highlight
  - Cap: never renders more than 30 nodes; shows warning if data has more
  - Pan/zoom controls
- [x] T066 [US8] Implement `frontend/src/components/Timeline.tsx`:
  - Plotly scatter timeline of transactions in the case
  - X-axis: timestamp; Y-axis: amount; color: edge highlight state
  - Hover tooltip showing: src, dst, amount, currency, ts
  - Contra Labs color palette applied to Plotly layout
- [x] T067 [US8] Implement `frontend/src/components/ReportPanel.tsx`:
  - Displays STR report sentences
  - Each sentence is a `<span>` with `data-edge-ids` attribute
  - `onMouseEnter`: calls parent callback with edge_ids to trigger CaseGraph.highlightEdges
  - `onMouseLeave`: clears highlight
  - Verifier badge (PASS green / FAIL red) at top of panel
  - Source Serif 4 typography; parchment background; charcoal ink text
  - Disclaimer in muted taupe text
- [x] T068 [US8] Implement `frontend/src/components/MetricsTable.tsx`:
  - Responsive table with method name, precision, recall, F1, PR-AUC, P@K, false alerts/day
  - Best value in each column highlighted with mint sage background
  - Method D (TraceFlow) row in bold
  - Footnote: "All metrics on chronological test split. Labels are synthetic."
- [x] T069 [US8] Implement `frontend/src/App.tsx`:
  - Layout: left sidebar (CaseList), main area (CaseGraph + ReportPanel), bottom bar (Timeline + MetricsTable)
  - Responsive breakpoints: stack vertically on < 1024px
  - Shared state: `selectedCaseId`, `highlightedEdgeIds`
  - Navbar: TraceFlow logo (Source Serif 4), status indicator, link to ablation table
  - Loading states and error boundaries
- [x] T070 [US8] Configure Vite proxy to forward /api/* to http://localhost:8000 in `vite.config.ts`

**Checkpoint**: Dashboard functional with Contra Labs design; hover-to-highlight working end-to-end

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, testing, hardening, and final validation

- [x] T071 [P] Create comprehensive `README.md`:
  - Project overview, architecture diagram (ASCII or Mermaid)
  - Prerequisites, installation, dataset setup instructions
  - Running the pipeline, API, and dashboard
  - Running tests
  - Implemented features summary
  - Known limitations
- [x] T072 [P] Create `docker-compose.yml` for optional containerized startup:
  - Service: api (Python + uvicorn, port 8000)
  - Service: frontend (npm run preview, port 5173)
  - Shared volume for results/
- [x] T073 [P] Write `scripts/inject_patterns.py` for planted-pattern testing:
  - Injects N synthetic cycles, fan-outs, and pass-through chains into a CSV
  - Saves to a new CSV for detector validation
- [x] T074 Implement `traceflow/agents/ingest_agent.py`, `tracer_agent.py`, `scorer_agent.py` as thin orchestration wrappers with structured logging (inputs, outputs, edge IDs per step)
- [x] T075 [P] Add structured logging throughout Python pipeline: log level from LOG_LEVEL env; every agent step logs inputs/outputs/edge_ids
- [x] T076 [P] Add error handling throughout API: custom exception handlers for SchemaError, ModelNotFoundError; structured error responses
- [x] T077 Run full end-to-end validation per quickstart.md: loader → pipeline → ablation → API → dashboard; fix any failures
- [x] T078 Run `pytest tests/ -v --tb=short` → all tests pass; fix any failures
- [x] T079 [P] Add `frontend/tests/` with Vitest tests for CaseGraph highlight logic and ReportPanel hover behavior
- [x] T080 [P] Performance check: tracer on IBM HI-Small < 60s; API /api/cases < 500ms; graph render < 3s; fix bottlenecks if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phases 3–6 (US1–US4)**: All depend on Phase 2; execute in order (US1→2→3→4) due to data flow
- **Phases 7–9 (US5–US7)**: Depend on US4 completion; US5+US6 can run in parallel; US7 depends on US6
- **Phase 10–11 (US8 Backend + Frontend)**: Backend depends on US5+US6+US7; Frontend can start after Phase 2 (uses mock data)
- **Phase 12 (Polish)**: Depends on all user stories

### Within Each Phase
- Tests MUST be written first (included in task order above)
- Models before services; services before API; API before dashboard data wiring

### Parallel Opportunities
- T004, T005, T007, T008, T009, T010 in Phase 1 can all run in parallel
- T015, T016, T017 in Phase 2 can run in parallel
- T057–T060 (UI atoms) in Phase 11 can all run in parallel
- T061, T062, T063 (hooks) in Phase 11 can run in parallel
- T071, T072, T073, T075, T076 in Phase 12 can run in parallel

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 = Working Submission)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (US1: Loader + Graph)
4. Complete Phase 4 (US2: Baseline + Metrics)
5. Complete Phase 5 (US3: Three Detectors)
6. **STOP and VALIDATE**: Three detectors + baseline metrics = complete PS 2.1 submission
7. Continue to TraceFlow, Ranker, Dashboard for full system

### Full System Delivery Order
Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

---

## Notes

- All amounts in reports must match evidence within 0.01 tolerance
- All account IDs in reports must exactly match evidence.accounts
- Cluster subgraph is always capped at 30 nodes before NetworkX and before API response
- LLM is always off in measured runs; template is always the fallback
- Test set is never read until final ablation; validation metrics gate all threshold choices
- Results are saved to results/ which is git-ignored
- IBM CSV must be placed manually; it is not downloaded automatically
