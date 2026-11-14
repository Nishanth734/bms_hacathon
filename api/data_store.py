"""
Loads pre-computed results from the results/ directory.
If results don't exist, returns demo/placeholder data so the dashboard still runs.
"""
import polars as pl
import json
import csv
from pathlib import Path
from .schemas import (
    GraphNode, GraphEdge, GraphData, ReportSentence, STRReport,
    CaseListItem, CaseListResponse, CaseDetail, AblationRow, MetricsResponse,
)


class DataStore:
    def __init__(self, results_dir: str = "results"):
        self.results_dir = Path(results_dir)
        self.clusters: list[dict] = []
        self.evidence_cache: dict[str, dict] = {}
        self.ablation: list[dict] = []
        self._load()

    def _load(self):
        """Load all pre-computed results. Use demo data if files don't exist."""
        # Load clusters from parquet or use demo data
        clusters_path = self.results_dir / "clusters.parquet"
        if clusters_path.exists():
            df = pl.read_parquet(clusters_path)
            self.clusters = df.to_dicts()
        else:
            self.clusters = self._demo_clusters()

        # Sort by risk_score descending
        self.clusters.sort(key=lambda x: x.get("risk_score", 0), reverse=True)

        # Load ablation from CSV or use demo data
        ablation_path = self.results_dir / "ablation.csv"
        if ablation_path.exists():
            with open(ablation_path) as f:
                reader = csv.DictReader(f)
                self.ablation = list(reader)
        else:
            self.ablation = self._demo_ablation()

    def _demo_clusters(self) -> list[dict]:
        """Generate realistic demo cluster data for dashboard testing."""
        import random
        from datetime import datetime, timedelta

        random.seed(42)

        typologies = [["cycle"], ["fan_out"], ["pass_through"], ["cycle", "fan_out"]]
        clusters = []
        base_time = datetime(2022, 1, 15, 8, 0, 0)

        for i in range(25):
            typs = random.choice(typologies)
            start = base_time + timedelta(hours=random.randint(0, 100))
            end = start + timedelta(hours=random.uniform(1, 8))
            n_accounts = random.randint(3, 15)
            n_edges = random.randint(n_accounts, n_accounts * 3)
            accounts = [
                f"Bank{chr(65 + j)}_{1000 + random.randint(1, 999)}"
                for j in range(n_accounts)
            ]
            edge_ids = [f"tx{i * 100 + k:05d}" for k in range(n_edges)]

            clusters.append(
                {
                    "cluster_id": f"cluster_{i:03d}",
                    "typology": typs,
                    "primary_typology": typs[0],
                    "risk_score": round(random.uniform(0.3, 0.98), 3),
                    "size": n_accounts,
                    "duration_hours": round(
                        (end - start).total_seconds() / 3600, 2
                    ),
                    "start_time": start.isoformat() + "Z",
                    "end_time": end.isoformat() + "Z",
                    "accounts": accounts,
                    "edge_ids": edge_ids,
                    "dwell": {
                        a: round(random.uniform(600, 7200), 1)
                        for a in accounts[1:-1]
                    },
                    "retention": {
                        a: round(random.uniform(0.85, 1.0), 4)
                        for a in accounts[1:-1]
                    },
                    "end_to_end_retention": round(random.uniform(0.70, 0.98), 4),
                    "chain_hops": len(accounts) - 1,
                    "label": 1 if random.random() > 0.3 else 0,
                }
            )

        return clusters

    def _demo_ablation(self) -> list[dict]:
        return [
            {
                "method": "A_threshold",
                "label": "Threshold Baseline",
                "precision": "0.012",
                "recall": "0.891",
                "f1": "0.024",
                "pr_auc": "0.058",
                "precision_at_k": "0.14",
                "false_alerts_per_day": "420.0",
            },
            {
                "method": "B_graph_gbm",
                "label": "Graph Features + GBM",
                "precision": "0.41",
                "recall": "0.72",
                "f1": "0.52",
                "pr_auc": "0.63",
                "precision_at_k": "0.68",
                "false_alerts_per_day": "42.0",
            },
            {
                "method": "C_dwell_retention",
                "label": "Graph + Dwell/Retention",
                "precision": "0.48",
                "recall": "0.74",
                "f1": "0.58",
                "pr_auc": "0.67",
                "precision_at_k": "0.74",
                "false_alerts_per_day": "36.0",
            },
            {
                "method": "D_traceflow",
                "label": "TraceFlow (Full System)",
                "precision": "0.55",
                "recall": "0.76",
                "f1": "0.64",
                "pr_auc": "0.71",
                "precision_at_k": "0.80",
                "false_alerts_per_day": "28.0",
            },
        ]

    def _load_evidence(self, cluster_id: str) -> dict:
        """Load evidence from JSON file or generate demo evidence."""
        if cluster_id in self.evidence_cache:
            return self.evidence_cache[cluster_id]

        evidence_path = self.results_dir / "evidence" / f"{cluster_id}.json"
        if evidence_path.exists():
            with open(evidence_path) as f:
                evidence = json.load(f)
        else:
            evidence = self._demo_evidence(cluster_id)

        self.evidence_cache[cluster_id] = evidence
        return evidence

    def _demo_evidence(self, cluster_id: str) -> dict | None:
        """Generate demo evidence for a cluster."""
        import random
        from datetime import datetime, timedelta

        # Find the cluster
        cluster = next(
            (c for c in self.clusters if c["cluster_id"] == cluster_id), None
        )
        if not cluster:
            return None

        accounts = cluster["accounts"]
        edges = []
        base_time = datetime.fromisoformat(
            cluster["start_time"].replace("Z", "")
        )

        for i, edge_id in enumerate(cluster["edge_ids"]):
            src = accounts[i % len(accounts)]
            dst = accounts[(i + 1) % len(accounts)]
            ts = base_time + timedelta(hours=i * 0.5)
            edges.append(
                {
                    "edge_id": edge_id,
                    "src": src,
                    "dst": dst,
                    "amount": round(random.uniform(10000, 500000), 2),
                    "currency": "USD",
                    "ts": ts.isoformat() + "Z",
                }
            )

        # Build a demo STR report
        sentences = []
        for i, edge in enumerate(edges[:5]):  # First 5 edges in report
            sentences.append(
                {
                    "text": (
                        f"Account {edge['src']} transferred "
                        f"${edge['amount']:,.2f} {edge['currency']} to "
                        f"{edge['dst']} on {edge['ts'][:10]}. "
                        "This transaction is considered suspicious."
                    ),
                    "edge_ids": [edge["edge_id"]],
                    "sentence_index": i,
                }
            )

        # Add summary sentences
        sentences.append(
            {
                "text": (
                    f"The detected pattern is a suspected "
                    f"{cluster['primary_typology'].replace('_', ' ')} involving "
                    f"{len(accounts)} accounts over {cluster['duration_hours']:.1f} hours."
                ),
                "edge_ids": cluster["edge_ids"][:3],
                "sentence_index": len(sentences),
            }
        )

        sentences.append(
            {
                "text": (
                    "All findings are SUSPICIOUS and have not been confirmed as laundering. "
                    "Labels are synthetic experimental ground truth."
                ),
                "edge_ids": [],
                "sentence_index": len(sentences),
            }
        )

        return {
            "cluster_id": cluster_id,
            "typology": cluster["typology"],
            "primary_typology": cluster["primary_typology"],
            "window_start": cluster["start_time"],
            "window_end": cluster["end_time"],
            "accounts": accounts,
            "dwell": cluster.get("dwell", {}),
            "retention": cluster.get("retention", {}),
            "end_to_end_retention": cluster.get("end_to_end_retention"),
            "risk_score": cluster["risk_score"],
            "edges": edges,
            "report": {
                "case_id": cluster_id,
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "template_used": True,
                "verifier_pass": True,
                "verifier_details": [],
                "sentences": sentences,
            },
        }

    def get_cases(
        self,
        limit: int = 50,
        offset: int = 0,
        typology_filter: str | None = None,
        min_score: float = 0.0,
    ) -> dict:
        cases = self.clusters
        if typology_filter:
            cases = [
                c for c in cases if typology_filter in c.get("typology", [])
            ]
        if min_score > 0:
            cases = [
                c for c in cases if c.get("risk_score", 0) >= min_score
            ]
        total = len(cases)
        cases = cases[offset : offset + limit]
        return {
            "total": total,
            "cases": [self._cluster_to_list_item(c) for c in cases],
        }

    def _cluster_to_list_item(self, c: dict) -> dict:
        return {
            "cluster_id": c["cluster_id"],
            "typology": c.get("typology", []),
            "primary_typology": c.get(
                "primary_typology",
                c.get("typology", ["unknown"])[0],
            ),
            "risk_score": float(c.get("risk_score", 0)),
            "size": c.get("size", len(c.get("accounts", []))),
            "duration_hours": float(c.get("duration_hours", 0)),
            "start_time": c.get("start_time", ""),
            "end_time": c.get("end_time", ""),
            "account_count": len(c.get("accounts", [])),
            "edge_count": len(c.get("edge_ids", [])),
        }

    def get_case_detail(self, case_id: str) -> dict | None:
        cluster = next(
            (c for c in self.clusters if c["cluster_id"] == case_id), None
        )
        if not cluster:
            return None

        evidence = self._load_evidence(case_id)
        if not evidence:
            return None

        # Build graph data
        accounts = cluster["accounts"]
        edges = evidence.get("edges", [])

        nodes = []
        seen_nodes: set[str] = set()
        for edge in edges:
            for node_id in [edge["src"], edge["dst"]]:
                if node_id not in seen_nodes:
                    seen_nodes.add(node_id)
                    nodes.append(
                        {
                            "id": node_id,
                            "label": node_id,
                            "in_degree": sum(
                                1 for e in edges if e["dst"] == node_id
                            ),
                            "out_degree": sum(
                                1 for e in edges if e["src"] == node_id
                            ),
                            "is_suspicious": True,
                        }
                    )

        graph_edges = [
            {
                "id": e["edge_id"],
                "source": e["src"],
                "target": e["dst"],
                "amount": float(e["amount"]),
                "currency": e.get("currency", "USD"),
                "ts": e["ts"],
                "label": 1,
            }
            for e in edges
        ]

        return {
            "cluster_id": case_id,
            "typology": cluster["typology"],
            "primary_typology": cluster["primary_typology"],
            "risk_score": float(cluster["risk_score"]),
            "window_start": cluster["start_time"],
            "window_end": cluster["end_time"],
            "accounts": accounts,
            "dwell": {
                k: float(v) if v is not None else None
                for k, v in cluster.get("dwell", {}).items()
            },
            "retention": {
                k: float(v) if v is not None else None
                for k, v in cluster.get("retention", {}).items()
            },
            "end_to_end_retention": cluster.get("end_to_end_retention"),
            "graph": {"nodes": nodes, "edges": graph_edges},
            "report": evidence.get(
                "report",
                {
                    "case_id": case_id,
                    "generated_at": "",
                    "template_used": True,
                    "verifier_pass": True,
                    "verifier_details": [],
                    "sentences": [],
                },
            ),
        }

    def get_metrics(self) -> dict:
        label_map = {
            "A_threshold": "Threshold Baseline",
            "B_graph_gbm": "Graph Features + GBM",
            "C_dwell_retention": "Graph + Dwell/Retention",
            "D_traceflow": "TraceFlow (Full System)",
        }
        ablation = []
        for row in self.ablation:
            ablation.append(
                {
                    "method": row["method"],
                    "label": row.get(
                        "label", label_map.get(row["method"], row["method"])
                    ),
                    "precision": float(row["precision"]),
                    "recall": float(row["recall"]),
                    "f1": float(row["f1"]),
                    "pr_auc": float(row["pr_auc"]),
                    "precision_at_k": float(row["precision_at_k"]),
                    "false_alerts_per_day": float(row["false_alerts_per_day"]),
                }
            )
        return {"ablation": ablation}
