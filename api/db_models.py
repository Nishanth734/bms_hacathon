from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from api.database import Base

class DatasetModel(Base):
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    schema_type = Column(String(32), default="nft")  # "nft" | "banking"
    row_count = Column(Integer, default=0)
    wallet_count = Column(Integer, default=0)
    total_volume = Column(Float, default=0.0)
    currency = Column(String(16), default="ETH")
    file_path = Column(String(512), nullable=False)
    status = Column(String(32), default="ready")     # "ready" | "processing" | "analyzed" | "error"
    created_at = Column(DateTime, default=datetime.utcnow)

    wallets = relationship("WalletModel", back_populates="dataset", cascade="all, delete-orphan")
    transactions = relationship("TransactionModel", back_populates="dataset", cascade="all, delete-orphan")
    clusters = relationship("FraudClusterModel", back_populates="dataset", cascade="all, delete-orphan")
    cases = relationship("InvestigationCaseModel", back_populates="dataset", cascade="all, delete-orphan")


class WalletModel(Base):
    __tablename__ = "wallets"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), primary_key=True)
    risk_score = Column(Float, default=0.0)
    in_flow = Column(Float, default=0.0)
    out_flow = Column(Float, default=0.0)
    tx_count = Column(Integer, default=0)
    dwell_time_avg_hours = Column(Float, default=0.0)
    retention_ratio = Column(Float, default=0.0)
    is_scc_member = Column(Boolean, default=False)
    scc_id = Column(Integer, nullable=True)
    flagged_typologies = Column(JSON, default=list)

    dataset = relationship("DatasetModel", back_populates="wallets")


class TransactionModel(Base):
    __tablename__ = "transactions"

    tx_hash = Column(String(66), primary_key=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), primary_key=True)
    timestamp = Column(Float, nullable=False)
    from_address = Column(String(64), nullable=False)
    to_address = Column(String(64), nullable=False)
    amount = Column(Float, default=0.0)
    currency = Column(String(16), default="ETH")
    token_id = Column(String(64), nullable=True)
    collection_address = Column(String(64), nullable=True)
    is_wash_trade = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)

    dataset = relationship("DatasetModel", back_populates="transactions")


class FraudClusterModel(Base):
    __tablename__ = "fraud_clusters"

    cluster_id = Column(String(36), primary_key=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), nullable=False)
    typology = Column(JSON, default=list)
    primary_typology = Column(String(64), nullable=False)
    risk_score = Column(Float, default=0.0)
    size = Column(Integer, default=0)
    edge_count = Column(Integer, default=0)
    duration_hours = Column(Float, default=0.0)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    token_ids = Column(JSON, default=list)
    graph_json = Column(JSON, default=dict)
    evidence_json = Column(JSON, default=dict)

    dataset = relationship("DatasetModel", back_populates="clusters")
    cases = relationship("InvestigationCaseModel", back_populates="cluster")


class InvestigationCaseModel(Base):
    __tablename__ = "investigation_cases"

    case_id = Column(String(36), primary_key=True)
    cluster_id = Column(String(36), ForeignKey("fraud_clusters.cluster_id"), nullable=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), nullable=False)
    title = Column(String(255), nullable=False)
    status = Column(String(32), default="NEW")       # "NEW" | "UNDER_INVESTIGATION" | "ESCALATED" | "RESOLVED" | "FALSE_POSITIVE"
    priority = Column(String(16), default="HIGH")    # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    assigned_analyst = Column(String(128), default="Lead AML Investigator")
    notes = Column(Text, default="")
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dataset = relationship("DatasetModel", back_populates="cases")
    cluster = relationship("FraudClusterModel", back_populates="cases")
    reports = relationship("InvestigationReportModel", back_populates="case", cascade="all, delete-orphan")


class InvestigationReportModel(Base):
    __tablename__ = "investigation_reports"

    report_id = Column(String(36), primary_key=True)
    case_id = Column(String(36), ForeignKey("investigation_cases.case_id"), nullable=False)
    title = Column(String(255), nullable=False)
    narrative_markdown = Column(Text, nullable=False)
    sentences = Column(JSON, default=list)
    verification_status = Column(String(16), default="VERIFIED")  # "VERIFIED" | "FAILED"
    unverified_claims = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("InvestigationCaseModel", back_populates="reports")
