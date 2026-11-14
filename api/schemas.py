from pydantic import BaseModel
from typing import Optional


class GraphNode(BaseModel):
    id: str
    label: str
    in_degree: int
    out_degree: int
    is_suspicious: bool = False


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    amount: float
    currency: str
    ts: str  # ISO format
    label: int = 0


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ReportSentence(BaseModel):
    text: str
    edge_ids: list[str]
    sentence_index: int


class STRReport(BaseModel):
    case_id: str
    generated_at: str
    template_used: bool
    verifier_pass: bool
    verifier_details: list[str] = []
    sentences: list[ReportSentence]


class CaseListItem(BaseModel):
    cluster_id: str
    typology: list[str]
    primary_typology: str
    risk_score: float
    size: int
    duration_hours: float
    start_time: str
    end_time: str
    account_count: int
    edge_count: int


class CaseListResponse(BaseModel):
    total: int
    cases: list[CaseListItem]


class NodeDwell(BaseModel):
    node_id: str
    dwell_seconds: float


class NodeRetention(BaseModel):
    node_id: str
    retention: Optional[float]


class CaseDetail(BaseModel):
    cluster_id: str
    typology: list[str]
    primary_typology: str
    risk_score: float
    window_start: str
    window_end: str
    accounts: list[str]
    dwell: dict[str, Optional[float]]
    retention: dict[str, Optional[float]]
    end_to_end_retention: Optional[float]
    graph: GraphData
    report: STRReport


class AblationRow(BaseModel):
    method: str
    label: str
    precision: float
    recall: float
    f1: float
    pr_auc: float
    precision_at_k: float
    false_alerts_per_day: float


class MetricsResponse(BaseModel):
    ablation: list[AblationRow]
