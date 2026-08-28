# Demo video — shot list (max 2:30)

Record in **ChatGPT desktop in-app browser** so SITE TOOLS is green. No provider logos. No copyrighted music. Audio must explain what you built and how you used WebMCP. Judges are not required to watch past three minutes.

Capture a still of the green SITE TOOLS lamp from this same session and drop it in `docs/` as `site-tools-green.png`. Standard browsers cannot produce that still.

## 0:00–0:15 — Catalogue

Show three equal cards.

Say: “I choose the architecture. The browser agent cannot.”

Load Event-driven checkout.

## 0:15–1:05 — Signature loop

- Peak load at 10k, ordered Pub/Sub.
- Paste the README judge prompt (or ask Codex to inspect and stress).
- SITE TOOLS green. Agent calls `get_bench_guide` / `get_bench_snapshot`.
- Stress jams the queue. Packets densen.
- Agent starts remediation (`expectedVersion` on screen via FDR).
- **You** drag Peak load up while it works.
- FDR: `ui set_peak_rps` then `webmcp … STALE_STATE`. Red banner on the bench.
- Agent calls `get_decision_log`, retries, packets clear, SLO can pass.

This beat must be readable without a code cutaway.

## 1:05–1:40 — Multi-region

Catalogue → Multi-region SaaS. Fail us-east4. Agent reroutes. You move Primary traffic allocation. Stale write, re-read, scale for the human split.

## 1:40–2:15 — LLM serving

Load LLM inference. New-model path saturates. You drag New model traffic. Agent adapts split/capacity. Optional: pin Keep old model.

## 2:15–2:30 — Proof

Zoom FDR: `ui` + `webmcp` + `STALE_STATE`. Copy log if useful. Lamp stays green.

Do not end on a feature list.

## After recording

Upload to YouTube as public. Put the URL in Devpost. Do not change the live site after the submission period closes.
