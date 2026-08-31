# Resilience Forge

Resilience Forge is a shared human-and-browser-agent operations bench for testing architecture references under pressure. A human or an agent loads a reference from the Catalogue. The human constrains it with pins and ordinary controls. An external browser agent stresses the live state, proposes a legal remediation, and has to recover from stale writes when the human changes the bench first.

- **Live project:** [resilience-forge.gman72.chatgpt.site](https://resilience-forge.gman72.chatgpt.site/)
- **Public source:** [github.com/meabs/ResilienceForge](https://github.com/meabs/ResilienceForge)
- **License:** [MIT](./LICENSE)
- **Submission draft:** [devpost-submission.md](./devpost-submission.md)
- **Submission copy:** [docs/DEVPOST.md](./docs/DEVPOST.md)
- **Demo video script:** [docs/DEMO-VIDEO.md](./docs/DEMO-VIDEO.md)

## Judge prompt

Open the live URL in **ChatGPT desktop’s in-app browser** and wait for **SITE TOOLS** to turn green. Chrome also works when WebMCP testing is enabled. The agent discovers the available actions from the site, so judges do not need to know or type any tool names.

### Recommended judge walkthrough

#### 1. Open the bench

1. Open the live project and wait for the **SITE TOOLS** lamp in the top-right area to turn green and say **LIVE**.
2. The Catalogue shows three equal architecture cards. On **Event-driven checkout**, click **Load onto bench**.
3. On the Bench, the architecture graph is the large canvas. The gauges run across the top, the human controls and constraints are in the right-hand rail, and the **Flight Data Recorder** is the strip along the bottom.

#### 2. Paste this prompt

The agent discovers and uses the site's capabilities itself:

```
Act as an architecture reviewer working with me on this live Resilience Forge bench. Discover and use the site's available actions yourself; do not ask me for tool names or technical commands.

First, inspect the loaded architecture and briefly explain its topology, workload, service targets, cost, human constraints, and the most important demand, capacity, utilisation, headroom, queue, and provenance evidence available to you. Distinguish provider limits from simulation assumptions, and do not claim this model proves production resilience.

Run the characteristic stress test. Diagnose the failure from live evidence and prepare a complete, legal remediation. Explain the proposed changes and their capacity, latency, ordering, and cost trade-offs, but do not apply them yet. Tell me **CHANGE PEAK LOAD NOW** and wait.

After I reply **continue**, first attempt the exact plan you prepared from the earlier state without silently refreshing it. The site should protect my newer decision by rejecting that stale action. Then inspect the audit trail and current state, explain what I changed, revise the remediation for the latest workload, and apply the revised plan safely. Verify the result against the service targets and compare before and after.

Next, tell me **ENABLE THE ORDERING PIN NOW** and wait. After I reply **pinned**, test an incompatible unordered shortcut so the site visibly rejects it without changing the architecture. Then show that a legal ordered alternative remains available. Do not bypass the pin.

Throughout the walkthrough, narrate what changes in the graph, gauges, root-cause panel, and Flight Data Recorder. Finish by explaining why semantic site access, stale-state protection, atomic remediation, and hard human constraints make this safer than an agent clicking through a dashboard. Briefly describe the distinct regional-failure and LLM-serving investigations available in the other two references.
```

#### 3. Make the two human changes

The agent will pause twice. Leave the page open while making these changes:

1. When it says **CHANGE PEAK LOAD NOW**, find **Live controls** at the top of the right-hand rail. Move the **Peak load** slider from 10,000 to 12,000 req/s, then reply **continue** in ChatGPT. Watch the bottom Flight Data Recorder record the human change, the rejected stale agent action, the semantic re-read, and the successful revised remediation.
2. When it says **ENABLE THE ORDERING PIN NOW**, find **Human pins** immediately below Live controls. Click **Keep Pub/Sub ordering keys** until its state reads **ON**, then reply **pinned**. Watch for the incompatible agent action to be rejected while the graph and human setting remain unchanged.

The gauges should finish with full availability, recovered throughput and a passing SLO. If the walkthrough needs a clean restart, click **Reset scenario** near the top of the right-hand rail and reload the reference before trying again.

This path demonstrates semantic architecture evidence, provider provenance, distinctive failure, root-cause analysis, plan trade-offs, an ordinary human interruption, stale-state protection, audit-driven recovery, atomic remediation, visible causality, SLO recovery, and separately enforced hard constraints—without requiring the judge to know the underlying API.

For a shorter check, paste: “Stress this loaded reference, explain the failure from live evidence, fix it safely, and show me what changed.”

The build follows the project documents in this repository:

- [BUILD-SPEC.md](./BUILD-SPEC.md) — historical v3.1 planning brief; current GCP behavior is defined by the code and acceptance tests
- [TEST-ACCEPTANCE.md](./TEST-ACCEPTANCE.md) — acceptance criteria and video checklist
- [PRODUCT.md](./PRODUCT.md) — product definition and positioning
- [docs/](./docs/) — hero screenshots for judges and Devpost gallery

Product surface:

- three equal architecture references: event-driven checkout, multi-region SaaS, and LLM inference serving;
- one catalogue route and one bench route with a shared in-memory state;
- GCP-native reference components across every scenario: Pub/Sub, Cloud Run, Cloud SQL, Memorystore, Vertex AI, API Gateway, and a global external Application Load Balancer;
- deterministic simulation, visible failure modes, operator pins, and a forensic decision record (FDR);
- structured WebMCP tools that read and mutate the same state as the visible controls.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/` and load a reference onto the bench. To exercise the intended judge path:

1. Load any of the three references.
2. Run the scenario stress test and inspect the failing node, metrics, and FDR.
3. Change an ordinary control while the stress is active.
4. Ask an external browser agent to read state, attempt a remediation, and recover from the expected `STALE_STATE` response.
5. Add a constraint pin, repeat the test, and verify the legal remediation set changes.

The scenario model is intentionally deterministic and uses public list-price estimates. It is a competition demonstration, not production capacity planning. No live provider pricing or infrastructure APIs are required. The topology vocabulary follows Google Cloud patterns: ordering-key delivery in Pub/Sub, multi-region Cloud Run behind a global external Application Load Balancer, Cloud SQL cross-region replication, and Vertex AI endpoint traffic splits.

Each bench exposes availability-zone replica placement and universal WebMCP fault injection. `set_fault_profile` can apply bounded latency and request dropout to any declared component or connection; `clear_fault_profile` and `clear_all_faults` restore the fault plane without changing load, scaling, traffic allocation, pins, or zone state. Fault impact is traffic-weighted, reflected in component and edge telemetry, and recorded in the Flight Data Recorder.

`get_root_cause_analysis` is a read-only WebMCP diagnostic. It ranks live zone, region, component, connection, dropout, latency, and capacity evidence; reports the observed impact and causal chain; and recommends only recovery tools the loaded bench exposes.

## Build

```bash
npm test
npm run lint
npm run build
npm start
```

The production build is emitted by Vinext for the Cloudflare Workers-compatible ChatGPT Sites runtime. The repository includes all application source, tests, styles, assets, lockfile, and hosting configuration required to reproduce the project. No secrets or external infrastructure accounts are required.

## Competition submission notes

This repository was first committed on 27 August 2026, after the WebMCP Challenge build period opened. The WebMCP implementation and the dated hardening work are visible in the public history, including `4cb7cec`, `b0de315`, `c0fcbf9`, and `31bf380`. If the app existed outside this repository before the build period, use the Existing-project explanation in [devpost-submission.md](./devpost-submission.md) instead of selecting New.

The submission draft is intentionally separate from the form: replace its TODO fields with your own eligibility details, tested clients, AI tools, learning level, career-value answer, and public YouTube URL. Do not submit until the live URL, public repository, video, and ChatGPT in-app-browser WebMCP path have each been rechecked after the final deploy.

## WebMCP implementation

The browser-facing integration is in [`app/webmcp.ts`](./app/webmcp.ts). The full site tool set registers once per document against a page-lifetime `AbortSignal`. Catalogue and Bench share that set; `load_architecture` is a same-document navigation and does not re-register. Registration must finish before `ready` / `toolsReady` becomes true. When the host exposes catalogue discovery, readiness also waits until `getTools()` lists every expected name, either by polling or after a `toolchange` event. Hosts without catalogue discovery use successful registration as the readiness boundary. Agents can wait for `html[data-webmcp-ready="true"]`, the `webmcp-tools-ready` event, or `get_webmcp_status.toolsReady`. `html[data-webmcp-capability]` is published before discovery completes so hosts can distinguish support from readiness.

Each tool contains `name`, `title`, `description`, a complete object `inputSchema`, annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, plus `untrustedContentHint` on RCA), and `execute`. The second `execute` argument is an extras object; when `extras.signal` is already aborted, execution returns `ABORTED` before calling the domain handler. Live handlers rebind across Catalogue/Bench route transitions and React view remounts inside the same document, so the registered catalogue is reused while the visible reference changes. Separate browser tabs have separate documents and sessions.

`get_decision_log` is the agent-readable Flight Data Recorder. After `STALE_STATE`, the agent can see the human `ui` operation that moved the version without scraping the ticker. Successful mutations return `{ before, after }` availability/SLO snapshots; rejected stale or pinned actions return structured rejection data without changing state. The FDR ticker shows the last 30 operator events, is copyable, and flashes on `STALE_STATE`.

### Common tools (all architectures)

The following snippets are abridged interface examples, not copyable source. The real registrations add titles, annotations, complete JSON Schemas, required fields, enums, bounds, compatibility aliases, and wrapped cancellation handling in [`app/resilience-forge.tsx`](./app/resilience-forge.tsx).

```ts
document.modelContext.registerTool({ name: 'get_webmcp_status', description: 'Read WebMCP capability, toolsReady, session id, and registered tool names.', inputSchema: {}, execute: async (input) => read('get_webmcp_status', input) });
document.modelContext.registerTool({ name: 'get_catalogue_guide', description: 'Read how to pick a catalogue simulation and load it onto the live bench.', inputSchema: {}, execute: async (input) => read('get_catalogue_guide', input) });
document.modelContext.registerTool({ name: 'list_architectures', description: 'List the three equal GCP reference simulations.', inputSchema: {}, execute: async (input) => read('list_architectures', input) });
document.modelContext.registerTool({ name: 'load_architecture', description: 'Load a catalogue simulation onto the live bench. Same-document navigation. Does not re-register tools.', inputSchema: { id: { type: 'string' } }, execute: async (input) => mutate('load_architecture', input) });
document.modelContext.registerTool({ name: 'get_bench_guide', description: 'Read the signature human-agent loop, valid remediation paths, pin semantics, and error codes for this bench.', inputSchema: {}, execute: async (input) => read('get_bench_guide', input) });
document.modelContext.registerTool({ name: 'get_architecture', description: 'Read the current semantic topology, health, failures, exclusions, and store version.', inputSchema: {}, execute: async (input) => read('get_architecture', input) });
document.modelContext.registerTool({ name: 'get_scenario', description: 'Read current human scenario controls, targets, pins, and store version.', inputSchema: {}, execute: async (input) => read('get_scenario', input) });
document.modelContext.registerTool({ name: 'get_live_metrics', description: 'Read demand, served throughput, capacity, utilisation, traffic share, measurement semantics, and traffic-weighted fault contributions.', inputSchema: {}, execute: async (input) => read('get_live_metrics', input) });
document.modelContext.registerTool({ name: 'get_root_cause_analysis', description: 'Explain the current failure and return recovery actions with expected effect, prerequisites, trade-offs, and recovery kind.', inputSchema: {}, execute: async (input) => read('get_root_cause_analysis', input) });
document.modelContext.registerTool({ name: 'get_constraints', description: 'Read applicable provider-limit and model-assumption records with source dates and provenance.', inputSchema: {}, execute: async (input) => read('get_constraints', input) });
document.modelContext.registerTool({ name: 'get_bench_snapshot', description: 'Atomically read scenario, topology, metrics, constraints, RCA, version, tick, and timestamp from one simulation tick.', inputSchema: {}, execute: async (input) => read('get_bench_snapshot', input) });
document.modelContext.registerTool({ name: 'get_decision_log', description: 'Read Flight Data Recorder entries (ui / webmcp / sim) with versions and result codes. Use after STALE_STATE.', inputSchema: {}, execute: async (input) => read('get_decision_log', input) });
document.modelContext.registerTool({ name: 'preview_change', description: 'Read-only projection of a mutation. projectionSucceeded is true when the nested op would apply. Does not increment storeVersion.', inputSchema: { op: { type: 'string' }, args: { type: 'object' } }, execute: async (input) => read('preview_change', input) });
document.modelContext.registerTool({ name: 'apply_remediation_plan', description: 'Apply several legal mutations as one all-or-nothing transaction with a single expectedVersion and one version bump. Cannot bypass pins.', inputSchema: { steps: { type: 'array' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('apply_remediation_plan', input) });
document.modelContext.registerTool({ name: 'set_peak_rps', description: 'Set peak load demand in requests per second for the current scenario.', inputSchema: { peakRps: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_peak_rps', input) });
document.modelContext.registerTool({ name: 'set_budget', description: 'Set the monthly budget constraint in GBP for the current scenario.', inputSchema: { budget: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_budget', input) });
document.modelContext.registerTool({ name: 'run_stress_test', description: 'Start the deterministic stress or failure path for the loaded reference.', inputSchema: { expectedVersion: { type: 'number' } }, execute: async (input) => mutate('run_stress_test', input) });
document.modelContext.registerTool({ name: 'stop_stress_test', description: 'Stop the running stress test and leave measured failure state.', inputSchema: { expectedVersion: { type: 'number' } }, execute: async (input) => mutate('stop_stress_test', input) });
document.modelContext.registerTool({ name: 'reset_scenario', description: 'Reset the loaded reference to its operational baseline and update the visible topology and gauges.', inputSchema: { expectedVersion: { type: 'number' } }, execute: async (input) => mutate('reset_scenario', input) });
document.modelContext.registerTool({ name: 'fail_component', description: 'Fail a runtime component as a hard outage. Distinct from set_fault_profile packet loss.', inputSchema: { id: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('fail_component', input) });
document.modelContext.registerTool({ name: 'restore_component', description: 'Restore a runtime component that was killed or failed.', inputSchema: { id: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('restore_component', input) });
document.modelContext.registerTool({ name: 'fail_zone', description: 'Fail one configured availability zone while leaving the topology and surviving replicas visible.', inputSchema: { zone: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('fail_zone', input) });
document.modelContext.registerTool({ name: 'restore_zone', description: 'Restore one failed availability zone and its placed replicas.', inputSchema: { zone: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('restore_zone', input) });
document.modelContext.registerTool({ name: 'set_fault_profile', description: 'Inject deterministic latency (ms) and packet loss (%) at any declared component or connection. packetLossPercent is the unit-explicit name; dropoutPercent is an alias.', inputSchema: { targetId: { type: 'string' }, latencyMs: { type: 'number' }, packetLossPercent: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_fault_profile', input) });
document.modelContext.registerTool({ name: 'set_region_fault_profile', description: 'Apply the same latency (ms) and packet loss (%) to a regional boundary. Accepts europe-west2 / West2 / us-east4 / east4.', inputSchema: { region: { type: 'string' }, latencyMs: { type: 'number' }, packetLossPercent: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_region_fault_profile', input) });
document.modelContext.registerTool({ name: 'ramp_fault_until', description: 'Ramp latencyMs or packetLossPercent from start toward ceiling. Records every intermediate result and bumps the store once.', inputSchema: { targetId: { type: 'string' }, region: { type: 'string' }, metric: { type: 'string' }, start: { type: 'number' }, step: { type: 'number' }, ceiling: { type: 'number' }, stop: { type: 'object' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('ramp_fault_until', input) });
document.modelContext.registerTool({ name: 'clear_fault_profile', description: 'Clear injected latency and packet loss from one component or connection.', inputSchema: { targetId: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('clear_fault_profile', input) });
document.modelContext.registerTool({ name: 'clear_all_faults', description: 'Clear every injected latency and packet-loss profile while preserving load, scaling, traffic split, pins, and zone state.', inputSchema: { expectedVersion: { type: 'number' } }, execute: async (input) => mutate('clear_all_faults', input) });
```

`zone` is restricted to the loaded architecture’s configured zones. `targetId` is restricted to its declared components and connections. Every mutating tool requires `expectedVersion`; stale writes return `STALE_STATE` without overwriting human changes. Component health is `healthy`, `degraded`, `unreachable` (100% dropout), or `failed` (`fail_component`). Metrics declare whether they are instantaneous, traffic-weighted, or projected.

### Event-driven checkout tools

```ts
document.modelContext.registerTool({ name: 'set_autoscaling', description: 'Set Cloud Run autoscaling bounds. Replicas follow demand toward the target utilisation within min/max. When a zone is failed, replacement replicas are placed in surviving zones of the same region.', inputSchema: { id: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, targetUtilPercent: { type: 'number' }, enabled: { type: 'boolean' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_autoscaling', input) });
document.modelContext.registerTool({ name: 'set_ordering_key_parallelism', description: 'Set Pub/Sub ordering-key parallelism. unordered=true or orderingKeyShards<1 is unordered replacement and is rejected when keep_pubsub_ordering is pinned.', inputSchema: { id: { type: 'string' }, orderingKeyShards: { type: 'number' }, unordered: { type: 'boolean' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_ordering_key_parallelism', input) });
document.modelContext.registerTool({ name: 'set_batching', description: 'Configure Pub/Sub batching within the declared GCP model limits.', inputSchema: { id: { type: 'string' }, maxBatch: { type: 'number' }, waitMs: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_batching', input) });
document.modelContext.registerTool({ name: 'add_read_replica', description: 'Add a same-region Cloud SQL read replica. Legal even when no_second_region is pinned.', inputSchema: { id: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('add_read_replica', input) });
```

### Multi-region SaaS tools

```ts
document.modelContext.registerTool({ name: 'fail_region', description: 'Fail one configured region while keeping its reference topology visible.', inputSchema: { region: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('fail_region', input) });
document.modelContext.registerTool({ name: 'restore_region', description: 'Restore one failed region and its placed services.', inputSchema: { region: { type: 'string' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('restore_region', input) });
document.modelContext.registerTool({ name: 'set_region_traffic_split', description: 'Set the primary-region traffic allocation.', inputSchema: { primaryPercent: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_region_traffic_split', input) });
document.modelContext.registerTool({ name: 'set_latency_based_routing', description: 'Enable or disable latency-based routing on the global external Application Load Balancer.', inputSchema: { enabled: { type: 'boolean' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_latency_based_routing', input) });
document.modelContext.registerTool({ name: 'set_autoscaling', description: 'Set Cloud Run autoscaling bounds. Replicas follow demand toward the target utilisation within min/max. When a zone is failed, replacement replicas are placed in surviving zones of the same region.', inputSchema: { id: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, targetUtilPercent: { type: 'number' }, enabled: { type: 'boolean' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_autoscaling', input) });
```

### LLM inference serving tools

```ts
document.modelContext.registerTool({ name: 'set_model_traffic_split', description: 'Set the release-candidate share of model traffic. The healthy default is a 20% canary.', inputSchema: { newModelPercent: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_model_traffic_split', input) });
document.modelContext.registerTool({ name: 'set_latency_based_routing', description: 'Enable or disable latency-based routing on the model router. A slower or failed release candidate sheds traffic back to the stable endpoint.', inputSchema: { enabled: { type: 'boolean' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_latency_based_routing', input) });
document.modelContext.registerTool({ name: 'set_autoscaling', description: 'Set Vertex AI or Cloud Run autoscaling bounds. Replicas follow demand toward the target utilisation within min/max. When a zone is failed, replacement replicas are placed in surviving zones of the same region.', inputSchema: { id: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, targetUtilPercent: { type: 'number' }, enabled: { type: 'boolean' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_autoscaling', input) });
document.modelContext.registerTool({ name: 'set_batching', description: 'Configure deterministic Vertex AI batching and wait time.', inputSchema: { id: { type: 'string' }, maxBatch: { type: 'number' }, waitMs: { type: 'number' }, expectedVersion: { type: 'number' } }, execute: async (input) => mutate('set_batching', input) });
```

The `read` and `mutate` names above are documentation aliases for the page’s state-backed handlers; the live implementation is in [`app/resilience-forge.tsx`](./app/resilience-forge.tsx), and the bridge that invokes `document.modelContext.registerTool` is [`app/webmcp.ts`](./app/webmcp.ts). All tools share the same versioned state and Flight Data Recorder as the visible controls.

The experience was designed for the [WebMCP Challenge](https://openai.com/webmcp-challenge/) with the practical design guidance from [Impeccable](https://github.com/pbakaus/impeccable).

## License

MIT. See [LICENSE](./LICENSE).
