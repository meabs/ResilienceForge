# Devpost submission copy

Paste these blocks into the WebMCP Challenge submission form. Keep the live URL, public repo, MIT license, and demo video fields in sync with this repository.

**Live URL:** https://resilience-forge.gman72.chatgpt.site/  
**Repo:** https://github.com/meabs/ResilienceForge  
**License:** MIT (LICENSE at repository root)

## Why this use case is a strong fit for WebMCP

Architecture review is a shared live object. A human architect chooses the reference and the constraints. An agent needs demand, capacity, headroom, TTFT, pin provenance, and store version — facts that are not all visible on one DOM surface and cannot be scraped from packet motion.

WebMCP gives the agent those semantics as tools on the same page the human is using. `get_bench_snapshot` is one tick of truth. `get_decision_log` is the collaboration timeline. Mutating tools require `expectedVersion`. When the human moves Peak load, the agent does not silently overwrite; it gets `STALE_STATE` and has to re-read.

That is what WebMCP is for: structured actuation on a live, signed-in (here: live session) page, not a second backend API and not screenshot-guessing.

## How it creates a better user experience

The human never hands the bench over. There is no agent-owns-the-screen mode. Sliders, pins, and stress controls stay usable while SITE TOOLS run.

The agent does not click the graph. It reads observations, proposes a legal remediation, and the canvas, gauges, and FDR all move from the same store. Violet marks WebMCP mutations. Cyan marks human ones. A red `STALE_STATE` row is the proof that the human stayed in control.

SITE TOOLS is a lamp, not a chat panel.

## What people and agents can do together that was difficult or impossible before

Concurrent operation of one live architecture model:

1. Human loads Event-driven checkout (the agent cannot).
2. Agent stresses Pub/Sub and starts spreading ordering keys.
3. Human raises Peak RPS on the ordinary control.
4. Agent’s in-flight mutation is rejected `STALE_STATE`.
5. Agent reads `get_decision_log`, sees the `ui` peak-load change, re-reads metrics, and finishes a legal remediation for the new demand.

DOM actuation cannot do optimistic concurrency. A remote MCP server would not share the visible page. WebMCP is the only contract where both operators share one versioned store in the browser.

Pins are a second joint move: `keep_pubsub_ordering` blocks unordered replacement; `add_read_replica` still works as a same-region recovery even if a second-region pin is on.

## How WebMCP is implemented

- Imperative `document.modelContext.registerTool` / `registerTools` on Bench only. Catalogue registers nothing.
- Page-lifetime `AbortController`. Tools unregister when leaving Bench.
- Ready handshake: `getTools()` must list every expected name (or `toolchange`) before `html[data-webmcp-ready]=true`.
- Annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, plus `untrustedContentHint` on RCA. Each tool has a `title`.
- `execute` takes `{ signal }` and returns `ABORTED` if cancelled before it runs.
- UI and tools call the same domain commands. Every mutation carries `expectedVersion`.
- `get_decision_log` exposes the FDR without scraping.

Test in ChatGPT desktop’s in-app browser. Standard Chrome without the WebMCP flag stays amber on purpose. Copy-paste judge prompt is at the top of README.md.
