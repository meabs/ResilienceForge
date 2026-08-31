# Live smoke test — 2026-09-01

Target: [resilience-forge.gman72.chatgpt.site](https://resilience-forge.gman72.chatgpt.site/)

Environment: standard HTTP/browser checks plus ChatGPT desktop's in-app browser with the live WebMCP runtime. The in-app-browser run exercised real page-defined tools against the public site.

## Results

| Step | Result |
| --- | --- |
| Catalogue loads | PASS — three equal reference cards |
| `list_architectures` | PASS — checkout, saas, llm |
| `load_architecture` checkout/saas/llm | PASS — same-document navigation, `toolsUnchanged: true` |
| `get_webmcp_status.toolsReady` | PASS live — 37/37 tools ready in ChatGPT's in-app browser. Chrome without WebMCP enabled remains **AMBER**. |
| `get_bench_snapshot` | PASS — `storeVersion`, `metrics.sim`, `constraints`, `topology.nodes` |
| `get_decision_log` | PASS — `ui:load_architecture` and `webmcp` entries including `STALE_STATE` |
| Deliberate stale mutation | PASS — `STALE_STATE` |
| Retry after fresh snapshot | PASS |
| `apply_remediation_plan` vs pins | PASS — `PINNED_KEEP_PUBSUB_ORDERING` and `PINNED_NO_SECOND_REGION` |
| Checkout stress / remediation | PASS live — queue bottleneck fails, stale write is rejected, ordered-key parallelism + bounded batching recover 12k RPS to a passing SLO |
| Multi-region fail / recovery | PASS — `us-east4` failed; reset clears it |
| LLM ramp / remediation | PASS — stress + `set_model_traffic_split`; reset restores 20% |
| `reset_scenario` on all three | PASS — stress off, `sloStatus: not_tested`, no leaked faults/regions |
| Tools after architecture switch | PASS — `load_architecture` keeps `toolsReady` / `toolsUnchanged` |
| No stale scenario leak | PASS — saas has no checkout queue; llm has empty `failedRegions` |
| FDR after tool calls | PASS — immediate `webmcp` rows |
| Canvas / gauges on mutations | PASS — queue depth, regional failure, model split |
| Reduced motion | PASS — SLO/queue still update with motion reduced |
| Live site without WebMCP | PASS — logged-out HTTPS 200; without a WebMCP runtime, SITE TOOLS is intentionally amber. |
| Public GitHub logged-out | PASS — `https://github.com/meabs/ResilienceForge` HTTP 200, `logged_in=no` |
| `npm test` | PASS — 66 tests |
| Live ChatGPT in-app-browser render | PASS — HTTPS page rendered with SITE TOOLS LIVE, 37/37 tools and no console errors. |
| Live host WebMCP calls | PASS — catalogue read, architecture load, snapshot, stress, workload change, `STALE_STATE`, decision-log readback, revised remediation, SLO recovery and reset |

## Judge path (WebMCP browser)

Use the plain-language **Recommended judge walkthrough** at the top of `README.md`. It gives unfamiliar judges exact UI directions and requires no tool names: load Event-driven checkout, paste the supplied prompt, move Peak load when asked, enable the ordering pin when asked, and observe the gauges and Flight Data Recorder.

`docs/site-tools-green.png` is the Catalogue still with SITE TOOLS LIVE. Recapture it in ChatGPT in-app if the host lamp chrome differs.
