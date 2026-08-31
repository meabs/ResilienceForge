# Resilience Forge — Test & Acceptance v3.1

All three scenarios are first-class. A release candidate fails if any scenario lacks its complete human + WebMCP + simulation loop.

# 1. Core acceptance

| ID | Test | Expected |
|---|---|---|
| CORE-01 | Load each Catalogue card | Correct static topology and scenario defaults load |
| CORE-02 | Leave Bench / switch architecture | Site tools stay registered. Live handlers rebind. No second `toolsReady`. |
| CORE-03 | WebMCP unavailable | App still functions; SITE TOOLS amber |
| CORE-04 | UI stress vs WebMCP stress | Same domain path and deterministic result |
| CORE-05 | Human mutation while agent uses stale version | Agent mutation rejected `STALE_STATE` |
| CORE-06 | Human pin violated by agent | Structured `PINNED_*` error; no mutation |
| CORE-07 | Refresh same command sequence | Same metrics/tick path |
| CORE-08 | FDR | UI and WebMCP operations present, newest last |
| CORE-09 | Reduced motion | No loss of state information |
| CORE-10 | No hidden second store | Topology canvas reflects domain store only |
| CORE-11 | Human uses ordinary control during agent activity | Control stays enabled, version increments, next tick reflects change |
| CORE-12 | Semantic WebMCP read | Metrics expose demand/capacity/utilisation/headroom plus scenario-specific queue/TTFT values |
| CORE-13 | Constraint provenance | `get_constraints` exposes sourceType/sourceDate/source URL where applicable |
| CORE-14 | No agent ownership mode | Human controls are never locked merely because WebMCP is operating |

# 2. Checkout acceptance

| ID | Test | Expected |
|---|---|---|
| CO-01 | 10k RPS, one ordered Pub/Sub key, batch 1 | Queue bottleneck; SLO fails |
| CO-02 | Increase ordering-key parallelism only | Capacity improves but remains below 10k unbatched |
| CO-03 | Ordered-key parallelism + sufficient batching | Queue capacity exceeds 10k and jam clears |
| CO-04 | Keep Pub/Sub ordering keys pin | Unordered replacement is rejected |
| CO-05 | Human changes peak RPS/budget during agent change | stale mutation rejected; semantic re-read; revised remediation succeeds |
| CO-06 | Fail zone containing primary DB | DB runtime health down and synchronous path degrades |
| CO-07 | Same-region replica legal | no-second-region pin does not block it |
| CO-08 | Visual | queue depth and packet jam change on next tick |

# 3. Multi-region acceptance

| ID | Test | Expected |
|---|---|---|
| MR-01 | Healthy 50/50 split | both regions visibly receive traffic |
| MR-02 | Fail us-east4 | region B down; traffic allocated there is lost |
| MR-03 | Shift to primary without scaling | surviving region can become saturated |
| MR-04 | Shift + autoscale primary | target can recover within model |
| MR-05 | Human changes primary traffic allocation mid-agent action | packets reflow, stale agent action rejected, agent adapts |
| MR-05B | Pin no second region | B remains visible but excluded |
| MR-06 | Attempt route to B while pinned | structured `PINNED_NO_SECOND_REGION` |
| MR-07 | Human pin invalidates agent version | `STALE_STATE`, re-read and legal retry |
| MR-08 | Visual | packet density moves from split to primary only |

# 4. LLM serving acceptance

| ID | Test | Expected |
|---|---|---|
| LLM-01 | 80/20 base split | packet density matches approximate split |
| LLM-02 | Raise new model share beyond capacity | new GPU saturates, TTFT rises, overflow grows |
| LLM-03 | Autoscale new GPU | utilisation/TTFT improve deterministically |
| LLM-04 | Batching | throughput changes according to configured model and wait cost |
| LLM-05 | Human changes new-model split mid-agent action | path density changes, stale action rejected, agent adapts |
| LLM-05B | Keep old model pin | 100% new split rejected |
| LLM-06 | Human pin during agent cutover | stale mutation rejected and agent can retry |
| LLM-07 | Safe split + scale/batch | TTFT/overflow recover within targets |
| LLM-08 | Visual | old/new path densities and GPU state respond next tick |

# 5. WebMCP acceptance

For every architecture:

1. load reference from Catalogue with `load_architecture` or Load onto bench;
2. confirm SITE TOOLS green and `get_webmcp_status.toolsReady` is true;
3. call `get_bench_snapshot` and confirm version, metrics, constraints, and topology;
4. verify FDR entry;
5. run relevant stress/failure tool;
6. verify canvas/gauge causality;
7. perform legal remediation;
8. change an ordinary human control (peak RPS/budget, region allocation or model split);
9. invoke stale mutation using prior version;
10. verify `STALE_STATE`;
11. re-read `get_decision_log` and `get_bench_snapshot`;
12. perform legal remediation from new version;
13. separately enable a hard pin and verify `PINNED_*` enforcement, including inside `apply_remediation_plan`;
14. `reset_scenario` restores a clean baseline; switching architectures does not leak the previous scenario's faults or outages.

The full site tool set stays registered across Catalogue and every Bench. Irrelevant remediations remain listed and return `ILLEGAL_MOVE`, `UNKNOWN_NODE`, or `NO_BENCH_LOADED`.

# 6. Data/provenance acceptance

- Every price has source date and assumptions.
- UI always says **public list-price estimate**.
- Every limit is `provider_limit` or `model_assumption`.
- Provider limit records include source URL/date.
- Model assumptions never masquerade as GCP service guarantees.
- Checkout ordered Pub/Sub constraints match the curated records returned by `get_constraints` and defined in `app/data.ts` / `app/resilience-forge.tsx`.

# 7. Video acceptance

Before filming, all three flows must work live.

The video must visibly show:

- Catalogue `load_architecture` plus human Load onto bench;
- external agent using site tools;
- at least one stale-state conflict;
- an ordinary human control change altering agent behaviour;
- a separate human pin being enforced as a hard constraint;
- distinct checkout queue failure;
- distinct multi-region failure;
- distinct LLM GPU/TTFT failure;
- FDR containing both `ui` and `webmcp`;
- at least one WebMCP read result showing semantic demand/capacity/headroom or GPU/TTFT state.

Do not film a scripted mock where tool calls are not actually registered.
