# Implementation Plan: TraceFlow AML Investigation Platform

**Branch**: `001-traceflow-aml-platform` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-traceflow-aml-platform/spec.md`

## Summary

TraceFlow is a time-respecting money-flow tracer and risk ranker for AML investigation. It loads the IBM HI-Small synthetic dataset, builds a temporal directed multigraph, runs three typology detectors plus the TraceFlow forward tracer (with per-hop dwell and retention filtering), ranks candidate clusters with LightGBM, produces evidence-verified STR narratives, and exposes a FastAPI + React dashboard. A four-way ablation table measures contribution of each component against a threshold baseline.

## Technical Context

**Language/Version**: Python 3.11 (backend, ML pipeline); Node.js 20 / TypeScript (React frontend)

**Primary Dependencies**:
- Backend: polars, networkx, lightgbm, scikit-learn, fastapi, uvicorn, pydantic, jinja2, numba, duckdb, pyarrow, shap, pytest
- Frontend: React 18, TypeScript, Vite, Cytoscape.js, Plotly.js, Tailwind CSS (config-driven to match Contra Labs palette)

**Storage**: Parquet files (via Polars/DuckDB) for processed data; JSON files for evidence objects and results; SQLite not required

**Testing**: pytest (Python), Vitest (TypeScript/React)

**Target Platform**: Linux/macOS/Windows laptop (local demo); no cloud deployment required

**Project Type**: Full-stack web application (Python ML pipeline + FastAPI + React SPA)

**Performance Goals**: Loader < 30s; Tracer < 60s; API response < 500ms; Graph render < 3s; Hover highlight < 200ms

**Constraints**: Cluster subgraph ≤ 30 nodes always; full graph never rendered; LLM optional (off by default); test set read exactly once

**Scale/Scope**: IBM HI-Small (~500k transactions); 3-person team; 24-hour hackathon

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ No GNN as primary model (LightGBM chosen for stability under class imbalance)
- ✅ LLM is optional and off by default; template draft is always correct by construction
- ✅ Full graph never rendered; subgraph capped at 30 nodes
- ✅ Test set read exactly once; validation split used for all tuning
- ✅ All outputs labeled "suspicious", never "confirmed"
- ✅ Verifier blocks any report fact not in the evidence object
- ✅ Config file contains all tunable parameters

## Project Structure

### Documentation (this feature)

```text
specs/001-traceflow-aml-platform/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: entities and relationships
├── quickstart.md        # Phase 1: validation guide
├── contracts/           # Phase 1: API contracts
│   ├── api-cases.md
│   ├── api-case-detail.md
│   └── api-metrics.md
└── tasks.md             # Phase 2: implementation tasks
```

### Source Code (repository root)

```text
traceflow/                        # Python ML pipeline package
├── __init__.py
├── config.py                     # All tunable parameters (single config file)
├── loader.py                     # IBM CSV loader, schema validation, node ID builder
├── graph_builder.py              # Temporal multigraph builder (NetworkX + edge arrays)
├── detectors/
│   ├── __init__.py
│   ├── fan_in_out.py             # fan_in_out detector
│   ├── cycle.py                  # cycle detector (time-ordered)
│   └── pass_through.py          # pass_through detector
├── tracer.py                     # TraceFlow forward tracer (dwell + retention)
├── features.py                   # Cluster feature builder
├── ranker.py                     # LightGBM ranker, class weights, model save/load
├── ablation.py                   # Four-way ablation runner
├── investigator.py               # Case reconstruction (SCC + path search)
├── narrator.py                   # Jinja2 template STR report generator
├── verifier.py                   # Fact verifier (numbers, accounts, timestamps)
├── agents/
│   ├── __init__.py
│   ├── ingest_agent.py
│   ├── tracer_agent.py
│   ├── scorer_agent.py
│   ├── investigator_agent.py
│   ├── narrator_agent.py
│   └── verifier_agent.py
└── templates/
    └── str_report.j2             # Jinja2 STR narrative template

api/
├── main.py                       # FastAPI app entry point
├── routers/
│   ├── cases.py                  # /api/cases endpoints
│   └── metrics.py                # /api/metrics endpoint
├── schemas.py                    # Pydantic response schemas
└── data_store.py                 # Pre-computed results loader

frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   ├── globals.css           # CSS custom properties (Contra Labs design tokens)
│   │   └── components.css
│   ├── components/
│   │   ├── CaseList.tsx          # Ranked case list sidebar
│   │   ├── CaseGraph.tsx         # Cytoscape.js subgraph component
│   │   ├── ReportPanel.tsx       # STR report with hover-to-edge
│   │   ├── MetricsTable.tsx      # Ablation metrics table
│   │   ├── Timeline.tsx          # Plotly transaction timeline
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       └── Spinner.tsx
│   ├── hooks/
│   │   ├── useCases.ts
│   │   ├── useCaseDetail.ts
│   │   └── useMetrics.ts
│   ├── services/
│   │   └── api.ts                # API client (fetch wrappers)
│   └── types/
│       └── index.ts              # TypeScript interfaces
└── tests/

results/                          # Output directory (git-ignored)
├── ablation.csv
├── clusters.parquet
└── evidence/
    └── {case_id}.json

tests/
├── test_loader.py
├── test_detectors.py
├── test_tracer.py
├── test_features.py
├── test_ranker.py
├── test_investigator.py
├── test_narrator.py
└── test_verifier.py

scripts/
├── run_pipeline.py               # End-to-end pipeline runner
├── run_ablation.py               # Ablation table generator
└── inject_patterns.py            # Synthetic ring injector for testing

data/                             # Git-ignored; IBM CSV goes here
└── .gitkeep

models/                           # Git-ignored; saved LightGBM model
└── .gitkeep

.env.example
requirements.txt
pyproject.toml
README.md
docker-compose.yml               # Optional: starts API + serves frontend
```

## Complexity Tracking

| Component | Justification | Simpler Alternative Rejected Because |
|-----------|--------------|--------------------------------------|
| Polars + DuckDB | IBM HI-Small has ~500k rows; pandas is 2–3x slower for time-sorted scans | Pandas acceptable but slower for demo |
| Numba acceleration for tracer | Forward traversal over millions of edges needs < 60s | Pure Python too slow; NetworkX on full graph not feasible |
| Cytoscape.js for graph | Hover-to-edge highlighting requires individual edge control | pyvis/Streamlit cannot do hover-to-edge on individual edges |
| Jinja2 templates + Verifier | Anti-hallucination requirement; every report fact must be in evidence | LLM-only approach unacceptable per PS 2.1 requirements |
