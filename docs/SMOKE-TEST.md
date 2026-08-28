# Live smoke test — 2026-08-28

Target: [resilience-forge.gman72.chatgpt.site](https://resilience-forge.gman72.chatgpt.site/)

Environment: standard browser (no WebMCP runtime) plus a local mocked `document.modelContext` for SITE TOOLS green / tool-path checks. A ChatGPT desktop in-app-browser render of the current public site was also inspected; it is the required environment for a true host `toolsReady` and actual agent tool calls.

## Results

| Step | Result |
| --- | --- |
| Catalogue loads | PASS — three equal reference cards |
| `list_architectures` | PASS — checkout, saas, llm |
| `load_architecture` checkout/saas/llm | PASS — same-document navigation, `toolsUnchanged: true` |
| `get_webmcp_status.toolsReady` | PASS under mocked WebMCP (`true`). Standard Chrome stays **AMBER**. Recheck the final public version in the judge-compatible browser after deployment. |
| `get_bench_snapshot` | PASS — `storeVersion`, `metrics.sim`, `constraints`, `topology.nodes` |
| `get_decision_log` | PASS — `ui:load_architecture` and `webmcp` entries including `STALE_STATE` |
| Deliberate stale mutation | PASS — `STALE_STATE` |
| Retry after fresh snapshot | PASS |
| `apply_remediation_plan` vs pins | PASS — `PINNED_KEEP_PUBSUB_ORDERING` and `PINNED_NO_SECOND_REGION` |
| Checkout stress / remediation | PASS — queue depth rises, SLO `failing` |
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
| `npm test` | PASS — 64 tests |
| Live ChatGPT in-app-browser render | PASS — HTTPS page rendered with SITE TOOLS LIVE, 37/37 tools, and no console errors on the pre-deploy public version. |
| Automated host WebMCP calls | NOT RUN — the current browser automation model did not expose its `webmcp_list_tools` command; perform the judge path manually. |

## Judge path (manual, WebMCP browser)

1. Open the live URL in ChatGPT desktop in-app browser after deploy.
2. On Catalogue, confirm SITE TOOLS is **green** and `get_webmcp_status.toolsReady` is true.
3. `list_architectures` then `load_architecture` with checkout, saas, or llm. Do not wait for a second registration.
4. `get_bench_guide`, then `get_bench_snapshot`.
5. Run `run_stress_test`, attempt remediation, then change peak load or traffic split while the agent works.
6. Verify stale mutation returns `STALE_STATE`, FDR flashes, `get_decision_log` shows the human `ui` event, and a retry with the new `expectedVersion` succeeds.
7. Confirm `apply_remediation_plan` cannot bypass pins.

`docs/site-tools-green.png` is the Catalogue still with SITE TOOLS LIVE. Recapture it in ChatGPT in-app if the host lamp chrome differs.
