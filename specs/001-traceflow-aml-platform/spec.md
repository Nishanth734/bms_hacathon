# Feature Specification: TraceFlow AML Investigation Platform

**Feature Branch**: `001-traceflow-aml-platform`

**Created**: 2026-11-14

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Data Ingestion & Temporal Graph Construction (Priority: P1)

An AML analyst or system operator loads the IBM HI-Small CSV dataset into TraceFlow. The system validates the schema, combines bank+account into unified node IDs, sorts all transactions chronologically, and builds a directed, weighted, temporal multigraph where every edge carries a transaction ID, timestamp, source account, destination account, amount, currency, and ground-truth label.

**Why this priority**: Without a valid temporal graph, no detection, ranking, or reporting is possible. This is the irreducible foundation.

**Independent Test**: Load the IBM HI-Small CSV; assert every edge has tx_id, ts, src, dst, amount, currency, label; assert edges are time-sorted; assert node IDs follow the `{bank}_{account}` format.

**Acceptance Scenarios**:

1. **Given** a valid IBM HI-Small CSV, **When** the loader runs, **Then** the output table has columns tx_id, ts, src, dst, amount, currency, label, sorted ascending by ts with no nulls in required fields.
2. **Given** rows with separate bank and account columns, **When** node IDs are built, **Then** each node ID equals `{bank}_{account}` for both source and destination.
3. **Given** a CSV with mismatched currency pairs, **When** the loader runs, **Then** amounts are retained as-is per edge with the currency field preserved; no silent conversion occurs.
4. **Given** an invalid CSV path, **When** the loader runs, **Then** the system raises a clear error with the file path and does not silently continue.

---

### User Story 2 - Threshold Baseline & Metrics Harness (Priority: P1)

The system implements an amount-threshold rule that flags any transaction above a configurable threshold as suspicious. It then evaluates this baseline—and all subsequent methods—with a fixed chronological split (60/20/20 train/validation/test), reporting minority-class precision, recall, F1, PR-AUC, precision@k, and false alerts per day. The split script is deterministic and never touches the test set during tuning.

**Why this priority**: The baseline and metrics harness are the measurement foundation for the ablation. Without them, no comparative claim can be made.

**Independent Test**: Run the threshold baseline on a tiny synthetic dataset with known labels; assert that precision, recall, F1, and PR-AUC are computed correctly against hand-calculated values.

**Acceptance Scenarios**:

1. **Given** a labeled transaction table, **When** the chronological split is applied, **Then** train is the first 60%, validation the next 20%, test the final 20%, by sorted timestamp.
2. **Given** a threshold and the validation split, **When** the baseline runs, **Then** every transaction above the threshold is flagged; metrics are reported; the test set is not read.
3. **Given** a perfect predictor on a synthetic dataset, **When** metrics are computed, **Then** precision=1.0, recall=1.0, F1=1.0, PR-AUC≈1.0.
4. **Given** the final ablation stage, **When** the test set is evaluated, **Then** it is read exactly once and the results are written to a CSV file.

---

### User Story 3 - Three Typology Detectors (Priority: P1)

The system implements three named detector functions—`fan_in_out`, `cycle`, and `pass_through`—that operate on time-sorted edge arrays with configurable windows and thresholds. Each detector returns a list of candidate clusters (cluster_id, typology, accounts, edge_ids, start_time, end_time). Every alert carries a typology field. If multiple typologies match, all are shown and the highest-scoring is primary.

**Why this priority**: These are the three explicitly required typologies for PS 2.1. They must exist independently before TraceFlow adds dwell/retention constraints.

**Independent Test**: For each detector, construct a minimal hand-made graph containing a planted pattern and one pattern that should be rejected (e.g., edges out of time order for the cycle detector). Assert the planted pattern is found and the invalid one is not.

**Acceptance Scenarios**:

1. **Given** a fan-out pattern (one source to ≥5 distinct destinations within 24 hours), **When** `fan_in_out` runs, **Then** the cluster is returned with typology "fan_out".
2. **Given** a cycle A→B→C→A with edges in time order, **When** `cycle` runs, **Then** the cycle is returned; given the same accounts with edges out of time order, the cycle is not returned.
3. **Given** a pass-through chain of ≥3 hops with dwell ≤1 hour at each node, **When** `pass_through` runs, **Then** the chain is returned; given a chain with dwell >1 hour, it is not returned.
4. **Given** a cluster matching both fan_out and cycle, **When** alerts are generated, **Then** both typologies appear in the typology field.

---

### User Story 4 - TraceFlow Tracer with Dwell & Retention (Priority: P1)

The TraceFlow tracer follows money forward in time along edges where the incoming time is before the outgoing time and within a window Δt. For each node it computes dwell time (t_out − t_in) and retention ratio (value_out / value_in within the window). It returns all three required typology clusters filtered by configurable dwell and retention bands. The tracer is the novelty differentiator and feeds the ranker.

**Why this priority**: TraceFlow is the core novelty of the system, its candidate-generation front end, and must run before any ranking or ablation comparison.

**Independent Test**: Plant a known money-flow chain in a small synthetic graph; assert the tracer finds it with correct dwell and retention values; plant a chain violating the time-ordering rule and assert it is rejected.

**Acceptance Scenarios**:

1. **Given** a chain where funds arrive at node v at time t_in and leave at t_out ≤ t_in + Δt, **When** the tracer runs, **Then** the hop is included; if t_out > t_in + Δt, the hop is excluded.
2. **Given** a node with known in-flow and out-flow amounts, **When** retention is computed, **Then** retention = sum(out) / sum(in) within the window, correct to 4 decimal places.
3. **Given** a retention band of 0.85–1.0 and a node with retention 0.7, **When** the tracer filters, **Then** that chain is excluded.
4. **Given** the full IBM HI-Small dataset, **When** the tracer runs, **Then** it completes in under 60 seconds on a standard laptop and returns clusters with cluster_id, typology, accounts, edge_ids, dwell, retention.

---

### User Story 5 - Graph-Feature Ranker (Priority: P2)

The system builds one feature row per cluster (topology, temporal, amount, tracer features: size, duration, dwell, retention, typology flags, degree stats, cycle counts, scatter-gather within windows) and trains a LightGBM classifier with inverse class-weight balancing. It outputs a risk score per cluster, saves the trained model, and supports a four-way ablation comparing A (threshold), B (graph features + GBM), C (B + retention/dwell), D (C + TraceFlow candidates). Results are saved to a CSV with precision, recall, F1, PR-AUC per method.

**Why this priority**: The ranker produces the final risk ordering and the ablation table, which are core PS 2.1 deliverables.

**Independent Test**: Train on a tiny synthetic cluster table with known labels; assert the model outputs a score per cluster; assert the ablation CSV contains all four methods with numeric metrics.

**Acceptance Scenarios**:

1. **Given** a feature table with cluster labels, **When** LightGBM trains, **Then** a model file is saved and each cluster receives a float score in [0,1].
2. **Given** four methods on the same chronological split, **When** the ablation runs, **Then** a CSV at `results/ablation.csv` contains columns: method, precision, recall, f1, pr_auc.
3. **Given** extreme class imbalance, **When** the ranker trains, **Then** class weights are set to N_negative/N_positive for the positive class.
4. **Given** the saved model, **When** new clusters arrive, **Then** the model loads and scores them without retraining.

---

### User Story 6 - Case Reconstruction & Evidence Object (Priority: P2)

For each top-ranked cluster, the Investigator agent rebuilds the full money trail using SCC compression and path search on a small NetworkX subgraph (15–30 nodes). It produces a structured evidence object containing: typology, time window, dwell, retention, account IDs, edge IDs with amounts and timestamps. The Verifier then checks every number, account ID, and timestamp in any generated report against this evidence object.

**Why this priority**: The evidence object is the backbone of hallucination-free reporting. It must be built before the narrative layer.

**Independent Test**: Reconstruct a known planted trail from a small graph; assert the evidence object contains all planted accounts, edge IDs, the correct dwell, retention, and typology label.

**Acceptance Scenarios**:

1. **Given** a flagged cluster with ≤30 nodes, **When** the Investigator runs, **Then** an evidence JSON is returned with keys: cluster_id, typology, window, dwell, retention, accounts, edges (each with edge_id, amount, ts, src, dst).
2. **Given** an evidence object and a correct report, **When** the Verifier runs, **Then** it returns PASS.
3. **Given** an evidence object and a report with a fabricated account ID, **When** the Verifier runs, **Then** it returns FAIL and identifies the offending account.
4. **Given** a report that fails verification, **When** the system retries once, **Then** it falls back to the template draft and re-runs the Verifier; if still failing, it logs and uses the template.

---

### User Story 7 - Evidence-Linked Narrative & STR Report (Priority: P2)

The Narrator agent fills a Jinja2 template from the evidence object to produce a plain-language Suspicious Transaction Report (STR). Every sentence in the report is tagged with the edge IDs it came from. An optional LLM reword pass (off by default in measured runs) may rephrase sentences without changing the facts. The Verifier must pass every report before it is delivered.

**Why this priority**: Plain-language narratives are a PS 2.1 requirement. The template approach ensures correctness by construction.

**Independent Test**: Feed a known evidence object into the template; assert the output report contains the correct account IDs, amounts, timestamps, and typology label; assert the Verifier passes.

**Acceptance Scenarios**:

1. **Given** a valid evidence object, **When** the Narrator runs with LLM off, **Then** the template report is produced with every number matching the evidence; Verifier returns PASS.
2. **Given** a valid evidence object and LLM on, **When** the Narrator runs, **Then** the LLM rephrases the template draft; the Verifier checks the result; if FAIL, falls back to template.
3. **Given** a report sentence, **When** the user hovers over it in the dashboard, **Then** the edge IDs tagged to that sentence are highlighted in the case graph.
4. **Given** a report, **When** it is exported, **Then** it includes a machine-readable section with all edge IDs, amounts, accounts, and timestamps for audit.

---

### User Story 8 - FastAPI Backend & Investigation Dashboard (Priority: P2)

A FastAPI application exposes endpoints for the ranked cluster list, one case's evidence and graph, and the metrics/ablation table. A React frontend with Cytoscape.js displays: the ranked case list, a 15–30 node case subgraph with hover-to-edge highlighting, a transaction timeline (Plotly), the evidence-linked STR report with hover-to-highlight, and the ablation metrics table. The design follows the Contra Labs visual system from nishanthdesign.txt.

**Why this priority**: The dashboard is the primary demo surface and a PS 2.1 requirement. The API is its data source.

**Independent Test**: Start the API server; call each endpoint; assert correct JSON responses. Open the dashboard; load a case; hover a report sentence; assert the corresponding graph edges highlight.

**Acceptance Scenarios**:

1. **Given** pre-computed results, **When** `GET /api/cases` is called, **Then** a JSON array of clusters sorted by risk score descending is returned.
2. **Given** a case_id, **When** `GET /api/cases/{case_id}` is called, **Then** the evidence object, graph nodes/edges, and STR report are returned.
3. **Given** `GET /api/metrics`, **When** called, **Then** the ablation table rows are returned.
4. **Given** the dashboard loads a case, **When** the user hovers a report sentence, **Then** the corresponding edges in the Cytoscape graph are highlighted in a distinct color.
5. **Given** the graph has >30 nodes, **When** rendered, **Then** only the 15–30 node subgraph is shown; the full graph is never rendered.

---

### Edge Cases

- What happens when a CSV has transactions with zero amount? → Retain them; flag in loader validation output but do not discard.
- What if a cycle detector finds more than the cluster size cap (30 nodes)? → Truncate to the highest-degree nodes up to the cap.
- What if the LLM is unavailable during report generation? → Fall back to template immediately; log the LLM failure; do not block report delivery.
- What if retention ratio is undefined (zero in-flow)? → Set retention to NaN; exclude the node from retention-based filtering; log a warning.
- What if the IBM CSV has unexpected column names? → The loader raises a descriptive schema validation error listing expected vs. found columns.
- What if the test set is accidentally read during tuning? → The split script enforces a programmatic barrier; validation metrics are gated to the validation split only.
- What if Cytoscape renders too slowly on a large subgraph? → Cap at 30 nodes; use a force-directed layout with caching; show a spinner during load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load IBM HI-Small CSV, combine bank+account into a unified node ID, sort by timestamp, and output a time-sorted transaction table with columns tx_id, ts, src, dst, amount, currency, label.
- **FR-002**: System MUST build a directed, weighted temporal multigraph where every edge has tx_id, timestamp, amount, and currency.
- **FR-003**: System MUST implement a threshold-baseline detector that flags all transactions above a configurable amount threshold.
- **FR-004**: System MUST implement a fixed chronological split (60/20/20) and report precision, recall, F1, PR-AUC, precision@k, and false alerts per day for every evaluated method.
- **FR-005**: System MUST implement three separate typology detector functions: `fan_in_out`, `cycle`, and `pass_through`, each returning clusters with cluster_id, typology list, accounts, edge_ids, start_time, end_time.
- **FR-006**: System MUST implement the TraceFlow forward tracer that respects time ordering, computes per-node dwell time and retention ratio, and filters by configurable bands.
- **FR-007**: System MUST build one feature row per cluster (topology, temporal, amount, tracer features) and train a LightGBM classifier with class weights.
- **FR-008**: System MUST run a four-way ablation (A: threshold, B: graph+GBM, C: B+dwell/retention, D: C+TraceFlow) and save results to `results/ablation.csv`.
- **FR-009**: System MUST produce a structured evidence object for each flagged case containing typology, window, dwell, retention, account IDs, edge IDs with amounts and timestamps.
- **FR-010**: System MUST implement a Verifier that checks every number, account ID, and timestamp in a report against the evidence object and returns PASS or FAIL with details.
- **FR-011**: System MUST generate plain-language STR reports from Jinja2 templates, with every sentence tagged by its source edge IDs.
- **FR-012**: System MUST expose a FastAPI backend with endpoints: `GET /api/cases`, `GET /api/cases/{case_id}`, `GET /api/metrics`, `GET /api/health`.
- **FR-013**: System MUST provide a React dashboard with: ranked case list, 15–30 node case subgraph (Cytoscape.js), transaction timeline (Plotly), STR report with hover-to-edge highlight, ablation metrics table.
- **FR-014**: Dashboard MUST follow the Contra Labs visual design system: warm parchment (#fbfaf6) canvas, charcoal ink (#2b2b29) text, mint sage accent (#a5beba/#c8e1dd), Source Serif 4 display font, GT Standard sans-serif body font, 8px card radius, 24px pill radius.
- **FR-015**: System MUST keep all configurable parameters (window size, fan-in/out threshold, cycle length, dwell cap, retention band, cluster size cap, decision threshold) in a single config file.
- **FR-016**: System MUST label all outputs as "suspicious" and never as "confirmed laundering".
- **FR-017**: The LLM narrative reword feature MUST be off by default; removing LLM access MUST NOT break the product.
- **FR-018**: System MUST include pytest tests for the loader, all three detectors, the TraceFlow tracer, the evidence builder, and the Verifier.
- **FR-019**: System MUST provide a `.env.example` file and setup documentation without exposing secrets.
- **FR-020**: System MUST render only the 15–30 node case subgraph in the browser; the full graph MUST never be rendered.

### Key Entities

- **Transaction**: tx_id, ts (timestamp), src (node_id), dst (node_id), amount, currency, label (0/1)
- **Node (Account)**: node_id = `{bank}_{account}`, in_degree, out_degree, in_amount, out_amount
- **Cluster**: cluster_id, typology (list), accounts (list of node_ids), edge_ids (list), start_time, end_time, risk_score
- **TraceCluster**: inherits Cluster + dwell (per node), retention (per node), end_to_end_retention
- **EvidenceObject**: cluster_id, typology, window (start, end), dwell (dict), retention (dict), accounts (list), edges (list of {edge_id, src, dst, amount, ts})
- **STRReport**: case_id, sentences (list of {text, edge_ids}), verdict (PASS/FAIL), template_used (bool)
- **AblationRow**: method, precision, recall, f1, pr_auc, precision_at_k, false_alerts_per_day

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The loader processes the full IBM HI-Small dataset in under 30 seconds.
- **SC-002**: All three typology detectors find planted patterns on hand-made graphs in under 1 second each.
- **SC-003**: The TraceFlow tracer processes the full IBM HI-Small dataset in under 60 seconds.
- **SC-004**: The ablation table contains numeric precision, recall, F1, and PR-AUC for all four methods.
- **SC-005**: 100% of STR reports pass the Verifier (template mode); LLM-mode reports retry and fall back if needed.
- **SC-006**: The dashboard loads a case subgraph in under 3 seconds.
- **SC-007**: Hovering a report sentence highlights corresponding graph edges within 200ms.
- **SC-008**: All pytest tests pass on the first run with no manual intervention.
- **SC-009**: The API returns `GET /api/cases` in under 500ms for a pre-computed result set.
- **SC-010**: The system runs end-to-end (load → detect → rank → report → display) without crashing on IBM HI-Small.

## Assumptions

- IBM HI-Small CSV is available at a local path specified in the config file or as a CLI argument; it is not bundled in the repository.
- The IBM CSV schema follows the documented format: columns include bank, account, timestamp, amount_sent, currency_sent, amount_received, currency_received, is_laundering, plus counterparty bank/account columns.
- Node IDs are formed as `{bank}_{account}`; if the CSV uses different column names, the loader raises a schema error.
- The LLM (Ollama or similar) is entirely optional; template-only mode is the default and the measured mode.
- Mobile responsiveness for the dashboard is a stretch goal; the primary target is desktop at 1440×900.
- AMLSim and PaySim datasets are explicitly out of scope.
- GNNs are not implemented as part of this project; they are mentioned only as future comparison.
- The chronological split percentages (60/20/20) are fixed for reproducibility; changing them requires a code change, not a config change.
- The cluster size cap (30 nodes) is enforced before rendering and before NetworkX subgraph operations.
- SHAP explanations (FR should-have #11 from handoff) are a stretch goal and are not required for the submission.
