# Data Model: TraceFlow NFT Fraud & AML Platform

## 1. Relational Entities (SQLite / SQLAlchemy)

### `Dataset`
- `id`: `String(36)` (UUID, Primary Key)
- `name`: `String(255)` (Filename / Title)
- `schema_type`: `String(32)` (`nft` or `banking`)
- `row_count`: `Integer`
- `wallet_count`: `Integer`
- `total_volume`: `Float`
- `currency`: `String(16)`
- `file_path`: `String(512)`
- `status`: `String(32)` (`uploaded`, `processing`, `analyzed`, `error`)
- `created_at`: `DateTime`

### `Wallet`
- `id`: `String(64)` (Address, Primary Key per dataset)
- `dataset_id`: `String(36)` (Foreign Key -> Dataset.id)
- `risk_score`: `Float` (0.0 to 1.0)
- `in_flow`: `Float`
- `out_flow`: `Float`
- `tx_count`: `Integer`
- `dwell_time_avg_hours`: `Float`
- `retention_ratio`: `Float`
- `is_scc_member`: `Boolean`
- `scc_id`: `Integer`
- `flagged_typologies`: `JSON` (List of strings)

### `Transaction`
- `tx_hash`: `String(66)` (Primary Key per dataset)
- `dataset_id`: `String(36)` (Foreign Key -> Dataset.id)
- `timestamp`: `DateTime`
- `from_address`: `String(64)`
- `to_address`: `String(64)`
- `amount`: `Float`
- `currency`: `String(16)`
- `token_id`: `String(64)` (Nullable, for NFTs)
- `collection_address`: `String(64)` (Nullable)
- `is_wash_trade`: `Boolean`
- `is_flagged`: `Boolean`

### `FraudCluster` (Case Source)
- `cluster_id`: `String(36)` (UUID, Primary Key)
- `dataset_id`: `String(36)` (Foreign Key -> Dataset.id)
- `typology`: `JSON` (List of typologies)
- `primary_typology`: `String(64)` (`wash_trading`, `cycle`, `pass_through`, `fan_out`)
- `risk_score`: `Float`
- `size`: `Integer` (Node count)
- `edge_count`: `Integer`
- `duration_hours`: `Float`
- `token_ids`: `JSON`
- `graph_json`: `JSON` (Bounded <= 30 nodes NetworkX representation)
- `evidence_json`: `JSON`

### `InvestigationCase`
- `case_id`: `String(36)` (UUID, Primary Key)
- `cluster_id`: `String(36)` (Foreign Key -> FraudCluster.cluster_id)
- `dataset_id`: `String(36)`
- `title`: `String(255)`
- `status`: `String(32)` (`NEW`, `UNDER_INVESTIGATION`, `ESCALATED`, `RESOLVED`, `FALSE_POSITIVE`)
- `priority`: `String(16)` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
- `assigned_analyst`: `String(128)`
- `notes`: `Text`
- `tags`: `JSON`
- `created_at`: `DateTime`
- `updated_at`: `DateTime`

### `InvestigationReport`
- `report_id`: `String(36)` (UUID, Primary Key)
- `case_id`: `String(36)` (Foreign Key -> InvestigationCase.case_id)
- `title`: `String(255)`
- `narrative_markdown`: `Text`
- `sentences`: `JSON` (List of { sentence_id, text, edge_ids, timestamp_range })
- `verification_status`: `String(16)` (`VERIFIED`, `FAILED`)
- `unverified_claims`: `JSON`
- `created_at`: `DateTime`
