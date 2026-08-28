# Resilience Forge — Agent Build Specification v3.1

**Status:** Source of truth for the build — competition-fit hardened  
**Contest:** OpenAI WebMCP Challenge  
**Submission deadline used by this spec:** 3 September 2026, 21:00 Europe/London (Devpost official rules currently state 1:00pm PDT). Recheck the Devpost countdown before submission because the OpenAI landing page currently shows a different time.  
**Companion documents:** `SCREEN-FLOWS.md`, `TEST-ACCEPTANCE.md`  
**Design inputs:** mockups in `mockups/` define layout and tone, not pixels.

> **Non-negotiable:** `event_driven_checkout`, `multi_region_saas`, and `llm_inference_serving` are first-class product scenarios. All three must load, simulate, fail in a distinct way, accept human intervention, expose appropriate WebMCP tools, recover through legal moves, and satisfy their acceptance tests. Do not remove or visually demote a scenario to save time.

---

## 1. Product definition

Resilience Forge is a **reference-architecture bench**.

A human architect chooses a known reference pattern, configures the project scenario, and loads it onto a live executable bench. An **external browser agent** such as ChatGPT's in-app browser or a WebMCP-enabled Chrome session discovers structured site tools and operates that same live model.

The product is deliberately not:

- a blank-canvas architecture designer;
- an architecture generator;
- an embedded AI assistant;
- a multi-agent console;
- a cloud-provider comparison product;
- a production capacity-planning calculator.

The core proposition is:

> **Human chooses and constrains the reference. Agent stresses and remediates it. Both operate one live state.**

The simulation is a **decision-support model**, not production sizing proof. It exists to make reference-architecture trade-offs executable, inspectable and discussable before implementation. Never claim that a passing bench run proves a production system is resilient or correctly sized.

### 1.1 Signature loop

Every scenario must support this loop:

1. **Human or agent loads** a reference architecture from the Catalogue (`list_architectures` then `load_architecture`, or the human Load onto bench control).
2. **Human configures** scenario controls and project constraints on the Bench.
3. **External agent discovers tools**, reads the live graph and constraints, then runs a deterministic stress test or failure.
4. The scenario exhibits its **distinctive failure mode** visibly in graph motion and metrics.
5. The agent begins a legal remediation.
6. The **human continues using the app normally while the agent is operating**: change peak load, budget, region traffic allocation, model split or a pinned decision. There is no special "interrupt agent" control.
7. Any stale agent mutation is rejected by optimistic concurrency.
8. The agent re-reads current state and continues with a legal alternative.
9. Graph, gauges, packet motion and Flight Data Recorder (FDR) ticker all reflect the same underlying store.

If the demo does not visibly communicate **"human changed the page; agent observed the change and adapted"** within the first 30 seconds of the WebMCP interaction, the build has failed its primary competition objective.

### 1.2 WebMCP semantic advantage

The agent must receive **structured application semantics**, not merely an API equivalent of button clicks. WebMCP read tools expose live values that may not all be visible simultaneously in the UI, including:

- demand and served throughput per node;
- capacity, utilisation and headroom;
- queue depth / overflow;
- failed or excluded regions/zones;
- GPU utilisation and TTFT;
- active pins and scenario targets;
- current store version;
- limit provenance and whether a value is a provider limit or model assumption.

This is part of the WebMCP value proposition: the external agent can understand the live bench semantically without screen-scraping or reverse-engineering DOM text. Do not create hidden conclusions or recommendations in these read tools; return measurements, constraints and machine-readable observations.

---

## 2. Scenario equality rule

All three scenarios are equal product surfaces.

### MUST

- Catalogue cards are the same size and visual prominence.
- All scenarios use the same Bench shell.
- Each scenario has a unique stress/failure mechanism.
- Each scenario has at least one legal agent remediation.
- Each scenario has at least one meaningful human interrupt.
- Each scenario has at least one **ordinary live control** the human can change during agent activity; pins must not be the only interrupt mechanism.
- Each scenario has scenario-relevant live graph metrics.
- Each scenario has automated deterministic tests.
- Each scenario has a judge-ready demo path.
- All three are completed before non-essential styling polish.

### MUST NOT

- Label one scenario "demo", "primary", "advanced", "experimental", or "coming soon".
- Hide weaker scenarios behind secondary navigation.
- Implement a full tool/simulation path for one scenario and static mocks for the others.
- Use the time-pressure plan to delete a scenario.
- Make all three scenarios fail using the same generic "capacity exceeded" logic with different labels.

The product may spend more video time on one scenario for narrative clarity, but the live app and repository must treat all three as complete.

---

## 3. Product boundaries

### MUST

- SPA with exactly two routes/views:
  - `/` — Catalogue
  - `/bench/:architectureId` — Bench
- One in-memory application store.
- UI actions and WebMCP mutation tools call the same domain commands.
- Deterministic 2 Hz simulation loop.
- Architecture definitions are static JSON.
- Curated pricing and limits are static JSON snapshots.
- Local storage only for last-selected reference and latest human scenario controls.
- App works without WebMCP support; SITE TOOLS lamp becomes amber.
- Public HTTPS deployment, public repository, MIT licence and judge instructions.

### MUST NOT

- In-app chat or conversation UI.
- AI avatar, assistant panel, "thinking" state or sparkle icon.
- Blank-canvas creation.
- Runtime topology generation.
- Authentication, accounts, database or backend.
- Live cloud billing/price APIs.
- Production cloud SDKs.
- Provider logos in the contest video.
- Additional routes such as Reports, Settings, Tools or Admin.
- Separate "agent state" and "human state".

---

## 4. Visual direction

Mood: **architecture operations bench**, not generic SaaS dashboard.

Use:

- graphite ground;
- steel surfaces;
- IBM Plex Sans / IBM Plex Mono;
- amber FDR log;
- green healthy;
- red failed;
- restrained cyan/steel for human interaction;
- violet only for transient WebMCP mutation highlight if useful;
- hardware-feeling sliders and pin stamps, without heavy skeuomorphism.

The Canvas is the hero. Avoid wrapping every data point in a card.

### Required live feedback

- Healthy edge: sparse moving packets.
- Saturated edge: denser inbound packets and a restrained warning halo.
- Down edge: dashed, no packets, red health pip.
- WebMCP mutation: affected node/edge receives a 1–1.5 second highlight.
- Human mutation: affected control/node receives a distinct short highlight.
- Stale agent action: FDR records `STALE_STATE`; no silent overwrite.
- Reduced-motion mode: freeze packets but retain health pips, hatching and state changes.

---

## 5. Views

## 5.1 Catalogue (`/`)

Display **exactly three equal reference cards**:

1. Event-driven checkout
2. Multi-region SaaS
3. LLM inference serving

Each card contains:

- actual simplified topology thumbnail;
- name;
- one-line job;
- operating shape;
- distinctive failure;
- one human-interrupt example;
- **Load onto bench** button.

No ranking, scores, "recommended", badges or default winner.

Loading can be human (Load onto bench) or agent (`list_architectures` then `load_architecture`).

`load_architecture` is a Catalogue WebMCP tool. It navigates to `/bench/:id`. Bench mutations stay on the loaded reference.

## 5.2 Bench (`/bench/:architectureId`)

One shared shell:

- **Canvas: ~70%**
- **Scenario/constraint rail: ~30%**
- compact common gauges;
- bottom FDR ticker;
- top bar with product name, reference name, breadcrumb and SITE TOOLS lamp.

The right rail is scenario-aware rather than pretending every architecture has identical controls.

Common controls:

- peak load;
- monthly budget;
- region / primary region;
- SLO target summary;
- Run stress test;
- pin chips relevant to current scenario.

The Node Inspector is a popover, never another route.

---

## 6. Architecture and scenario data model

Use one store, with a clear difference between **design configuration** and **simulation runtime** inside that store.

```ts
type ArchitectureId =
  | 'event_driven_checkout'
  | 'multi_region_saas'
  | 'llm_inference_serving'

type Region = 'eu-west-2' | 'us-east-1'
type Zone = 'a' | 'b'
type Health = 'healthy' | 'degraded' | 'down'

type PinId =
  | 'aws_only'
  | 'no_second_region'
  | 'keep_fifo_ordering'
  | 'budget_hard'
  | 'keep_old_model'

interface AutoscalingConfig {
  min: number
  max: number
}

interface BatchConfig {
  maxBatch: number
  waitMs: number
}

interface Node {
  id: string
  kind:
    | 'client'
    | 'edge'
    | 'gateway'
    | 'service'
    | 'queue'
    | 'db'
    | 'cache'
    | 'workers'
    | 'gpu'
  name: string
  region: Region
  zone?: Zone
  provider: 'aws'
  replicas: number
  mode?: 'standard' | 'high_throughput'
  autoscaling?: AutoscalingConfig
  batching?: BatchConfig
  health: Health
  constraintProfile?: string
  priceProfile?: string
  legalRemediations: string[]
}

interface Edge {
  id: string
  from: string
  to: string
  kind: 'sync' | 'async'
}

interface CommonScenario {
  peakRps: number
  budgetGbp: number
  availabilityTarget: number
  latencyTargetMs: number
}

interface CheckoutScenario extends CommonScenario {
  architectureId: 'event_driven_checkout'
  region: 'eu-west-2'
  orderedEvents: boolean
  surviveZonalFailure: boolean
  eventsPerRequest: number
}

interface MultiRegionScenario extends CommonScenario {
  architectureId: 'multi_region_saas'
  primaryRegion: 'eu-west-2'
  secondaryRegion: 'us-east-1'
  surviveRegionalFailure: boolean
  initialPrimaryTrafficPercent: number
}

interface LlmServingScenario extends CommonScenario {
  architectureId: 'llm_inference_serving'
  region: 'eu-west-2'
  targetNewModelPercent: number
  ttftTargetMs: number
}

type Scenario =
  | CheckoutScenario
  | MultiRegionScenario
  | LlmServingScenario

interface RuntimeState {
  killedNodes: string[]
  failedZones: Zone[]
  failedRegions: Region[]
  excludedRegions: Region[]
  activeLatencyMs: Record<string, number>
  regionTrafficPrimaryPercent?: number
  modelTrafficNewPercent?: number
  nodeMetrics: Record<string, NodeMetric>
  edgeMetrics: Record<string, EdgeMetric>
}

interface NodeMetric {
  demandRps: number
  servedRps: number
  utilisation: number
  queueDepth?: number
  ttftMs?: number
  effectiveHealth: Health
}

interface EdgeMetric {
  rps: number
  droppedRps: number
}

interface SimResult {
  tick: number
  availability: number
  p95Ms: number
  errorRate: number
  rpsAchieved: number
  costGbpMonth: number
  sloPass: boolean
  breachReasons: string[]
}

interface FdrEntry {
  ts: string
  source: 'ui' | 'webmcp' | 'sim'
  op: string
  args: unknown
  beforeVersion: number
  afterVersion: number
  resultCode?: string
}

interface Store {
  version: number
  architectureId: ArchitectureId | null
  nodes: Node[]
  edges: Edge[]
  scenario: Scenario | null
  pins: PinId[]
  runtime: RuntimeState
  sim: SimResult | null
  running: boolean
  log: FdrEntry[]
}
```

### 6.1 Store rule

React Flow is a projection of `Store.nodes`, `Store.edges`, `runtime.nodeMetrics` and `runtime.edgeMetrics`.

React Flow state must never become a second architecture source of truth.

---

## 7. Same Truth domain layer

The UI and WebMCP do not mutate Zustand directly.

They call the same domain command functions.

```text
Human UI ─────────────┐
                      ▼
                Domain Commands
                      ▲
WebMCP Adapter ───────┘
                      │
        validation + pins + version check
                      │
                      ▼
                 Zustand Store
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Canvas       Gauges        FDR
```

Example domain commands:

```ts
loadArchitecture(...)
setScenario(...)
setPin(...)
runStressTest(...)
failZone(...)
failRegion(...)
killComponent(...)
restoreComponent(...)
setAutoscaling(...)
enableHighThroughput(...)
setBatching(...)
addReadReplica(...)
setRegionTrafficSplit(...)
setModelTrafficSplit(...)
```

No WebMCP tool may contain independent business logic.

---

## 8. Concurrency and human interruption

The collaboration must be real, not timed choreography.

### 8.1 Optimistic concurrency

Every successful mutation increments `Store.version`.

Read tools return the current version.

Every WebMCP **mutating** tool requires:

```ts
expectedVersion: number
```

The domain layer checks it before applying the command.

If mismatched:

```json
{
  "ok": false,
  "code": "STALE_STATE",
  "expectedVersion": 42,
  "currentVersion": 43
}
```

No state is changed.

The agent must re-read and re-plan.

### 8.2 Conflict policy

| Conflict | Behaviour |
|---|---|
| Human and agent alter different components | Both can apply sequentially |
| Agent acts from stale version | Reject with `STALE_STATE` |
| Agent violates human pin | Reject with `PINNED_*` |
| Same exact field changed by human first | Agent stale mutation rejected |
| Simulation tick updates runtime while design changes | Next tick recomputes from latest design |
| UI change | Applies immediately and increments version |

Never use silent last-write-wins for an agent mutation.

### 8.3 Pins are domain invariants

Pins are primarily human controls.

- `keep_fifo_ordering`: queue may use high-throughput FIFO and batching; cannot be replaced with unordered queue semantics.
- `no_second_region`: secondary-region nodes remain visible but are excluded from routing/remediation. Do not delete topology.
- `budget_hard`: remediation that would put estimated cost over budget is rejected.
- `keep_old_model`: LLM new-model traffic may not reach 100%.
- `aws_only`: defensive constraint for future provider mappings; current references are AWS-mapped.

Pins mutate the same store and increment version.

---

## 9. Simulation principles

Simulation is intentionally simple, deterministic and inspectable.

- Tick at 2 Hz.
- No randomness.
- Same state + same command sequence = same results.
- Capacity constants live in JSON registries, not JSX.
- Public service limits are labelled as such.
- Product-model assumptions are labelled as model assumptions.
- Failure state is runtime state, not destructive edits to topology.

Every tick:

1. Resolve pins/excluded regions.
2. Apply runtime failures.
3. Calculate demand per edge.
4. Calculate node capacity from the current constraint profile and configuration.
5. Calculate served throughput and overflow.
6. Update queue depth / saturation.
7. Calculate latency/TTFT.
8. Calculate error rate and availability.
9. Calculate curated public list-price estimate.
10. Evaluate SLO.
11. Write node/edge metrics and latest `SimResult`.

---

## 10. First-class scenario A — Event-driven checkout

**ID:** `event_driven_checkout`

### 10.1 Job

Retail checkout with strictly ordered order events.

### 10.2 Topology

```text
web_client
   |
api_gateway
   |
order_service ------> postgres_primary
   |                 redis
   v
sqs_fifo
   |
payment_service
```

Static JSON nodes:

- `web_client`
- `api_gateway`
- `order_service`
- `sqs_fifo`
- `payment_service`
- `postgres_primary`
- `redis`

### 10.3 Distinctive failure

**FIFO throughput ceiling.**

Default scenario:

- 10,000 request/s
- 1 order event per request
- FIFO ordering required
- London (`eu-west-2`)
- standard FIFO mode
- batch size 1

Curated London FIFO capacity model, snapshot 2026-08-27:

- standard unbatched: 300 operations/s;
- standard batch: up to 3,000 messages/s at batch size 10;
- high-throughput unbatched: 4,500 operations/s;
- high-throughput batch: up to 45,000 messages/s at batch size 10.

Model formula:

```ts
if (mode === 'standard') {
  capacity = Math.min(300 * batchSize, 3000)
}

if (mode === 'high_throughput') {
  capacity = Math.min(4500 * batchSize, 45000)
}
```

This allows the 10k scenario to fail initially and pass only after a meaningful remediation combination.

### 10.4 Legal remediations

- `set_autoscaling(order_service, ...)`
- `enable_high_throughput(sqs_fifo)`
- `set_batching(sqs_fifo, ...)`
- `add_read_replica(postgres_primary)` when relevant to zonal failure
- `restore_component(...)`

### 10.5 Human interrupt

Preferred competition interrupt is an **ordinary scenario edit**, not just a pin:

1. Agent detects the FIFO bottleneck and starts remediation from version N.
2. Human raises **Peak RPS** (for example 10,000 -> 15,000) or lowers the monthly budget while the agent is operating.
3. The UI applies the change immediately, recomputes on the next tick and increments the store version.
4. Any agent mutation based on version N is rejected with `STALE_STATE`.
5. Agent re-reads `get_scenario`, `get_live_metrics` and `get_constraints`.
6. Agent chooses batching/high-throughput/autoscaling values suitable for the new workload and budget.

Pins remain available as hard constraints. A second valid beat is for the human to pin **Keep FIFO ordering** so the agent must retain ordered semantics. Pins must not be the only form of human interruption demonstrated.

### 10.6 Zonal failure path

- `fail_zone('a')` marks all zone-A runtime nodes down.
- If primary DB is affected, synchronous order path degrades.
- Same-region replica is a legal move if present in `legalRemediations`.
- `no_second_region` does not block a same-region replica.

### 10.7 Required visual behaviour

- Inbound packets visibly jam before `sqs_fifo`.
- Queue depth rises.
- High-throughput change immediately alters next tick's packet density.
- Batching visibly reduces operation pressure / jam.
- SLO flips from fail to pass only when model conditions actually pass.

---

## 11. First-class scenario B — Multi-region SaaS

**ID:** `multi_region_saas`

### 11.1 Job

Active-active SaaS with a 99.95% availability target.

### 11.2 Topology

```text
                  edge
                 /    \
        gateway_a      gateway_b
        eu-west-2      us-east-1
            |              |
          app_a          app_b
             \            /
          postgres_primary
                 |
         postgres_replica
          cross-region

            redis_global
```

### 11.3 Distinctive failure

**Regional loss and traffic rebalance.**

Default traffic split: 50/50.

`fail_region('us-east-1')` makes region-B runtime nodes unavailable.

If routing remains 50/50, traffic assigned to B fails and availability misses target.

### 11.4 Legal remediations

- `set_region_traffic_split({ primaryPercent })`
- `set_autoscaling(app_a, ...)`
- `set_autoscaling(api_gateway_a, ...)`
- `restore_component(...)` for component failures
- optional same-region replica only if statically declared legal by the reference

### 11.5 Human interrupt

The Bench exposes a human **Primary traffic allocation** control using the same `setRegionTrafficSplit` domain command as the WebMCP remediation tool.

Preferred competition interrupt:

1. Agent begins region-aware recovery from version N.
2. Human directly changes primary traffic allocation (for example 60% -> 100%) while the agent is scaling or rerouting.
3. Version increments and packet density reflows on the next tick.
4. Any agent mutation based on N is rejected with `STALE_STATE`.
5. Agent re-reads live capacity/headroom and completes scaling for the human-selected routing state.

A second hard-constraint beat may pin **No second region**. The secondary region remains drawn but becomes hatched/excluded; attempts to use it return `PINNED_NO_SECOND_REGION`.

The pin changes **solution space**, not the static reference topology.

### 11.6 Required visual behaviour

- Region boundaries are visually clear.
- Failed region is hatched/red; packets stop entering it.
- Traffic-density shift from 50/50 to 100/0 is obvious.
- Surviving region changes from warning to healthy only after sufficient scaling.
- Cost changes when additional replicas are added.
- FDR clearly shows the human pin between agent actions.

---

## 12. First-class scenario C — LLM inference serving

**ID:** `llm_inference_serving`

### 12.1 Job

Serve a stable model and release candidate; ramp traffic while watching GPU utilisation, TTFT, overflow and cost.

### 12.2 Topology

```text
clients
   |
api_gateway
   |
router
  /    \
gpu_old  gpu_new
   \      /
     kv_cache
        |
   overflow_queue
   (new model path)
```

### 12.3 Distinctive failure

**New-model cutover saturates the release-candidate GPU pool.**

Defaults:

- old/new split 80/20;
- human target new model: 80%;
- new pool deliberately smaller;
- overflow queue only receives new-model excess;
- old pool remains below warning threshold.

### 12.4 Deterministic GPU model

Constraint profiles live in JSON.

Example:

```text
gpu_old:  replicas * 120 inference/s
gpu_new:  replicas * 80 inference/s
```

TTFT:

```text
utilisation < 0.70  -> 350 ms
0.70–0.90           -> 700 ms
0.90–1.00           -> 1,500 ms
> 1.00              -> 3,000 ms + overflow growth
```

Batching may increase effective throughput using a deterministic multiplier from `limits.json`, while adding configured wait time to TTFT.

These are **model assumptions**, not provider guarantees, and must be labelled as such.

### 12.5 Legal remediations

- `set_model_traffic_split({ newModelPercent })`
- `set_autoscaling(gpu_pool_new, ...)`
- `set_autoscaling(gpu_pool_old, ...)`
- `set_batching(gpu_pool_new, ...)`
- `kill_component(...)`
- `restore_component(...)`

### 12.6 Human interrupt

The model traffic slider is a first-class shared control: human UI and WebMCP both call `setModelTrafficSplit`.

Preferred competition interrupt:

1. Agent begins stabilising the new-model path from version N.
2. Human drags **New model traffic** (for example 40% -> 75%) while the agent is operating.
3. Packet densities change on the next tick and version increments.
4. A stale agent split/scale/batching action is rejected with `STALE_STATE`.
5. Agent re-reads GPU utilisation, TTFT, overflow and the new human target, then adapts capacity/batching.

A second hard-constraint beat may pin **Keep old model**, making 100% cutover illegal. The agent must leave non-zero traffic on the old pool.

### 12.7 Required visual behaviour

- Two router outbound packet densities visibly reflect traffic split.
- New GPU pool moves through healthy → saturated.
- TTFT gauge changes rather than pretending generic p95 is the only relevant metric.
- Overflow queue grows only when new-model demand exceeds capacity.
- Human split change and agent split change call the same domain command.

---

## 13. Common cost and limits registry

No live billing APIs.

`src/data/limits.json` and `src/data/prices.json` are curated snapshots.

Each entry must include provenance:

```ts
interface LimitRecord {
  id: string
  sourceType: 'provider_limit' | 'model_assumption'
  provider?: 'aws'
  region?: Region
  metric: string
  value: number
  unit: string
  sourceDate: string
  sourceUrl?: string
  notes?: string
}

interface PriceRecord {
  id: string
  provider: 'aws'
  region: Region
  unit: string
  gbpEstimate: number
  sourceDate: string
  sourceUrl?: string
  assumptions: string[]
}
```

UI label:

> **Public list-price estimate**

Never "actual cost", "your bill", or "guaranteed price".

Cost is secondary to the WebMCP loop. If cost accuracy becomes a distraction, simplify the SKU table rather than adding cloud APIs.

---

## 14. WebMCP architecture

Use the imperative API once per document for the full site tool set. Catalogue and Bench share that set.

Primary current surface:

```ts
document.modelContext.registerTool(...)
```

Use an adapter so current browser differences do not leak into domain code.

```ts
interface WebMcpRuntime {
  supported: boolean
  registerTool(...): Promise<void>
}

function resolveWebMcpRuntime(): WebMcpRuntime {
  // Prefer document.modelContext.
  // Keep any Chrome-149 compatibility fallback isolated here.
}
```

### 14.1 Lifecycle

The full site tool set registers once per document with a page-lifetime `AbortController`.

Catalogue tools (`list_architectures`, `load_architecture`) and every bench tool share that set. Changing view or architecture rebinds live handlers and does not abort the controller.

```ts
useEffect(() => {
  ensureWebMcpRegistration('resilience-forge', makeSiteTools())
}, [])
```

A full document load still registers once. Same-document `load_architecture` must not wait for a second `toolsReady`.

### 14.2 Return adapter

Domain commands return structured domain results.

A single adapter converts them to the browser's current WebMCP execute-return contract.

```ts
const domainResult = domain.enableHighThroughput(input)
return toWebMcpResult(domainResult)
```

Do not hard-code browser/MCP envelope details inside every domain command.

---

## 15. Static site tool surface

Register the union of Catalogue and Bench tools once. Irrelevant remediations stay callable and return `ILLEGAL_MOVE`, `UNKNOWN_NODE`, or `NO_BENCH_LOADED` rather than disappearing from the catalog.

All Bench scenarios expose the common read tools. Architecture-specific mutations are always listed; legality is enforced in the domain layer.

### 15.1 Common read tools

| Tool | Purpose | Minimum structured content |
|---|---|---|
| `get_webmcp_status` | capability, toolsReady, session, registered names | toolsReady, view, loadedArchitectureId, expectedToolCount |
| `get_catalogue_guide` | how to pick and load a reference | loop, architectures |
| `list_architectures` | three equal GCP references | architectures[] |
| `load_architecture` | same-document navigation onto a bench | id or alias such as checkout, saas, llm |
| `get_bench_guide` | signature loop and legal remediations | error codes, pins, remediationPaths |
| `get_architecture` | semantic graph and runtime topology | architectureId, nodes, edges, effective health, failed/excluded regions/zones, store version |
| `get_scenario` | current human intent | scenario values, pins, targets, budget, current traffic/split controls, routing, store version |
| `get_live_metrics` | machine-readable operational state | SimResult plus per-node demand, served throughput, capacity, utilisation/headroom, queue depth/overflow, TTFT where relevant, routing, and `observations[]` |
| `get_constraints` | machine-readable limits and assumptions | applicable constraint records, current usage, headroom, sourceType, sourceDate and source URL when provider-sourced |
| `get_bench_snapshot` | one-tick atomic read | scenario, topology, metrics, constraints, RCA, storeVersion, tick |
| `get_decision_log` | Flight Data Recorder | ui / webmcp / sim entries, versions, result codes |
| `preview_change` | read-only projection | projectionSucceeded, before/after, unchanged storeVersion |

`observations[]` contains factual machine tokens, not recommendations. Example:

```json
[
  {
    "code": "CAPACITY_BREACH",
    "nodeId": "sqs_fifo",
    "demand": 10000,
    "capacity": 4500,
    "unit": "msg/s"
  }
]
```

A judge should be able to see that WebMCP gives the browser agent semantic access to live application state that would otherwise require scraping multiple UI surfaces.

### 15.2 Common control/failure tools where legal

| Tool | Purpose |
|---|---|
| `run_stress_test` | start deterministic stress run |
| `fail_component` | hard outage of a component |
| `restore_component` | restore a killed component |
| `set_fault_profile` | inject latencyMs and packetLossPercent |
| `set_region_fault_profile` | apply the same fault at a regional boundary |
| `ramp_fault_until` | ramp a fault in one versioned mutation |
| `apply_remediation_plan` | atomic multi-step remediation; cannot bypass pins |

### 15.3 Checkout-specific tools

| Tool | Purpose |
|---|---|
| `fail_zone` | fail a zonal runtime slice |
| `set_autoscaling` | change service autoscaling bounds |
| `enable_high_throughput` | change FIFO mode |
| `set_batching` | configure FIFO batching |
| `add_read_replica` | add legal same-region DB replica |

### 15.4 Multi-region-specific tools

| Tool | Purpose |
|---|---|
| `fail_region` | fail one configured region |
| `set_region_traffic_split` | rebalance traffic |
| `set_autoscaling` | scale surviving gateway/app |

### 15.5 LLM-serving-specific tools

| Tool | Purpose |
|---|---|
| `set_model_traffic_split` | set release-candidate share |
| `set_autoscaling` | scale GPU pools |
| `set_batching` | set GPU batching behaviour |

Tool names are stable. Do not grow the surface without removing or replacing something.

### 15.6 Mutating tool schema

Every mutating tool carries `expectedVersion`.

Example:

```json
{
  "id": "sqs_fifo",
  "maxBatch": 10,
  "waitMs": 5,
  "expectedVersion": 42
}
```

Errors are structured:

```json
{
  "ok": false,
  "code": "PINNED_NO_SECOND_REGION",
  "message": "Secondary region is excluded by a pinned human constraint.",
  "currentVersion": 43
}
```

Allowed error codes:

- `STALE_STATE`
- `PINNED_NO_SECOND_REGION`
- `PINNED_BUDGET`
- `PINNED_FIFO_ORDERING`
- `PINNED_KEEP_OLD_MODEL`
- `PINNED_AWS_ONLY`
- `ILLEGAL_MOVE`
- `UNKNOWN_NODE`
- `NOT_RUNNING`
- `ALREADY_RUNNING`

---

## 16. FDR — Flight Data Recorder

The FDR is not a chat transcript.

Bottom ticker, newest last, last 30 entries, auto-scroll, copyable.

Format:

```text
10:42:03 webmcp get_architecture {} v41>41 OK
10:42:05 webmcp run_stress_test {"trafficMultiplier":1} v41>42 OK
10:42:08 ui pin_decision {"pin":"keep_fifo_ordering","enabled":true} v42>43 OK
10:42:09 webmcp set_batching {"id":"sqs_fifo","maxBatch":10,"expectedVersion":42} v43>43 STALE_STATE
10:42:10 webmcp get_scenario {} v43>43 OK
10:42:12 webmcp set_batching {"id":"sqs_fifo","maxBatch":10,"expectedVersion":43} v43>44 OK
```

Read tools append to FDR but do not mutate architecture.

Mutating tools append and visibly affect canvas/gauges on the same or next simulation tick.

---

## 17. UI behaviour and live causality

### 17.1 Human controls

Human-only capability:

- choose/load reference;
- return to Catalogue;
- stop stress test.

Human UI controls that mutate the **same domain state the agent operates**:

- peak RPS and budget;
- pins;
- Checkout ordered-event and workload controls;
- Multi-region primary traffic allocation;
- LLM new-model traffic split;
- Run stress test;
- any failure buttons exposed for judge/manual testing.

These controls remain enabled while the external agent is operating. Do not lock the Bench, grey out controls, or introduce an "agent has control" mode. Normal human use is the interruption mechanism.

### 17.2 Visual causality

When WebMCP mutates state:

1. FDR entry appears.
2. affected node/edge highlights;
3. changed property briefly shows before → after;
4. packet motion changes on next tick;
5. gauges recompute;
6. highlight fades.

When a human changes a pin/control:

1. UI changes immediately;
2. store version increments;
3. FDR gets a `ui` entry;
4. simulation recomputes on next tick;
5. stale agent tool calls are rejected.

### 17.3 Competition proof requirement

Within a single continuous demo shot, the viewer must be able to correlate:

```text
human control change
      -> store version change
      -> stale WebMCP mutation rejected
      -> WebMCP re-read of semantic state
      -> different legal remediation
      -> canvas / packet / gauge change
```

No cutaway to code or narration may be required to understand this causal chain.

---

## 18. Repo layout

```text
/
├── README.md
├── LICENSE
├── package.json
├── index.html
├── BUILD-SPEC.md
├── SCREEN-FLOWS.md
├── TEST-ACCEPTANCE.md
├── mockups/
└── src/
    ├── app/
    ├── views/
    │   ├── CatalogueView.tsx
    │   └── BenchView.tsx
    ├── components/
    │   ├── graph/
    │   ├── scenario/
    │   ├── gauges/
    │   └── fdr/
    ├── store/
    │   └── store.ts
    ├── domain/
    │   ├── commands.ts
    │   ├── constraints.ts
    │   ├── pins.ts
    │   └── results.ts
    ├── sim/
    │   ├── engine.ts
    │   ├── checkout.ts
    │   ├── multiRegion.ts
    │   └── llmServing.ts
    ├── webmcp/
    │   ├── runtime.ts
    │   ├── registerCommonTools.ts
    │   ├── registerCheckoutTools.ts
    │   ├── registerMultiRegionTools.ts
    │   ├── registerLlmTools.ts
    │   └── resultAdapter.ts
    └── data/
        ├── architectures/
        │   ├── event_driven_checkout.json
        │   ├── multi_region_saas.json
        │   └── llm_inference_serving.json
        ├── limits.json
        └── prices.json
```

---

## 19. Implementation order — vertical slices, not a hero scenario

Do not complete checkout and postpone the other two.

### Phase 1 — Three static references

- Catalogue renders all three equal cards.
- Every card loads its static topology onto the Bench.
- Shared Canvas shell and scenario rail work for all three.

### Phase 2 — Shared store and scenario controls

- discriminated `Scenario`;
- versioning;
- pins;
- FDR;
- common gauges;
- per-scenario controls.

### Phase 3 — One distinctive simulation path per scenario

Before adding WebMCP remediation:

- checkout can visibly jam FIFO;
- SaaS can visibly lose a region;
- LLM can visibly saturate new GPU path.

If any one of these is missing, do not proceed to cosmetic polish.

### Phase 4 — Common WebMCP read path

For all three:

- tool lifecycle;
- SITE TOOLS lamp;
- four read tools;
- FDR read entries.

### Phase 5 — One full WebMCP remediation loop per scenario

- checkout: high throughput + batching;
- SaaS: reroute + scale surviving region;
- LLM: adjust split + scale/batch new pool.

### Phase 6 — Human interrupt and stale-state recovery for all three

Each scenario must have a deterministic **ordinary-control** interrupt test:

- checkout: peak RPS or budget changes mid-agent action;
- multi-region: primary traffic allocation changes mid-agent action;
- LLM serving: new-model split changes mid-agent action.

Pins are then tested separately as hard constraints.

### Phase 7 — Graph motion and causal highlights

Implement packet states for all references before adding ornamental UI polish.

### Phase 8 — Cost, accessibility, deployment, README and video

---

## 20. Time-pressure policy

**Never cut a scenario.**

If time is short, cut cross-cutting breadth in this order:

1. reduce cost breakdown detail while keeping one estimate per scenario;
2. remove optional manual `kill_component` controls from UI while retaining tool coverage where needed;
3. reduce inspector detail;
4. reduce secondary animation flourishes;
5. reduce extra pricing SKUs;
6. simplify non-essential responsive layouts.

Never cut:

- any Catalogue card;
- any scenario's distinctive failure;
- any scenario's legal remediation;
- any scenario's human interrupt;
- stale-state protection;
- FDR;
- packet three-state behaviour;
- WebMCP registration;
- the two-view information architecture.

A smaller but complete three-scenario product is preferable to one polished scenario and two decorative cards.

---

## 21. Definition of done — product

- Live HTTPS URL.
- Exactly three equal Catalogue cards.
- Exactly two routes.
- All three references load onto the same Bench shell.
- All three run deterministic simulation.
- Each has a distinct visible failure.
- Each has at least one successful WebMCP remediation.
- Each has a human interrupt that changes the solution path.
- Each demonstrates an ordinary live control change while the agent is operating; pins are not the sole interrupt mechanism.
- Stale mutation returns `STALE_STATE`.
- Pins are domain enforced.
- UI and WebMCP use shared domain commands.
- WebMCP read tools expose semantic demand/capacity/headroom/provenance, not just DOM-equivalent labels.
- Bench controls remain usable while WebMCP actions are in flight.
- FDR records UI and WebMCP.
- SITE TOOLS lamp reports registration state.
- Packet animation has healthy, saturated and down states.
- Cost is labelled **public list-price estimate**.
- Public/provider limits distinguish provider source from model assumptions.
- App works with WebMCP unavailable.
- Public repository has MIT licence and README judge instructions.

---

## 22. Demo video — 2:30 maximum

All scenarios must appear as real working references.

Recommended structure:

### 0:00–0:15 — Catalogue

Show the three equal references and explain:

> "Catalogue SITE TOOLS are live. The agent can load a reference, or I can."

Load checkout via `load_architecture` or Load onto bench.

### 0:15–1:05 — Checkout signature WebMCP loop

- show 10k workload and ordered events;
- external agent reads semantic graph/constraints;
- stress run jams FIFO;
- agent starts remediation;
- human raises peak RPS or changes budget **using the normal Bench control**;
- stale agent mutation is visibly rejected;
- agent re-reads demand/capacity/headroom and completes high-throughput + batching remediation;
- packets clear and SLO passes.

### 1:05–1:40 — Multi-region SaaS

- switch from Catalogue manually;
- fail region;
- traffic loss visible;
- agent reroutes;
- human directly changes primary traffic allocation while the agent is operating;
- agent re-reads and scales primary for the new live routing state;
- briefly demonstrate no-second-region as a separate hard constraint if time permits.

### 1:40–2:15 — LLM inference serving

- load manually;
- new GPU saturates and TTFT/overflow rise;
- agent starts stabilising it;
- human drags the model split while the agent is operating;
- stale action is rejected and the agent re-reads GPU/TTFT/overflow state;
- agent settles on a safe split/capacity; briefly show keep-old-model as a hard constraint.

### 2:15–2:30 — Proof

Briefly show FDR with UI + WebMCP + stale-state events and SITE TOOLS lamp.

Do not spend the ending on a generic feature list.

---

## 23. README judge prompt

README must include a short test script:

1. Open live app in ChatGPT in-app browser or supported WebMCP-enabled browser.
2. Choose any reference manually.
3. Ask the agent to inspect the loaded architecture and current constraints.
4. Ask it to stress the architecture and recover it without violating pinned decisions.
5. Change an ordinary live control while the agent is working (peak load, region traffic allocation or model split).
6. Observe `STALE_STATE`, a semantic re-read, revised remediation and visible graph changes.
7. Then add a pin and verify that it is enforced as a hard constraint.
8. Repeat with either of the other references.

The README must explain that all pricing is curated public list-price estimation and that simulation numbers are intentionally inspectable models, not production sizing claims.

---

## 24. Copy rules

Allowed:

- reference
- bench
- scenario
- pin
- stress
- zone
- region
- capacity
- cap
- SLO
- public list-price estimate
- TTFT
- split
- SITE TOOLS
- Flight Data Recorder / FDR

Banned:

- copilot
- agent mode
- coworker
- magic
- AI-powered
- intelligent
- assistant
- chat
- prompt
- generate

SITE TOOLS is a status lamp, not a route or trophy page.

---

## 25. Source snapshots and technical notes

Build against current WebMCP behaviour at implementation time.

Current official references consulted for this spec:

- OpenAI WebMCP Challenge: https://openai.com/webmcp-challenge/
- Devpost official rules: https://webmcp.devpost.com/rules
- Chrome WebMCP overview: https://developer.chrome.com/docs/ai/webmcp
- Chrome WebMCP imperative API: https://developer.chrome.com/docs/ai/webmcp/imperative-api
- WebMCP explainer/reference: https://github.com/webmachinelearning/webmcp
- AWS SQS FIFO quotas: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html

Important implementation note: the WebMCP API is experimental. Prefer `document.modelContext`; keep any older-Chrome compatibility isolated in `src/webmcp/runtime.ts`. Use `AbortController` registration lifecycle. Do not let browser API churn affect the domain layer.

---

## 26. Final build principle

When forced to choose between an extra feature and clearer human-agent causality, choose causality.

When forced to choose between a special "AI interaction" control and letting the human use the product normally while the agent works, choose normal product interaction.

When forced to choose between making one scenario prettier and making another scenario executable, make the other scenario executable.

**The submission is three reference architectures, one shared bench, one truth, and one visible human-agent loop.**
