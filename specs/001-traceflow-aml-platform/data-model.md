# Data Model: TraceFlow AML Investigation Platform

## Entities

### Transaction (Edge)

Represents a single financial transfer between two accounts.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| tx_id | string | Required, unique | Original CSV row identifier or generated hash |
| ts | datetime | Required, indexed | UTC timestamp; edges must be time-sorted |
| src | string | Required | Node ID: `{from_bank}_{from_account}` |
| dst | string | Required | Node ID: `{to_bank}_{to_account}` |
| amount | float64 | Required, ≥ 0 | Amount received (or paid; documented in loader) |
| currency | string | Required | ISO 4217 currency code |
| label | int8 | Required, {0, 1} | Ground-truth: 1 = illicit (synthetic), 0 = legitimate |
| payment_format | string | Optional | Wire, check, ACH, etc. |

**Relationships**: Many-to-one with Node (src), Many-to-one with Node (dst)

---

### Node (Account)

Represents a financial account in the transaction network.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| node_id | string | Required, unique | `{bank}_{account}` |
| bank | string | Required | Bank identifier from CSV |
| account | string | Required | Account number from CSV |
| in_degree | int32 | Computed | Number of incoming transactions |
| out_degree | int32 | Computed | Number of outgoing transactions |
| in_amount | float64 | Computed | Total amount received |
| out_amount | float64 | Computed | Total amount sent |

---

### Cluster

A candidate suspicious subgraph returned by a detector or the TraceFlow tracer.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| cluster_id | string | Required, unique | UUID or hash of (typology, accounts, start_time) |
| typology | list[string] | Required, non-empty | Subset of: ["fan_out", "fan_in", "cycle", "pass_through"] |
| primary_typology | string | Required | Highest-scoring typology |
| accounts | list[string] | Required, 2–30 items | Node IDs in the cluster |
| edge_ids | list[string] | Required | Transaction IDs forming the cluster |
| start_time | datetime | Required | Earliest edge timestamp |
| end_time | datetime | Required | Latest edge timestamp |
| duration_hours | float64 | Computed | (end_time - start_time) in hours |
| size | int32 | Computed, ≤ 30 | Number of accounts |
| risk_score | float64 | Optional, [0,1] | Set by ranker; None before ranking |
| label | int8 | Optional, {0, 1} | Illicit if ≥ 50% of edge_ids have label=1 |

**Relationships**: Many-to-many with Transaction via edge_ids; Many-to-many with Node via accounts

---

### TraceCluster (extends Cluster)

A cluster returned specifically by the TraceFlow forward tracer, with per-hop dwell and retention.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| dwell | dict[node_id → float64] | Required | Dwell time in seconds per node in the trace |
| retention | dict[node_id → float64] | Required | Retention ratio per node; NaN if in-flow is zero |
| end_to_end_retention | float64 | Computed | Product of all per-node retentions in the chain |
| chain_hops | int32 | Required | Number of hops in the trace |

---

### FeatureRow (ML Input)

One row in the cluster feature table fed to LightGBM.

| Field | Type | Notes |
|-------|------|-------|
| cluster_id | string | Join key |
| size | float64 | Number of accounts |
| duration_hours | float64 | Cluster time span |
| edge_count | float64 | Number of transactions |
| amount_total | float64 | Sum of all edge amounts |
| amount_mean | float64 | Mean edge amount |
| amount_std | float64 | Std dev of edge amounts |
| max_in_degree | float64 | Max in-degree of any account in cluster |
| max_out_degree | float64 | Max out-degree of any account in cluster |
| fan_out_count | float64 | Number of nodes with out_degree ≥ 5 in window |
| cycle_count | float64 | Number of detected cycles |
| pass_through_count | float64 | Number of pass-through hops |
| mean_dwell_seconds | float64 | Mean dwell across all nodes (NaN if no TraceFlow) |
| mean_retention | float64 | Mean retention across all nodes (NaN if no TraceFlow) |
| end_to_end_retention | float64 | Product retention of longest chain |
| is_fan_out | int8 | 1 if typology includes fan_out |
| is_fan_in | int8 | 1 if typology includes fan_in |
| is_cycle | int8 | 1 if typology includes cycle |
| is_pass_through | int8 | 1 if typology includes pass_through |
| label | int8 | Target: 1 = illicit cluster |

---

### EvidenceObject

Structured evidence for one flagged case, used for report generation and verification.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| cluster_id | string | Required | Links to Cluster |
| typology | list[string] | Required | Typology labels |
| primary_typology | string | Required | For report title |
| window_start | datetime | Required | Earliest timestamp in evidence |
| window_end | datetime | Required | Latest timestamp in evidence |
| accounts | list[string] | Required | Account node_ids involved |
| edges | list[EdgeEvidence] | Required | Full edge details |
| dwell | dict[node_id → float64] | Required | Dwell seconds per node |
| retention | dict[node_id → float64] | Required | Retention ratio per node |
| risk_score | float64 | Required | From ranker |

**EdgeEvidence** sub-entity:
| Field | Type |
|-------|------|
| edge_id | string |
| src | string |
| dst | string |
| amount | float64 |
| currency | string |
| ts | datetime |

---

### STRReport

A Suspicious Transaction Report generated from an EvidenceObject.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| case_id | string | Required | Equals cluster_id |
| generated_at | datetime | Required | Report generation timestamp |
| sentences | list[ReportSentence] | Required | Ordered sentences |
| template_used | bool | Required | True if LLM was not used or fell back |
| verifier_pass | bool | Required | True if Verifier returned PASS |
| verifier_details | string | Optional | Failure reason if verifier_pass = False |

**ReportSentence** sub-entity:
| Field | Type |
|-------|------|
| text | string |
| edge_ids | list[string] |
| sentence_index | int32 |

---

### AblationRow

One row in the ablation results table.

| Field | Type | Notes |
|-------|------|-------|
| method | string | "A_threshold", "B_graph_gbm", "C_dwell_retention", "D_traceflow" |
| precision | float64 | Minority-class precision |
| recall | float64 | Minority-class recall |
| f1 | float64 | Minority-class F1 |
| pr_auc | float64 | Area under precision-recall curve |
| precision_at_k | float64 | Precision in top-k ranked clusters |
| false_alerts_per_day | float64 | False positives / test period days |

## State Transitions

### Cluster Lifecycle

```
Raw CSV
  → [Loader] → Transaction Table (sorted)
  → [Graph Builder] → Temporal Multigraph (edge arrays + NetworkX case graph)
  → [Detectors / Tracer] → Clusters (unscored)
  → [Feature Builder] → FeatureRows
  → [Ranker] → Clusters (scored, risk_score set)
  → [Investigator] → EvidenceObject
  → [Narrator] → STRReport (draft)
  → [Verifier] → STRReport (verified, verifier_pass set)
  → [API] → JSON response
  → [Dashboard] → Rendered case view
```

## Validation Rules

- `cluster.size` ≤ 30 (enforced before any NetworkX operation)
- `cluster.accounts` and `cluster.edge_ids` must be non-empty
- `evidence.edges` must be a subset of `cluster.edge_ids`
- Every `edge_id` in an STRReport sentence must exist in `evidence.edges`
- Every account ID in report text must exist in `evidence.accounts`
- Every numeric amount in report text must match an `evidence.edges[*].amount` within 0.01 tolerance
- Every timestamp in report text must match an `evidence.edges[*].ts` within 60 seconds
- `retention` values of NaN are excluded from filtering and reported as "unknown"
