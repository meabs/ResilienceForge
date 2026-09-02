# Resilience Forge — Screen Flows v3.1

This document defines the two-screen product flow. All three scenarios are first-class and use the same Bench shell.

## 1. Global navigation

```text
Catalogue (/)
   |
   | Human clicks "Load onto bench"
   v
Bench (/bench/:architectureId)
   |
   | Human breadcrumb/back
   v
Catalogue (/)
```

No other routes.

WebMCP tools are OFF on Catalogue and registered only on Bench.

---

# 2. Catalogue

## Layout

Three equal cards in one responsive grid:

1. Event-driven checkout
2. Multi-region SaaS
3. LLM inference serving

Each card has the same structure and CTA.

### Event-driven checkout

Job: ordered checkout events under burst load.
Distinctive failure: FIFO queue throughput.
Human interrupt: peak RPS or budget change; keep FIFO is a hard pin.
Thumbnail: API -> order -> FIFO -> payment with DB/cache branch.

### Multi-region SaaS

Job: active-active service surviving regional loss.
Distinctive failure: region disappears while traffic still points there.
Human interrupt: primary traffic allocation change; no-second-region is a hard pin.
Thumbnail: edge split across two region boxes.

### LLM inference serving

Job: ramp a release candidate without destroying TTFT/cost.
Distinctive failure: new GPU pool saturation and overflow.
Human interrupt: live model-split change; keep-old-model is a hard pin.
Thumbnail: router split to old/new GPU pools.

## Interaction

`Load onto bench` (human) and Catalogue tool `load_architecture` (agent) both navigate to `/bench/:id`.

The bench then:

1. applies scenario defaults;
2. clears runtime failure state;
3. resets FDR.

---

# 3. Bench shared shell

```text
┌─────────────────────────────────────────────────────────────────┐
│ Resilience Forge · Reference name      SITE TOOLS ●             │
├───────────────────────────────────────────────┬─────────────────┤
│                                               │ Scenario        │
│                                               │ Pins            │
│                 LIVE CANVAS                   │ Controls        │
│                                               │ Gauges          │
│                                               │                 │
├───────────────────────────────────────────────┴─────────────────┤
│ FDR: ui + webmcp + sim events                                  │
└─────────────────────────────────────────────────────────────────┘
```

Common gauges:

- availability;
- latency or TTFT;
- error/overflow;
- achieved RPS;
- public list-price estimate;
- SLO pass/fail.

Each scenario may add one scenario-specific gauge but must not change the shell.

### Shared live-control rule

Scenario controls stay interactive while WebMCP is operating. The app never enters an "agent owns the screen" mode. Human changes are normal UI events that mutate the same store, increment the same version and may invalidate an in-flight agent action.

The external agent receives semantic state through WebMCP read tools (demand, capacity, headroom, queue/overflow, TTFT, constraints and provenance); it must not depend on scraping gauges or visual labels.

---

# 4. Checkout flow

## 4.1 Loaded state

Default:

- 10,000 request/s;
- ordered events on;
- batch size 1;
- standard FIFO;
- healthy topology;
- SLO currently not proven until stress test.

Canvas prominently shows queue capacity state.

## 4.2 Stress

Human or WebMCP calls same `runStressTest`.

Visual sequence:

1. packet density rises;
2. packets arrive faster than FIFO serves;
3. queue warning halo appears;
4. queue depth rises;
5. error/latency/SLO degrades.

FDR records source and command.

## 4.3 Agent remediation

Agent reads:

- graph;
- scenario;
- current metrics;
- queue constraints.

Agent can enable high throughput and batching.

Every mutating tool carries `expectedVersion`.

## 4.4 Human interrupt

During agent remediation, the human uses a normal scenario control: raise **Peak RPS** or lower budget.

Expected:

1. UI changes immediately and version increments;
2. FDR records the ordinary UI operation;
3. current packets/gauges recompute on the next tick;
4. stale agent call returns `STALE_STATE`;
5. agent re-reads demand, capacity, headroom and constraints;
6. revised high-throughput/batching/scaling values fit the new scenario;
7. graph/gauges recover.

Then optionally pin **Keep FIFO ordering** to demonstrate a separate hard invariant.

## 4.5 Zone failure variant

Human or agent fails zone A.

Primary DB goes down if assigned to A.

Agent can add same-region read replica if legal and budget/pins permit.

---

# 5. Multi-region SaaS flow

## 5.1 Loaded state

- eu-west-2 and us-east-1 visible as equal region boxes;
- default 50/50 traffic;
- both healthy;
- active-active topology obvious from packet density.

## 5.2 Regional loss

`fail_region('us-east-1')`

Expected:

1. region B becomes red/hatched;
2. packets stop inside failed region;
3. traffic still assigned there is dropped until rerouted;
4. availability falls;
5. surviving region utilisation rises.

## 5.3 Agent remediation

Agent:

1. reads state;
2. sets region split towards eu-west-2;
3. scales surviving gateway/app;
4. re-runs/observes metrics.

## 5.4 Human interrupt

While the agent is recovering the failed region, the human directly moves **Primary traffic allocation** using the normal Bench control. Human UI and WebMCP use the same domain command.

Expected:

- store version increments;
- packet density reflows on the next tick;
- an agent action based on the previous routing state is rejected `STALE_STATE`;
- agent re-reads remaining capacity/headroom;
- agent scales A for the human-selected routing state.

Then optionally pin **No second region**. Region B remains visible but gets PIN/EXCLUDED treatment and any attempted use returns `PINNED_NO_SECOND_REGION`.

This flow is complete only if the agent can pass the scenario without silently deleting region B from the reference.

---

# 6. LLM inference serving flow

## 6.1 Loaded state

- router sends 80% old / 20% new by default;
- outbound packet densities match split;
- new GPU pool has lower capacity;
- TTFT and GPU utilisation visible.

## 6.2 Ramp / stress

Human can move target-new-model slider or agent can call same domain function.

At high new-model percentage:

- gpu_new turns warning;
- TTFT rises deterministically;
- overflow_queue accumulates packets;
- cost may rise if replicas scale.

## 6.3 Agent remediation

Agent can:

- adjust model split;
- autoscale GPU pools;
- configure batching.

## 6.4 Human interrupt

While the agent is stabilising the new-model path, the human directly drags **New model traffic**. Human slider and WebMCP tool call the same domain command.

Expected:

- split changes immediately and version increments;
- path packet densities change on the next tick;
- stale agent action is rejected;
- agent re-reads new-model demand, GPU utilisation, TTFT and overflow;
- agent adapts split/capacity/batching;
- TTFT and overflow recover.

Then optionally pin **Keep old model**. Any attempted 100% new split becomes `PINNED_KEEP_OLD_MODEL`; the old model remains visibly active.

---

# 7. FDR flow

FDR is always visible on Bench.

Read call:

```text
10:42:03 webmcp get_scenario {} v42>42 OK
```

Human edit:

```text
10:42:05 ui set_model_traffic_split {"newModelPercent":75} v42>43 OK
```

Stale agent mutation:

```text
10:42:06 webmcp set_autoscaling {"id":"gpu_pool_new","min":3,"max":6,"expectedVersion":42} v43>43 STALE_STATE
```

Semantic re-read and successful retry:

```text
10:42:07 webmcp get_live_metrics {} v43>43 OK
10:42:08 webmcp set_autoscaling {"id":"gpu_pool_new","min":4,"max":8,"expectedVersion":43} v43>44 OK
```

No prose transcript. No agent avatar.

---

# 8. SITE TOOLS lamp

Catalogue and Bench share the same lamp states:

- registering: tools are being offered to the host;
- green: current view's tool set registered;
- amber: WebMCP API unavailable;
- red: registration error.

Catalogue registers `get_webmcp_status`, `get_catalogue_guide`, `list_architectures`, and `load_architecture`.

Bench registers the architecture-specific tool set with the same lamp states.

Tooltip may show the count of registered tools but does not open a tools page.

---

# 9. Node inspector

Popover only.

Common:

- node name/kind;
- region/zone;
- replicas;
- health;
- live demand/served utilisation;
- legal remediations;
- limits with source type/date;
- estimated cost component if available.

Scenario-specific:

- queue: mode, batch size, cap, depth;
- region service: routed share;
- GPU: split share, utilisation, TTFT, batching.

---

# 10. Reduced motion

If `prefers-reduced-motion`:

- packets are frozen as directional dots;
- saturation is shown through density/halo;
- region failures remain hatching/red;
- tool/human highlights remain static for a short duration;
- no information is available only through animation.
