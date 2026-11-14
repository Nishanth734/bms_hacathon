# Feature Specification: TraceFlow NFT Fraud & AML Investigation Platform

## 1. Overview & Vision
TraceFlow is transformed from a single-screen prototype into a comprehensive, production-grade **NFT Fraud & Anti-Money Laundering (AML) Investigation Platform** tailored for forensic blockchain analysts, financial compliance officers, and marketplace fraud teams.

The platform provides an end-to-end investigative workbench:
- Ingestion and schema validation of NFT and multi-chain transaction datasets (drag-and-drop CSV, live RPC / Etherscan integration, and automated schema inference).
- Rigorous research graph algorithms: Temporal Multigraph construction, Strongly Connected Components (SCC), Bounded Temporal Cycle Detection ($t_1 < t_2 < \dots < t_k \le t_1 + \Delta T$), Per-Hop Dwell Time ($d(v) \le \tau$), and Flow Retention Conservation ($\rho(v) \in [0.85, 1.0]$).
- Algorithmic detection of NFT Wash Trading (same-token round-tripping to artificially inflate floor prices and claim marketplace rewards), Mule/Pass-Through Chains, and Smurfing/Fan-Out structuring.
- Explainable risk assessment scoring with transaction-level citations.
- Full case management system: status triage (New, Under Investigation, Escalated, Closed), analyst notes, and tags.
- Verified Anti-Hallucination Suspicious Transaction Report (STR) generation with interactive sentence-to-edge Cytoscape graph highlighting and PDF/Markdown exports.
- Meticulously styled using the Contra Labs design system (`nishanthdesign.txt`).

---

## 2. Target User Personas
1. **Senior Blockchain Fraud Analyst**: Investigates suspicious NFT collections, artificial floor inflation, and marketplace reward farming. Requires deep graph analysis, cycle inspection, and full transaction trails.
2. **AML Compliance Officer**: Triages high-risk wallet clusters, evaluates regulatory exposure, writes and files verified Suspicious Activity Reports (SARs/STRs).
3. **Marketplace Risk Team**: Monitors active liquidity pools and sales volume to flag wash trading rings in near real-time.

---

## 3. Core Functional Requirements (FR)

### Ingestion & Dataset Management
- **FR-001**: Drag-and-drop CSV upload with instant preview (first 10 rows), column type inference, and validation error reporting.
- **FR-002**: Automatic schema detection supporting both:
  - **NFT Schema**: `tx_hash`, `timestamp`, `seller_address` (from), `buyer_address` (to), `token_id`, `collection_address`, `price_eth` / `amount`, `currency`.
  - **Bank / AML Schema**: `Timestamp`, `From Bank`, `Account`, `To Bank`, `Account.1`, `Amount Received`, `Receiving Currency`, `Amount Paid`, `Payment Currency`, `Is Laundering`.
- **FR-003**: Dataset library management: switch active dataset, view metadata (row count, unique wallets, date range, total volume), and delete datasets.
- **FR-004**: Provide authentic sample datasets (NFT Wash Trading with planted rings, plus IBM AML dataset).

### Algorithmic Research Engine
- **FR-005**: Temporal Multigraph Builder supporting fast vectorized edge array indexing and subgraphs capped at $\le 30$ nodes for clear visual analysis.
- **FR-006**: Strongly Connected Components (SCC) computation to identify tightly knit closed wallet clusters.
- **FR-007**: Forward Time-Ordered Cycle Detection finding circular flows ($A \to B \to C \to A$) respecting monotonically increasing timestamps within a configurable sliding window $\Delta T$.
- **FR-008**: Per-Hop Dwell Time ($d(v)$) calculation detecting rapid mule pass-throughs ($\le 1\text{h}$) and flow retention ($\rho(v) \in [0.85, 1.0]$).
- **FR-009**: Specific NFT Wash Trading Detector:
  - Same-token circular transfers (`token_id` returned to original owner or confederate wallet within window $\Delta T$).
  - Coordinated volume churn (inflating collection volume without net change in beneficial ownership).
- **FR-010**: Explainable Risk Scorer combining structural graph features, temporal dwell features, and flow conservation into an overall risk score $[0, 1]$ with feature attribution.

### Multi-Page Analyst Workbench
- **FR-011**: Eight dedicated navigation pages:
  1. **Overview**: Key metrics, risk distribution, recent high-priority alerts, methodology overview.
  2. **Dataset Management**: Upload wizard, schema mapping, dataset selector, table preview.
  3. **Analysis Runner**: Configurable pipeline execution with real-time step progress and run logs.
  4. **Wallet Network**: Interactive Cytoscape graph, cycle highlighting, wallet inspector panel.
  5. **Fraud Detection**: Deep dive into typologies (Wash Trading, Cyclic, Mule Chains, Smurfing) with formula explanations and flagged clusters.
  6. **Risk Assessment**: Wallet ranking table, transaction risk indicators, risk factor breakdown.
  7. **Investigation Cases**: Case kanban/table, priority sorting, status updates, analyst notes.
  8. **Evidence & Reports**: Verified narrative generator, regex anti-hallucination audit, export options (Markdown, JSON, Print/PDF).

### Design & Visual System
- **FR-012**: Strict adherence to Contra Labs (`nishanthdesign.txt`):
  - Canvas: `#fbfaf6` (Warm Parchment), `#fcfbf7` (Ivory Cream).
  - Ink: `#2b2b29` (Charcoal Ink), `#494444` (Secondary Ink), `#777070` (Muted).
  - Accents: `#c8e1dd` (Mint Wash), `#296a6c` (Deep Teal), `#918f66` (Olive Moss).
  - Typography: `Source Serif 4` serif headings, `Inter` for body and data tables.
  - Radii: 8px cards, 24px/99px pill buttons and badges. No gratuitous borders or heavy shadows.
