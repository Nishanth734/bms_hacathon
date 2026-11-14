# TraceFlow: Team Handoff for PS 2.1

Nov 14, 2026 · @blank

TraceFlow is our PS 2.1 entry: a time-respecting money-flow tracer that finds laundering rings, ranks them with graph features, and writes an evidence-linked case report. This doc is the single reference for the whole team.

## Final solution: how we solve PS 2.1

The full scope stays. We build in risk order, so a working demo exists at every milestone, and AI-assisted coding does the typing while the team owns the design and the checking.

### 1. Requirement coverage

Each row is a PS 2.1 requirement, what we build for it, and the test that proves it is done.

| # | PS 2.1 requirement | What we build | Done when |
| --- | --- | --- | --- |
| 1 | Temporal, directed, weighted graph | Multigraph with timestamp, amount and transaction ID on every edge | A test confirms every edge has all three and edges are time-sorted |
| 2 | Fan-in / fan-out dispersion | `fan_in_out` detector | Finds a planted fan-out and fan-in; ignores one whose edges fall outside the window |
| 3 | Cyclic round-tripping | `cycle` detector, time-ordered | Finds a planted A to B to C to A loop; rejects the same loop with edges out of time order |
| 4 | Rapid pass-through (mule) chains | `pass_through` detector, then TraceFlow dwell and retention | Finds a planted chain with short dwell; rejects one with long dwell |
| 5 | Rank suspicious clusters by risk | Cluster builder and LightGBM ranker | A ranked cluster list with scores; precision at k reported |
| 6 | Label each alert with its typology | A typology field on every alert | Every alert carries at least one of the three labels |
| 7 | Plain-language summary of the money trail | Evidence object, template report, optional LLM rewording, verifier | The verifier passes every report and catches a deliberately wrong number in a test |
| 8 | Precision, recall, F1 against a threshold baseline on a labeled dataset | Four-way ablation on IBM HI-Small with a chronological split | One table with precision, recall, F1 and PR-AUC for the baseline and for us on the same test set |

### 2. Milestones, with a working demo at the end of each

| Milestone | Build | Target hours (24-hour event) |
| --- | --- | --- |
| M1 | Loader, temporal graph, threshold baseline, metrics harness | 0 to 3 |
| M2 | Three plain detectors, tested on hand-made rings; typology labels | 3 to 8 |
| M3 | Clusters, graph features, LightGBM ranker, first full ablation numbers | 8 to 12 |
| M4 | TraceFlow: dwell and retention in the tracer; rerun the ablation; keep each claim only if it shows lift | 12 to 15 |
| M5 | Evidence object, narrative, verifier, FastAPI, dashboard with ranked list, case graph, hover-to-edge and metrics | 15 to 20 |
| M6 | Timing features, repeat-group index, SHAP, injected-pattern test; stretch: keystone-node freeze, analyst feedback | 20 to 22 |
| Freeze | Feature freeze, bug fixes, rehearsal | 22 to 24 |

M1 to M3 alone already give a full submission with real numbers. If React slows you down in M5, Streamlit with pyvis keeps every feature except hover-to-edge.

### 3. Module contracts

Give an AI coding assistant one contract at a time, ask for tests first, and run them before moving on.

| Module | Input | Output |
| --- | --- | --- |
| Loader | IBM CSV path, slice settings | Time-sorted table: tx\_id, ts, src, dst, amount, currency, label |
| Graph builder | That table | Edge arrays for all data; a NetworkX graph for one case |
| Detectors | Edges, window, thresholds | Clusters: cluster\_id, typology list, accounts, edge IDs, start and end time |
| Feature builder | Clusters, edges | One row of features per cluster |
| Ranker | Feature table, labels | A score per cluster; the saved model |
| Investigator | One cluster | Evidence object: typology, window, dwell, retention, accounts, edges with amounts and times |
| Narrator | Evidence object | Report sentences, each with its source edge IDs |
| Verifier | Report text, evidence object | Pass or fail, plus any unverified number, account or time |
| API | Stored results | Endpoints for the cluster list, one case, and the metrics table |
| Dashboard | API | Ranked list, case graph, report with hover-to-edge, metrics table |

**Data check before coding the loader:** IBM files identify an account by bank plus account number, so combine the two into one node ID. The file also has separate received and paid amounts, possibly in different currencies. Confirm the column names and currency handling in your copy of the file, because retention depends on them.

### 4. Starting parameters

All values are guesses to tune on the validation split only. Keep them in one config file.

| Parameter | Starting value |
| --- | --- |
| Time window | 24 hours |
| Fan-in / fan-out | At least 5 distinct counterparties inside the window |
| Cycle length | 3 to 5 accounts |
| Pass-through chain | At least 3 hops, dwell at most 1 hour |
| Retention band | 0.85 to 1.0 |
| Cluster size cap | 30 nodes |
| Cluster label rule | Illicit if at least half of its transactions are illicit |

### 5. Working rules for AI-assisted building

- One module contract per prompt. Tests first, then code.
- Test every detector on a tiny hand-made graph before real data.
- Tune on validation only. Generated code must never read the test set.
- Check any number the code prints against a hand calculation on a small sample.
- Commit after each milestone.
- Keep a claims log: every claim on a slide points to the experiment that backs it.

### 6. Pitch and demo

**Likely judge questions and our answers**

- Why not a GNN? The review found GNNs unstable under extreme class imbalance; engineered graph features are explainable and measurable.
- How do you stop the LLM inventing facts? The report is built from the evidence, and the verifier checks every number, account and time.
- Are the labels real? No. IBM labels are synthetic, so we say suspicious, never confirmed.
- What is new? Time-respecting detectors with dwell and retention, and verified evidence reports. Check wording against FlowScope first.

**Three-minute demo script:** show the baseline numbers, run detection, open the top-ranked case, hover a report sentence to light up its edges on the graph, then show the comparison table against the baseline.

## Problem statement

Analysts cannot separate laundering rings from legitimate high-volume accounts fast enough, because current tools either ignore time order or bury them in candidates.

**Who suffers:** Tier-1 AML analysts at banks and payment aggregators. They triage large alert queues, then hand-write every suspicious transaction report (STR).

**Why current tools fail:**

- Threshold rules judge one transaction at a time, so payroll (a fan-out) and merchant settlement (a fan-in) look like laundering.
- Static graph tools report cycles whose edges never happened in time order.
- Learned subgraph classifiers need candidates handed to them. The STEMP paper's F1 drops from 0.770 to 0.679 once it must find candidates itself.
- LLM summarizers can invent account numbers, which is unacceptable in a legal report.

**Our one-sentence pitch:** We build a time-respecting, flow-tracing candidate generator plus a graph-feature risk ranker that outputs verifiable, evidence-linked case narratives, and we measure it against a threshold baseline on chronological splits.

**What PS 2.1 requires us to show:**

1. A temporal, directed, weighted graph of transactions.
2. Detection of three typologies: fan-in/fan-out, cycles, rapid pass-through.
3. A risk ranking of suspicious clusters.
4. A plain-language summary of each money trail.
5. Precision, recall and F1 against a threshold baseline.

**Wording rule for slides and demo:** say "suspicious", never "confirmed laundering". Our labels are synthetic, so they are experimental ground truth, not real-world proof.

## Existing gaps and what we do about each

Nine gaps came out of the papers we reviewed; the last one comes from our own gap map and is unverified until we test it.

| # | Gap | Evidence | Source | Our response |
| --- | --- | --- | --- | --- |
| 1 | Candidate generation is the bottleneck | Classifying given subgraphs scores F1 0.770; finding them first drops it to 0.679 | STEMP (Lin et al., IEEE Access 2026) | A forward, time-respecting tracer as the front end |
| 2 | Cycle enumeration explodes | About 10 million temporal cycles found before refinement | NFT temporal graph paper (Sliti et al., 2026) | Forward-only, window-bounded search instead of full cycle enumeration |
| 3 | Flow is only a threshold | Motifs keep minimum aggregated flow above a limit; no per-hop loss is modeled | Flow Motifs (Kosyfaki et al., 2018) | Retention ratio and dwell time per hop |
| 4 | Transaction-level and static analysis | Rules and static graphs miss ordering and connected structure | Network Analytics review; Graph Feature Preprocessor (GFP) | Temporal directed multigraph with time windows |
| 5 | Extreme class imbalance and GNN instability | Illicit rows are about 0.12% in IBM's older data; GNN results were unstable | Network Analytics review; IBM dataset docs | Engineered graph features with LightGBM or XGBoost; judge on PR-AUC and F1, not accuracy |
| 6 | Weak explanations | SHAP explains features, not money trails; STEMP prototypes are learned, not verifiable | GFP; STEMP | Deterministic report built from the edge list, plus a verifier |
| 7 | Incomplete and transitive labels | Unflagged laundering may sit among "legitimate" rows; labels follow the money downstream | IBM dataset docs; Network Analytics review | Call outputs suspicious, split data chronologically, inspect downstream chains |
| 8 | No analyst feedback loop | Active learning was shown offline only | Temporal-GCN (Alarab and Prakoonwit, 2022) | Confirm/reject buttons with an uncertainty queue (stretch goal) |
| 9 | Legitimate hubs look like laundering | Payroll and merchant settlement mimic fan-out and fan-in | Our gap map (unverified) | Test whether dwell and retention separate them, before claiming it |

The GFP paper reports about 63% minority-class F1 for GFP plus XGBoost on IBM HI-Small. Treat that as a target to reproduce, and confirm the number in the paper before quoting it.

## Our novelty: TraceFlow

TraceFlow follows money forward in time and judges each hop by how long funds sit and how much leaves. That is a narrower claim than "flow conservation is new", and it is the only one we can defend.

**Retired claim:** FlowScope (AAAI 2020) already models flow conservation for money laundering, and Flow Motifs already combines time windows with aggregated flow. Our earlier line that nobody uses flow conservation is dropped. Read FlowScope before we finalize any novelty wording.

**The core idea: time-respecting flow-retention tracing**

- Follow money forward only along edges where the incoming time is before the outgoing time, and the outgoing time is within a window Δt of the incoming one.
- For each node in a trace, compute a retention ratio (value out divided by value in, inside the window) and a dwell time (how long funds sat).
- Keep chains and clusters whose dwell is short and whose retention sits in a tolerance band, for example 0.85 to 1.0. The band is a starting guess to tune.
- This one tracer yields all three required typologies: fan-out/fan-in, time-valid cycles, and rapid pass-through chains.

**Why it targets real gaps**

- It attacks the candidate-generation bottleneck from STEMP.
- Forward-only, window-bounded search avoids the cycle explosion seen in the NFT paper.
- Retention and dwell go beyond Flow Motifs' minimum-flow threshold.

**Claims we may make, only after our experiments support them**

1. A forward, time-respecting candidate generator that models per-hop retention and dwell, evaluated as the front end of a ranking pipeline.
2. A hallucination-guarded, edge-linked narrative layer.
3. A measured ablation showing what each added feature buys.

**Safe wording for the pitch:** "Prior work uses flow thresholds or conservation without time-ordered dwell and retention constraints, and we measure the difference." Check this sentence against FlowScope first.

**Kill switches**

- If retention and dwell features do not improve F1 or PR-AUC in the ablation, drop that claim and pitch the candidate generator plus explainability.
- If payroll-like and merchant-like hubs do not separate from laundering nodes on dwell and retention, drop the false-positive claim.

## Solution features

Eight features are must-haves; the rest are should-haves or stretch goals. Rows 1 to 3 plus the three basic typology detectors (see Locked decisions) give a working submission if the TraceFlow idea does not pan out.

| # | Feature | What it does | Priority | Idea from |
| --- | --- | --- | --- | --- |
| 1 | Temporal multigraph | Loads IBM HI-Small, sorts by time, builds a directed, weighted multigraph of accounts and transactions | Must | IBM data, GFP |
| 2 | Baseline and metrics harness | Amount-threshold rule, then precision, recall, F1, PR-AUC, precision at k, false alerts per day | Must | PS 2.1 |
| 3 | Graph-feature ranker | Topology, temporal and amount features fed to LightGBM or XGBoost with class weights and tuned threshold | Must | GFP, Network Analytics review |
| 4 | TraceFlow tracer | Forward, time-respecting trace with dwell and retention; outputs fan-out/fan-in, cycles and pass-through chains | Must | Our novelty |
| 5 | Case reconstruction | SCC compression and path search to rebuild the full trail from source to destination | Must | Parallel Path Detection paper |
| 6 | Evidence-verified STR narrative | Report built from the edge list by template; a verifier checks every number and account ID | Must | Gap 6 |
| 7 | Investigation dashboard | Ranked cases, a 15 to 30 node subgraph per case, transaction timeline, evidence indicators | Must | PS 2.1 |
| 8 | Ablation table | Four-way comparison that proves what each component adds | Must | Our evaluation plan |
| 9 | Timing-regularity features | Variation of gaps between transactions, spread of cycle durations, holding time | Should | NFT temporal graph paper |
| 10 | Repeat-group index | Counts how often the same account group recurs across clusters | Should | NFT temporal graph paper |
| 11 | Per-case SHAP | Shows which features pushed a case's score up | Should | GFP |
| 12 | Injected-pattern test | Plants known rings in the data and checks that we recover them | Should | Validation practice |
| 13 | Keystone-node freeze | Min-cut on a flagged subgraph: "freezing this account blocks X% of flow" | Stretch | Our angle 2 |
| 14 | Analyst feedback | Confirm, reject or unsure buttons, with uncertain cases queued first | Stretch | Temporal-GCN |

**Demo rule:** never render the whole graph. Show only the flagged case's subgraph of 15 to 30 nodes, or the browser freezes and the picture is unreadable.

## Formulas

These are the equations the team implements. Thresholds are starting values from the papers or our own guesses, and must be tuned on our data.

**1. Time-respecting hop (TraceFlow).** Money at node v may only be forwarded after it arrives, and within a window Δt:

```latex
t_{in}(v) < t_{out}(v) \le t_{in}(v) + \Delta t
```

**2. Dwell time.** How long funds sat at v. Mule accounts tend to flush quickly:

```latex
d(v) = t_{out}(v) - t_{in}(v)
```

**3. Retention ratio.** Value leaving v divided by value entering it, inside the window W. A band such as 0.85 to 1.0 is our starting guess:

```latex
\rho(v) = \frac{\sum_{e \in \mathrm{out}(v,W)} f(e)}{\sum_{e \in \mathrm{in}(v,W)} f(e)}
```

**4. End-to-end retention of a chain.** How much of the starting value survives a path of k intermediate nodes (our own feature):

```latex
R(P) = \prod_{i=1}^{k} \rho(v_i)
```

**5. Bottleneck flow of a motif instance (Flow Motifs).** The weakest aggregated edge, valid only if the instance fits in the time limit δ:

```latex
F(G_I) = \min_{(u,v) \in E_M} \sum_{e \in E_I(u,v)} f(e), \qquad t_{last} - t_{first} \le \delta
```

**6. Timing regularity (NFT paper).** Gaps between consecutive transactions, their mean, and the coefficient of variation. The paper treats CV below 0.1 as bot-like, but that threshold came from NFT data:

```latex
\Delta t_i = \tau_{i+1} - \tau_i, \qquad CV = \frac{\sigma_{\Delta t}}{\overline{\Delta t}}
```

**7. Repeat Cycle Index (NFT paper).** Counts other cycles sharing more than a fraction ρ\_W of the same accounts, where W(C) is the account set of a cycle:

```latex
RCI(C_i) = \sum_{j \ne i} \mathbf{1}\left[ \frac{|W(C_i) \cap W(C_j)|}{\max(|W(C_i)|, |W(C_j)|)} > \rho_W \right]
```

**8. Class weight for the ranker.** Illicit rows are rare, so positives are weighted up (tune this with the decision threshold):

```latex
w_{+} = \frac{N_{-}}{N_{+}}
```

**9. Evaluation metrics.** Report these, never accuracy alone. PR-AUC is the area under the precision-recall curve, and precision at k is the share of true cases in the top k ranked:

```latex
P = \frac{TP}{TP+FP}, \qquad R = \frac{TP}{TP+FN}, \qquad F1 = \frac{2PR}{P+R}
```

**10. Keystone node (stretch).** Share of flow blocked by freezing the accounts in a minimum cut of the flagged subgraph:

```latex
\text{blocked share} = \frac{\text{mincut}(s,t)}{\text{total flow from } s \text{ to } t}
```

**11. Uncertainty for analyst feedback (stretch, Temporal-GCN).** Predictive entropy over T stochastic passes, used to queue the most uncertain cases first:

```latex
H(\bar p) = -\sum_{c} \bar p_c \log \bar p_c, \qquad \bar p = \frac{1}{T}\sum_{t=1}^{T} p_t
```

## Tech stack

The intelligence lives in the tracer, the graph features and the verifier. The LLM is optional wording polish at the very end, so removing it must not break the product.

| Layer | Choice | Why it fits this problem |
| --- | --- | --- |
| Storage | Parquet files queried with DuckDB | Fast time-ordered scans of millions of rows; no database setup |
| Data prep | Polars (Pandas is acceptable) | Quick sort and windowing on IBM HI-Small |
| Temporal tracer | Custom forward search over time-sorted edge arrays, with per-account lookup by timestamp, accelerated with Numba | Our novelty; forward-only and window-bounded, so no cycle explosion |
| Small graph work | NetworkX on one flagged case only | SCC, path rebuild and min-cut are fine on 15 to 30 nodes; too slow on the full graph |
| Graph features | GFP-style features we implement ourselves (degrees, fan-in/out counts and amounts, cycle counts, scatter-gather within windows), plus tracer features (dwell, retention) | GFP is the best-supported feature approach in our papers. Check whether IBM's code is usable; if not, implement a subset |
| Ranker | LightGBM, with XGBoost as the comparison | Matches the papers' strongest results and handles heavy class imbalance better than GNNs in the review |
| Explanations | SHAP for feature impact, plus the tracer's own evidence object | SHAP says which features mattered; the evidence object says which transactions |
| Report writer | Jinja2 templates over a structured evidence JSON, then a verifier | Every amount and account ID in the text must exist in the evidence |
| Agent layer | Plain Python orchestrator with typed tools (Pydantic) | See the next section; keeps behavior testable |
| LLM (optional) | Small open-weights instruct model served locally (Ollama or llama.cpp); a hosted API is an option | Used only to rephrase a verified draft; template is the fallback |
| API | FastAPI | Serves cases, evidence and metrics to the dashboard |
| Dashboard | React with Cytoscape.js for the graph, Plotly for the timeline. Use Streamlit only if nobody knows React | Hover-to-highlight needs control over individual edges |
| Evaluation | scikit-learn metrics, one fixed chronological split script, results saved to CSV | Same split for every method keeps the comparison fair |
| Testing | pytest with small hand-built rings | Proves the tracer finds planted patterns and ignores out-of-order ones |
| Data | IBM AML HI-Small first; AMLSim optional | Labeled, free, and what the papers report on |

**Deliberately avoided**

- Calling a hosted LLM on raw transactions to "find" laundering. It cannot be measured and it hallucinates.
- Full-graph cycle enumeration (Johnson's algorithm) on the whole dataset.
- GNNs as the starting point. They are optional comparisons only, after the baseline works.
- Rendering the whole graph in the browser.

## Agentic AI design

We use agents as separate roles with narrow tools, and only two steps involve an LLM: rewording a report and answering analyst questions. Everything that decides what is suspicious is deterministic code we can measure.

| Agent | Job | Tools it may call | LLM? |
| --- | --- | --- | --- |
| Ingest | Checks the schema, sorts by time, builds the graph | Loader, validator | No |
| Tracer | Runs TraceFlow on a time window and returns candidate clusters | Forward tracer | No |
| Scorer | Builds features for each candidate and ranks it | Feature builder, LightGBM model | No |
| Investigator | Rebuilds the full trail for one case and labels its typology | SCC, path search, evidence builder | Only to route analyst questions to tools |
| Narrator | Fills the report template, then optionally rephrases it | Template engine, LLM | Optional polish |
| Verifier | Rejects any report that contains a fact not in the evidence | Number, account and time extractor | No |
| Feedback (stretch) | Stores confirm, reject or unsure and queues uncertain cases | Case store, uncertainty score | No |
| Interdiction (stretch) | Finds the keystone account with a minimum cut | Min-cut on the case subgraph | No |

**The anti-hallucination loop**

1. The Investigator produces an evidence object: account IDs, edge IDs, timestamps, amounts, dwell and retention values, typology.
2. The Narrator fills a template from that object. This draft is always correct by construction.
3. If the LLM is on, it rephrases the draft without changing sentence boundaries.
4. The Verifier pulls every number, account ID and timestamp out of the final text and checks that each one exists in the evidence object.
5. On any mismatch it allows one retry, then falls back to the template draft.
6. Each sentence keeps the edge IDs it came from, so hovering it highlights those edges on the graph.

**Rules every agent follows**

- It may only cite facts returned by a tool. No tool result, no claim.
- Every step logs its inputs, outputs and edge IDs, which gives the audit trail.
- Outputs say "suspicious", never "confirmed".
- The product still works with the LLM switched off.

**Metrics this gives us for the slides**

- Share of reports that pass the Verifier on the first try.
- Number of facts the Verifier blocked from the LLM draft.
- Time from alert to finished report, compared with the manual 45-minute figure. That figure is unverified, so measure our own time and do not quote theirs.

## Architecture

&#91;embedded content: architecture · 8 stages in 2 rows\]

Data flows left to right along the top row, then wraps to the second row. TraceFlow (highlighted) proposes candidates, the ranker orders them, and the verifier blocks any report whose facts are not in the evidence. Analyst feedback and the keystone-node freeze would attach to the dashboard as stretch goals.

## Evaluation and build plan

Our proof is a four-way comparison on one chronological split of IBM HI-Small. Train on earlier transactions and test on later ones, so no future behavior leaks into training.

| Method | What it contains |
| --- | --- |
| A. Threshold baseline | Flags transactions above an amount threshold |
| B. Graph features + GBM | GFP-style graph features with LightGBM or XGBoost |
| C. B + retention and dwell | Adds our TraceFlow features |
| D. C + candidate filtering | Ranks only clusters produced by the tracer |

**Metrics for every method:** minority-class F1, PR-AUC, precision at k, false alerts per day. For the tracer alone, also report recall of true laundering clusters before ranking. It mirrors the oracle-versus-end-to-end gap in STEMP.

**Do these two checks in the first two hours**

1. Does the data support retention features? Look at whether amounts differ across hops, then run a quick ablation. If retention and dwell do not improve F1 or PR-AUC, drop that claim.
2. Do legitimate hubs separate? Check whether payroll-like and merchant-like accounts differ from laundering accounts on dwell and retention. If not, do not pitch the false-positive claim.

**Build order**

| Step | Build | Priority |
| --- | --- | --- |
| 1 | Load HI-Small, clean, sort by time, build the temporal multigraph | Must |
| 2 | Threshold baseline and metrics harness | Must |
| 3 | Graph features + GBM (this is the fallback product) | Must |
| 4 | Forward time-respecting tracer with dwell and retention | Must |
| 5 | Four-way ablation table | Must |
| 6 | Evidence narrative with verifier | Must |
| 7 | Dashboard with the 15 to 30 node case subgraph | Must |
| 8 | Keystone-node freeze and analyst feedback | Stretch |

Steps 1 to 3, plus the three basic typology detectors, give a working submission even if step 4 fails.

**Suggested split for three peop  ****le (adjust to your strengths):**

- Person 1: data, graph, TraceFlow tracer, tests.
- Person 2: features, ranker, baseline, ablation and metrics.
- Person 3: evidence object, narrative and verifier, API, dashboard.

### Locked decisions (14 Nov)

These settle the open points from the PS 2.1 check. Change them only as a team.

1. **Typology detectors are separate named functions.** Build plain versions of `fan_in_out`, `cycle` and `pass_through` first, before TraceFlow. TraceFlow then adds dwell and retention constraints on top. Every alert carries a typology field; if several match, show all and use the highest-scoring one as the primary label.
2. **The unit we rank is the cluster.** A candidate cluster is the set of accounts linked by one detector or tracer output inside one time window, capped at 30 nodes. The ranker is trained on clusters, using aggregated member graph features plus tracer features (size, duration, dwell, retention, typology flags).
3. **Cluster label for training.** A cluster is illicit if at least half of its transactions carry an illicit label in the dataset. The half is a starting value; keep it as one config setting.
4. **Evaluation unit is the transaction.** A transaction counts as flagged if it sits in a cluster scored above the decision threshold. The threshold baseline flags by amount and is scored on the same unit. Report precision, recall, F1 and PR-AUC; add precision at k on clusters as a secondary view.
5. **Split.** Sort by time and use 60% train, 20% validation, 20% test. Choose all thresholds on validation only, for both our method and the baseline. Touch the test set once, for the final numbers.
6. **Dataset.** IBM HI-Small only. AMLSim and PaySim are not used.
7. **LLM is off by default in all measured runs.** Metrics come from the template report. Switch the LLM on only for the live demo, and keep the verifier on in both modes.

## Risks and claims to verify

Several claims in our early planning notes came from unverified sources. Check each one below before it reaches a slide, and drop whatever you cannot confirm.

| Item | Why it needs checking | Action |
| --- | --- | --- |
| Novelty versus FlowScope | FlowScope (AAAI 2020) already models flow conservation for laundering | Read it first; reword the novelty claim to fit |
| MuleHunter.AI adoption numbers | Taken from a planning note, not confirmed here | Verify on RBI or official pages |
| "Dec 2026 RBI and MHA directive" | Unconfirmed regulatory claim | Verify on official sources or remove |
| Devpost projects named as competitors | Their weaknesses were guessed, not read | Open each one and confirm what it actually does |
| "90 to 95% false positives" and "45-minute STR" | Industry-style figures with no source | Cite a source or remove |
| GFP + XGBoost about 63% minority F1 | Quoted from a teammate's summary | Confirm in the GFP paper |
| Commission skimming in the data | The planning notes assumed 1 to 8% cuts per hop; IBM data may not contain them | Check amount fields across hops; if absent, say retention is tested on synthetic injections |

**Technical risks**

- **Injected patterns inflate scores.** If we plant rings ourselves and then detect them, F1 looks better than it is. Report planted-pattern results separately from IBM-label results.
- **Hairball UI.** Rendering thousands of nodes freezes the browser. Show only the case subgraph.
- **Slow traversal.** Naive search on the whole graph times out in a live demo. Pre-compute traces and cache the results.
- **Synthetic labels.** IBM labels are experimental ground truth. Say so on the slide.
- **Adaptive launderers.** Anyone who learns the window or the band can dodge a fixed threshold. Mention it as a limitation, as the STEMP paper does for its own method.

## Sources

All details below come from the team's paper summaries, not from a fresh read of each PDF, so confirm any figure in the paper before quoting it.

| Source | Used for | Status |
| --- | --- | --- |
| Detecting Suspicious Activity in the NFT Ecosystem Using Temporal Graph Analysis (Sliti et al., IEEE TNSE 2026) | Temporal cycle validation, timing indicators, Repeat Cycle Index | Summarized by team |
| Flow Motifs in Interaction Networks (Kosyfaki et al., 2018) | Ordered motifs, aggregated flow, bottleneck flow | Summarized by team |
| Graph-Based LSTM for Anti-money Laundering: Temporal Graph Convolutional Network with Bitcoin Data (Alarab and Prakoonwit, 2022) | Active learning and uncertainty | Summarized by team |
| Subgraph-Level Temporal Graph Transformer With Laundering-Motif Prototypes (STEMP; Lin et al., IEEE Access 2026) | Candidate-generation bottleneck, prototype explanations | Summarized by team |
| Network Analytics for Anti-Money Laundering: A Systematic Literature Review and Experimental Evaluation | Class imbalance, GNN instability, benchmarking | Summarized by team |
| Graph Feature Preprocessor: Real-time Subgraph-based Feature Extraction for Financial Crime Detection | Graph features, GFP + XGBoost result | Summarized by team |
| Parallel Path Detection for Fraudulent Accounts in Banks Based on Graph Analysis | SCC compression, path reconstruction | Summarized by team |
| Scalable Graph Learning for Anti-Money Laundering: A First Look | Scalability | Summarized by team |
| IBM Synthetic Financial Data for Money Laundering (dataset documentation) | Dataset, labels, class imbalance | Summarized by team |
| IBM Multi-GNN and AMLSim repositories | Optional GNN comparison; data generation | Read by team as READMEs |
| FlowScope: Spotting Money Laundering Based on Graphs (AAAI 2020) | Closest prior work on flow conservation | Not yet read; read first |
| Realistic Synthetic Financial Transactions for Anti-Money Laundering Models (NeurIPS 2023) | How the IBM data is generated | Not yet read |
| EvolveGCN; Provably Powerful Graph Neural Networks for Directed Multigraphs | Optional advanced GNN comparisons | Not yet read |
