# Devpost submission copy

Paste these blocks into the WebMCP Challenge submission form. Keep the live URL, public repo, MIT license, and demo video fields in sync with this repository.

**Live URL:** https://resilience-forge.gman72.chatgpt.site/  
**Repo:** https://github.com/meabs/ResilienceForge  
**License:** MIT (LICENSE at repository root)

## Why this use case is a strong fit for WebMCP

Architecture review is a shared live object. A human or an agent can load a reference. The human then owns pins and ordinary controls. An agent needs demand, capacity, headroom, TTFT, pin provenance, and store version — facts that are not all visible on one DOM surface and cannot be scraped from packet motion.

WebMCP gives the agent those semantics as tools on the same page the human is using. `list_architectures` and `load_architecture` start from the Catalogue. `get_bench_snapshot` is one tick of truth. `get_decision_log` is the collaboration timeline. Mutating tools require `expectedVersion`. When the human moves Peak load, the agent does not silently overwrite; it gets `STALE_STATE` and has to re-read.

That is what WebMCP is for: structured actuation on a live session page, not a second backend API and not screenshot-guessing.

## How it creates a better user experience

The human never hands the bench over. There is no agent-owns-the-screen mode. Sliders, pins, and stress controls stay usable while SITE TOOLS run.

The agent does not click the graph. It reads observations, proposes a legal remediation, and the canvas, gauges, and FDR all move from the same store. Violet marks WebMCP mutations. Cyan marks human ones. A red `STALE_STATE` row is the proof that the human stayed in control.

SITE TOOLS is a lamp, not a chat panel. It is green on Catalogue and Bench once the full site tool set is registered.

## What people and agents can do together that was difficult or impossible before

Concurrent operation of one live architecture model:

1. Agent calls `list_architectures`, then `load_architecture` with checkout, saas, or llm. The human can also click Load onto bench.
2. Agent stresses the distinctive failure and starts a legal remediation.
3. Human raises Peak RPS, Primary traffic, or New model traffic on the ordinary control.
4. Agent’s in-flight mutation is rejected `STALE_STATE`.
5. Agent reads `get_decision_log`, sees the `ui` change, re-reads `get_bench_snapshot`, and finishes a legal remediation for the new demand.

DOM actuation cannot do optimistic concurrency. A remote MCP server would not share the visible page. WebMCP is the only contract where both operators share one versioned store in the browser.

Pins are a second joint move: `keep_pubsub_ordering` blocks unordered replacement; `apply_remediation_plan` cannot bypass that. `add_read_replica` still works as a same-region recovery even if a second-region pin is on.

## How WebMCP is implemented

- Imperative `document.modelContext.registerTool` / `registerTools` once per document. Catalogue and Bench share the same site tool set (`sessionId` `resilience-forge`).
- Page-lifetime `AbortController`. Changing view or architecture rebinds live handlers. It does not unregister tools or wait for a second `toolsReady`.
- Ready handshake: `getTools()` must list every expected name (or `toolchange`) before `html[data-webmcp-ready]=true`. After first paint, `get_webmcp_status.toolsReady` stays true across `load_architecture`.
- Architecture-specific mutations stay listed. Illegal ones return `ILLEGAL_MOVE`, `UNKNOWN_NODE`, or `NO_BENCH_LOADED`.
- Annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, plus `untrustedContentHint` on RCA. Each tool has a `title`.
- `execute` takes `{ signal }` and returns `ABORTED` if cancelled before it runs.
- UI and tools call the same domain commands. Every mutation carries `expectedVersion`.
- `get_decision_log` exposes the FDR without scraping.

Test in ChatGPT desktop’s in-app browser. Standard Chrome without the WebMCP flag stays amber on purpose. Copy-paste judge prompt is at the top of README.md.
