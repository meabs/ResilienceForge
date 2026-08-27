# Resilience Forge

Resilience Forge is a shared human-and-browser-agent operations bench for testing architecture references under pressure. A human loads and constrains the reference. An external browser agent stresses the live state, proposes a legal remediation, and has to recover from stale writes when the human changes the bench first.

- **Live project:** [resilience-forge.gman72.chatgpt.site](https://resilience-forge.gman72.chatgpt.site/)
- **Public source:** [github.com/meabs/ResilienceForge](https://github.com/meabs/ResilienceForge)
- **License:** [MIT](./LICENSE)

The build follows the project documents in the repository root:

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

The browser-facing integration is in [`app/webmcp.ts`](./app/webmcp.ts). Every architecture registers its live tool definitions through the standard API:

```ts
for (const tool of tools) {
  await document.modelContext.registerTool(tool, { signal });
}
```

Each `tool` contains the required `name`, `description`, `inputSchema`, and `execute` fields. Tools include topology and metric reads, stress tests, replica scaling, zone and region failures, universal component/connection fault injection, and evidence-based root-cause analysis. All tools share the same versioned state and Flight Data Recorder as the visible controls.

The experience was designed for the [WebMCP Challenge](https://openai.com/webmcp-challenge/) with the practical design guidance from [Impeccable](https://github.com/pbakaus/impeccable).

## License

MIT. See [LICENSE](./LICENSE).
