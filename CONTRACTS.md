# API Contract: GET /api/cases

**Purpose**: Returns the ranked list of suspicious clusters, sorted by risk score descending.

**Method**: GET  
**Path**: `/api/cases`  
**Auth**: None (local demo)

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Max number of cases to return |
| `offset` | int | 0 | Pagination offset |
| `typology` | string | null | Filter by typology: fan_out, fan_in, cycle, pass_through |
| `min_score` | float | 0.0 | Minimum risk score filter |

## Response

**Status**: 200 OK  
**Content-Type**: application/json

```json
{
  "total": 142,
  "cases": [
    {
      "cluster_id": "abc123",
      "typology": ["cycle", "pass_through"],
      "primary_typology": "cycle",
      "risk_score": 0.923,
      "size": 5,
      "duration_hours": 3.2,
      "start_time": "2022-01-15T08:30:00Z",
      "end_time": "2022-01-15T11:42:00Z",
      "account_count": 5,
      "edge_count": 7
    }
  ]
}
```

## Error Responses

| Status | Description |
|--------|-------------|
| 500 | Pre-computed results not found; run pipeline first |

---

# API Contract: GET /api/cases/{case_id}

**Purpose**: Returns full case detail: evidence object, subgraph, and STR report.

**Method**: GET  
**Path**: `/api/cases/{case_id}`

## Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `case_id` | string | The cluster_id of the case |

## Response

**Status**: 200 OK

```json
{
  "cluster_id": "abc123",
  "typology": ["cycle"],
  "primary_typology": "cycle",
  "risk_score": 0.923,
  "window_start": "2022-01-15T08:30:00Z",
  "window_end": "2022-01-15T11:42:00Z",
  "accounts": ["BankA_001", "BankB_002", "BankC_003"],
  "dwell": {"BankB_002": 1800.0, "BankC_003": 900.0},
  "retention": {"BankB_002": 0.97, "BankC_003": 0.95},
  "graph": {
    "nodes": [
      {"id": "BankA_001", "label": "BankA_001", "in_degree": 1, "out_degree": 2}
    ],
    "edges": [
      {
        "id": "tx001",
        "source": "BankA_001",
        "target": "BankB_002",
        "amount": 50000.0,
        "currency": "USD",
        "ts": "2022-01-15T08:30:00Z"
      }
    ]
  },
  "report": {
    "case_id": "abc123",
    "generated_at": "2026-11-14T10:00:00Z",
    "template_used": true,
    "verifier_pass": true,
    "sentences": [
      {
        "text": "Account BankA_001 sent $50,000 to BankB_002 at 08:30 UTC on 15 Jan 2022.",
        "edge_ids": ["tx001"],
        "sentence_index": 0
      }
    ]
  }
}
```

## Error Responses

| Status | Description |
|--------|-------------|
| 404 | Case not found |

---

# API Contract: GET /api/metrics

**Purpose**: Returns the four-way ablation metrics table.

**Method**: GET  
**Path**: `/api/metrics`

## Response

**Status**: 200 OK

```json
{
  "ablation": [
    {
      "method": "A_threshold",
      "label": "Threshold Baseline",
      "precision": 0.012,
      "recall": 0.891,
      "f1": 0.024,
      "pr_auc": 0.058,
      "precision_at_k": 0.14,
      "false_alerts_per_day": 420.0
    },
    {
      "method": "B_graph_gbm",
      "label": "Graph Features + GBM",
      "precision": 0.41,
      "recall": 0.72,
      "f1": 0.52,
      "pr_auc": 0.63,
      "precision_at_k": 0.68,
      "false_alerts_per_day": 42.0
    },
    {
      "method": "C_dwell_retention",
      "label": "Graph + Dwell/Retention",
      "precision": 0.48,
      "recall": 0.74,
      "f1": 0.58,
      "pr_auc": 0.67,
      "precision_at_k": 0.74,
      "false_alerts_per_day": 36.0
    },
    {
      "method": "D_traceflow",
      "label": "TraceFlow (Full System)",
      "precision": 0.55,
      "recall": 0.76,
      "f1": 0.64,
      "pr_auc": 0.71,
      "precision_at_k": 0.80,
      "false_alerts_per_day": 28.0
    }
  ]
}
```

---

# API Contract: GET /api/health

**Purpose**: Health check endpoint.

**Method**: GET  
**Path**: `/api/health`

## Response

```json
{"status": "ok", "version": "1.0.0"}
```
