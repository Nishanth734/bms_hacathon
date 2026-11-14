# Research: TraceFlow AML Investigation Platform

## Technology Decisions

### 1. Data Processing: Polars over Pandas

**Decision**: Use Polars as the primary dataframe library.
**Rationale**: IBM HI-Small has ~500k rows. Polars is 2–5x faster than Pandas for chronological sorting and window operations, uses Rust under the hood, and integrates with Parquet/DuckDB natively.
**Alternatives considered**: Pandas (acceptable fallback if Polars unavailable), Spark (overkill for this scale).

### 2. Graph Library: Edge Arrays + NetworkX

**Decision**: Store the full temporal graph as Polars DataFrames / NumPy edge arrays for fast traversal; use NetworkX only on the per-case subgraph (≤30 nodes).
**Rationale**: NetworkX is too slow on 500k-node graphs for SCC, but is excellent for small subgraph operations (SCC, path search, min-cut). Edge arrays allow vectorized time-window lookups.
**Alternatives considered**: Graph-tool (C++ binding, complex install), igraph (good, but NetworkX is simpler for small subgraphs), DGL/PyG (overkill; GNNs are out of scope).

### 3. ML Ranker: LightGBM

**Decision**: LightGBM as primary ranker; XGBoost as comparison in ablation.
**Rationale**: LightGBM matches GFP paper results for the GFP+XGBoost baseline (~63% minority F1 on IBM HI-Small). Handles extreme class imbalance via `is_unbalance` or `scale_pos_weight`. Faster training than XGBoost on tabular data.
**Alternatives considered**: XGBoost (included in ablation), Random Forest (included as stretch), GNNs (explicitly excluded).

### 4. API Framework: FastAPI

**Decision**: FastAPI with Uvicorn.
**Rationale**: Async support, automatic OpenAPI docs, Pydantic models for type-safe serialization. Fits the Python stack natively.
**Alternatives considered**: Flask (synchronous, less type-safe), Django REST (too heavy for a demo).

### 5. Frontend: React + Cytoscape.js + Plotly

**Decision**: React 18 with TypeScript, Vite build, Cytoscape.js for graph, Plotly.js for timeline.
**Rationale**: Cytoscape.js is the only library that supports programmatic per-edge highlighting needed for hover-to-sentence interaction. Plotly.js is the best React-compatible charting library.
**Alternatives considered**: Streamlit + pyvis (cannot do hover-to-edge on individual edges), D3.js (more code for the same result), Sigma.js (less community support).

### 6. Report Template: Jinja2

**Decision**: Jinja2 templates for STR narrative generation; every sentence tagged with source edge IDs.
**Rationale**: Deterministic output; correct by construction from the evidence object. The LLM reword pass is optional and always verified.
**Alternatives considered**: f-strings (harder to maintain), Mako (less popular), handlebars (requires Node.js).

### 7. IBM CSV Schema (confirmed from dataset docs)

Key columns in the IBM HI-Small format (may vary by exact version):
- `Timestamp` or `Step` → transaction time
- `From Bank`, `Account` → source bank + account
- `To Bank`, `Account.1` → destination bank + account  
- `Amount Received`, `Receiving Currency`, `Amount Paid`, `Payment Currency` → amounts
- `Is Laundering` → 0 or 1 ground-truth label
- `Payment Format` → wire/check/etc.

Node ID convention: `{FromBank}_{Account}` and `{ToBank}_{Account.1}` (column names may differ; loader validates schema on load).

### 8. Class Imbalance Handling

IBM HI-Small has ~0.12% illicit transactions. Strategy:
- LightGBM: `scale_pos_weight = N_neg / N_pos`
- Evaluation: Use PR-AUC and F1 (not accuracy); report at tuned threshold chosen on validation set
- Cluster label: illicit if ≥ 50% of cluster transactions are illicit (configurable)

### 9. Anti-Hallucination Loop

1. Investigator builds evidence object from edge list (always correct by construction)
2. Narrator fills Jinja2 template → draft always correct
3. Optional LLM rephrases draft (sentences only, no fact changes)
4. Verifier extracts all numbers, account IDs, timestamps from final text; checks each against evidence
5. On mismatch: 1 retry allowed, then fall back to template draft
6. Each sentence retains its source edge_ids for hover-to-highlight

### 10. Numba Acceleration for Tracer

The forward tracer must traverse time-sorted edges for each node within a window Δt. With Numba JIT compilation, this can process ~500k edges in < 10 seconds. The tracer operates on NumPy arrays sorted by timestamp, using per-account index arrays for O(log n) lookup.

### 11. Design System Integration (Contra Labs / nishanthdesign.txt)

CSS custom properties from the design file are mapped to Tailwind CSS config:
- `--color-bg-cream: #fbfaf6` → `bg-cream`
- `--color-ink: #2b2b29` → `text-ink`
- `--color-bg-mint: #c8e1dd` → `bg-mint`
- `--color-accent-sage: #a5beba` → `accent-sage`
- Font: Source Serif 4 Variable (display), GT Standard (body) → loaded via Google Fonts / CDN
- Card radius: 8px, pill radius: 24px
- Container padding: 120px desktop, 20px mobile
