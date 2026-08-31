# WebMCP Challenge submission draft

This is a working draft for the Devpost form. It is not a submission and contains TODO fields that must be completed by the submitter. Keep the live URL, public repository, license, and demo video synchronized with the final deployed commit.

## Title

Resilience Forge

## One-line Summary

A shared human-and-agent operations bench where WebMCP exposes a live architecture simulation, versioned remediation, and visible stale-state recovery.

## Problem

Architecture reviews often describe failure modes in diagrams or prose, while the operational facts needed to respond—demand, capacity, headroom, queue depth, GPU utilization, traffic share, pins, and constraints—are scattered across a UI. A browser agent that only clicks or scrapes cannot safely collaborate with the human reviewing the design.

## Solution

Resilience Forge turns three curated reference architectures into deterministic, interactive operations benches: event-driven checkout, multi-region SaaS, and LLM inference serving. A human loads and constrains a reference with ordinary controls and pins. A WebMCP-enabled browser agent reads a semantic snapshot, runs the scenario's distinctive stress or failure, proposes a legal remediation, and adapts when the human changes the same live state. The graph, gauges, and Flight Data Recorder are all driven by one in-memory store.

## Why This Matters

The important interaction is shared control. Every mutation carries `expectedVersion`; if the human changes the bench while an agent is working, the agent receives `STALE_STATE` instead of silently overwriting the human's decision. The agent can then read the decision log and current snapshot, respect pinned constraints, and retry a legal action. This makes agent behavior inspectable and keeps the architect in control.

## How We Used AI

The app is not an AI chatbot and does not hide an AI model behind the UI. We used WebMCP as the agent-facing interface: a compatible browser client discovers structured `registerTool` tools and calls the same state-backed read and mutation commands as the visible controls. The tools expose semantic application data rather than requiring screenshot interpretation, and return machine-readable results such as `STALE_STATE`, `PINNED_*`, `ILLEGAL_MOVE`, `UNKNOWN_NODE`, and `NO_BENCH_LOADED`.

## How We Used Codex

Codex was used to audit the codebase against the official WebMCP Challenge rules, review the WebMCP registration lifecycle and public-repository readiness, identify and fix the incomplete-catalog readiness edge case, run the test/build/lint checks, and prepare this submission checklist. The final form, eligibility answers, video upload, and Devpost submission remain the submitter's responsibility.

## Key Features

- Three equal catalogue references with human and agent loading paths.
- Deterministic 2 Hz simulations with distinct checkout queue, multi-region, and LLM serving failure modes.
- Semantic reads for architecture, scenario, metrics, constraints, RCA, snapshots, and the Flight Data Recorder.
- Versioned mutations with optimistic concurrency and visible `STALE_STATE` recovery.
- Human-owned ordinary controls and hard pins that agents cannot bypass.
- Universal bounded latency/dropout fault injection plus scenario-specific remediation tools.
- One page-lifetime WebMCP registration shared across Catalogue and Bench; architecture switching rebinds handlers without rediscovery.
- Works without WebMCP; the SITE TOOLS indicator intentionally becomes amber.

## Architecture

The app is a two-view client-side experience: `/` is the Catalogue and `/bench/:architectureId` is the Bench. Static architecture and pricing/limit snapshots live in `app/data.ts`. Domain behavior is split into tested modules for availability, faults, FDR, measurements, pins, RCA, scenario reset, SLO, topology, traffic, and bench operations. `app/resilience-forge.tsx` owns the shared in-memory state and visible UI. `app/webmcp.ts` registers the full site tool set on `document.modelContext`, waits for a discoverable catalog to contain every expected name when `getTools()` is available, and binds tools to the same domain handlers.

The project is a deterministic decision-support demonstration, not production capacity-planning evidence. It uses curated public list-price estimates and model assumptions; no cloud account, backend, authentication, live billing API, or provider SDK is required.

## Testing Instructions

### Local

Requirements: Node.js 22.13+ and npm.

```bash
npm ci
npm test
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000/`. For the intended interaction, load a reference, run its stress test, change an ordinary control while a remediation is in progress, confirm a stale write is rejected, then re-read and retry. Add a pin and confirm the corresponding `PINNED_*` rule is enforced. The complete judge prompt is in `README.md`.

### WebMCP-enabled browser

Open the live URL in ChatGPT desktop's in-app browser and wait for the SITE TOOLS lamp to turn green. Follow the plain-language **Recommended judge walkthrough** at the top of `README.md`: load Event-driven checkout, paste the supplied prompt, move the visible Peak load slider when asked, and enable the visible ordering pin when asked. The agent discovers the site actions itself; judges do not need tool names. Confirm the graph, gauges and Flight Data Recorder show the human change, rejected stale action, semantic re-read, revised remediation, SLO recovery and separately enforced pin.

Standard Chrome without the WebMCP runtime is expected to show amber and still supports the visible app. The final live host check must be performed manually in the judge-compatible browser.

## Public Demo Link

https://resilience-forge.gman72.chatgpt.site/

## Public Repository Link

https://github.com/meabs/ResilienceForge

The repository contains the full source, tests, assets, lockfile, hosting configuration, instructions, and visible root `LICENSE` file with the MIT license.

## Demo Video

TODO: Upload a public YouTube video under three minutes and paste the URL here and into Devpost.

The recording plan is [`docs/DEMO-VIDEO.md`](./docs/DEMO-VIDEO.md). It keeps the product visible in the first 10–15 seconds, includes narration/audio, shows the external agent using WebMCP, demonstrates a human interrupt and `STALE_STATE`, and avoids provider logos, third-party marks, copyrighted music, and unlicensed material.

## Screenshot Shot List

- [`docs/site-tools-green.png`](./docs/site-tools-green.png): Catalogue with the full SITE TOOLS set live.
- [`docs/resilience-forge-local-desktop-signal-fixed.png`](./docs/resilience-forge-local-desktop-signal-fixed.png): checkout topology and scenario rail.
- [`docs/resilience-forge-local-multi-region.png`](./docs/resilience-forge-local-multi-region.png): multi-region traffic split and failure surface.
- [`docs/gcp-llm-desktop.png`](./docs/gcp-llm-desktop.png): LLM model split and serving topology.

Recapture the green lamp still if the host UI changes before the final upload. Do not use provider logos in the video unless you have permission; the shot list is designed to avoid them.

## Submission Readiness Notes

| Requirement | Current evidence / action |
| --- | --- |
| WebMCP-powered working app | Source registration in `app/webmcp.ts`; 37 tools observed in the live ChatGPT in-app-browser render before the final deploy. Recheck after deploy. |
| WebMCP fit / better UX / joint human-agent action | Drafted above and expanded in [`docs/DEVPOST.md`](./docs/DEVPOST.md). |
| Public live URL | `https://resilience-forge.gman72.chatgpt.site/`; recheck in the judge-compatible browser after final deploy. |
| Public source repository | `https://github.com/meabs/ResilienceForge`; push the final commit and confirm logged-out access. |
| Open-source license | Root `LICENSE` is MIT and `package.json` declares MIT. |
| Demo video | TODO: public YouTube URL, under 3 minutes, with clear audio and no unlicensed material. |
| Existing-project evidence | This repository's first commit is `8d5d1a6` on 27 Aug 2026. If the app was not public or built before the build period, select New. If it existed elsewhere, select Existing and explain the meaningful WebMCP work after 25 Aug 2026 using the public commit history. |
| Testing access | Add concise judge steps in the form if needed; no login or paid service is required. |
| Submission timing | Live deadline from Devpost rules: 3 Sep 2026 at 1:00 PM Pacific Time. Confirm the form's countdown before submitting. |

The final code review found and fixed a readiness edge case: when a host exposes `getTools()` but does not list the complete registered set, the app now remains amber and `toolsReady` remains false instead of claiming success. Local tests, lint, build, and a fresh live render must all be rerun after the final commit.

## Known Limitations

- The simulation is deterministic and intentionally educational; it is not a production sizing or resilience guarantee.
- The live judge path depends on a browser/client with WebMCP enabled. The app correctly remains usable without that runtime.
- A live ChatGPT in-app-browser check verified the HTTPS page, green SITE TOOLS status, 37/37 catalogue count, no console errors, architecture loading, stress, `STALE_STATE`, decision-log readback, revised remediation, SLO recovery and reset. Repeat the README walkthrough after the final deploy because the deployed build must match the final repository commit.
- The submitter must confirm eligibility, country, submitter type, app status, clients tested, AI tools, learning level, career value, and the YouTube URL.
- The submitter must not edit the live project after the submission deadline.

## TODO Official Form Fields

Complete these in Devpost; do not leave the placeholders in the final form.

| Field | Value to provide |
| --- | --- |
| Submitter Type | TODO: Individual / Team of Individuals / Organization |
| Country of residence | TODO: country for you and every team member, if applicable |
| Organization name | Optional; TODO if applicable |
| App Status | Likely New for this repository; confirm. Select Existing if the app was built before the challenge and use the explanation below. |
| Existing-app explanation | TODO if Existing: identify what existed before 25 Aug 2026 and describe the meaningful WebMCP extension after that date with dated public evidence. |
| Live URL | `https://resilience-forge.gman72.chatgpt.site/` |
| Testing instructions | Use the plain-language README walkthrough. Chrome without WebMCP enabled shows amber; ChatGPT's in-app browser or WebMCP-enabled Chrome should show green. |
| Public code repository | `https://github.com/meabs/ResilienceForge` |
| AI agent/client tested | TODO: list the actual WebMCP-enabled clients you personally tested, such as ChatGPT desktop in-app browser or WebMCP-enabled Chrome. |
| AI tools leveraged | TODO: list the tools actually used in development, such as Codex, Cursor, and any other tools; remove anything not used. |
| Learning level | TODO: None / Moderate / Significant |
| Gained AI career value | TODO: Yes / No |
| Demo video | TODO: public YouTube URL under three minutes with audio |

## Official Rules Reference

Review the [WebMCP Challenge rules](https://webmcp.devpost.com/rules) and the supplied rules copy before completing the form. The repository is prepared for the technical deliverables; this file does not make eligibility, intellectual-property, team, or form attestations on the submitter's behalf.
