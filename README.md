# Resilience Forge

Resilience Forge is a shared human-and-browser-agent operations bench for testing architecture references under pressure. A human or an agent loads a reference from the Catalogue. The human constrains it with pins and ordinary controls. An external browser agent stresses the live state, proposes a legal remediation, and has to recover from stale writes when the human changes the bench first.

- **Live project:** [resilience-forge.gman72.chatgpt.site](https://resilience-forge.gman72.chatgpt.site/)
- **Public source:** [github.com/meabs/ResilienceForge](https://github.com/meabs/ResilienceForge)
- **License:** [MIT](./LICENSE)
- **Submission copy:** [docs/DEVPOST.md](./docs/DEVPOST.md)
- **Demo video script:** [docs/DEMO-VIDEO.md](./docs/DEMO-VIDEO.md)

## Judge prompt

Open the live URL in **ChatGPT desktop’s in-app browser** (SITE TOOLS must be green). Standard Chrome stays amber. From the Catalogue, the agent can `list_architectures` and `load_architecture` onto the bench. On the Bench, pins and ordinary controls stay human-owned.

Paste on the Catalogue or after a reference is loaded:

```
You are on Resilience Forge. Wait until get_webmcp_status.toolsReady is true, or html[data-webmcp-ready]=true.

If you are on the Catalogue, call list_architectures, then load_architecture with checkout, saas, or llm. Site tools stay registered. Then call get_bench_guide and get_bench_snapshot.

1. Call get_bench_guide, then get_bench_snapshot.
2. Run the distinctive stress for this reference.
3. Start a legal remediation using expectedVersion from the snapshot.
4. I will change an ordinary live control (peak load, region split, or model split) while you work.
5. When you get STALE_STATE, call get_decision_log, then get_bench_snapshot, then retry with the new expectedVersion.
6. Do not violate pinned human constraints. keep_pubsub_ordering blocks unordered Pub/Sub replacement; a same-region add_read_replica stays legal.

Narrate what changed in the graph, gauges, and FDR.
```

Then change Peak load (or Primary traffic / New model traffic) while the agent is operating. Confirm FDR shows `ui` then `webmcp` `STALE_STATE`, then a successful retry.

The build follows the project documents in this repository:

- [BUILD-SPEC.md](./BUILD-SPEC.md) — agent build specification and competition demo script
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

## WebMCP implementation

The browser-facing integration is in [`app/webmcp.ts`](./app/webmcp.ts). The full site tool set registers once per document against a page-lifetime AbortSignal. Catalogue and Bench share that set; `load_architecture` is a same-document navigation and does not re-register. `ready` / `toolsReady` is set only after `registerTool`/`registerTools` finishes **and** `getTools()` lists every expected name (or `toolchange` reports the full catalog). Agents should wait for `html[data-webmcp-ready]=true`, the `webmcp-tools-ready` event, or `get_webmcp_status.toolsReady` once after first paint. `html[data-webmcp-capability]` is written on first paint so hosts can see support before discovery.

Each `tool` contains `name`, `title`, `description`, `inputSchema`, `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`), and `execute`. `execute` honors an AbortSignal as its second argument and returns `ABORTED` if cancelled before it runs. Live handlers are rebound across tab remounts so the session can continue without rediscovery when the same architecture is still loaded.

`get_decision_log` is the agent-readable Flight Data Recorder. After `STALE_STATE`, the agent can see the human `ui` operation that moved the version without scraping the ticker. Mutating tools return `{ before, after }` availability / SLO snapshots. The FDR ticker shows the last 30 operator events, is copyable, and flashes on `STALE_STATE`.

### Common tools (all architectures)

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
