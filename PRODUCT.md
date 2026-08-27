# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: a small React + Vite site compatible with ChatGPT Sites, keeping the product surface fast to inspect and easy to run locally.

## Users

Platform architects, reliability engineers, and technical evaluators who want to inspect how a known reference architecture behaves under a deterministic failure or load scenario.

## Product Purpose

Resilience Forge lets a human choose and constrain a reference architecture, then operate that same live bench while an external browser agent reads semantic state, applies legal remediation, and adapts when the human changes the scenario.

## Positioning

The product makes the human-agent collaboration legible in one shared state: the human chooses the reference and can change ordinary controls at any moment; the external agent stresses and remediates it through structured WebMCP tools; stale writes are rejected instead of silently overwriting the human's decision.

## Operating Context

The site is evaluated in ChatGPT's in-app browser or a WebMCP-enabled browser. A judge selects one of three first-class references from the Catalogue, runs its Bench, observes graph motion and gauges, and uses FDR entries to correlate UI operations, WebMCP calls, and simulation changes.

## Capabilities and Constraints

- Exactly two views: Catalogue and Bench.
- Exactly three equal reference architectures: event-driven checkout, multi-region SaaS, and LLM inference serving.
- One in-memory store with a deterministic 2 Hz simulation loop.
- UI and WebMCP mutations share domain commands and optimistic version checks.
- WebMCP tools register only on Bench and are architecture-specific.
- The site must work without WebMCP support and must label public list-price estimates and model assumptions honestly.
- No in-app assistant, chat, agent ownership mode, authentication, backend, live billing APIs, or production sizing claims.

## Brand Commitments

Resilience Forge. The supplied brief defines the product voice as precise, calm, operational, and inspectable. It uses the vocabulary reference, bench, scenario, pin, stress, SLO, TTFT, SITE TOOLS, and Flight Data Recorder / FDR.

## Evidence on Hand

The repository contains BUILD-SPEC.md, SCREEN-FLOWS.md, TEST-ACCEPTANCE.md, and the expanded Resilience_Forge_Build_Documentation_v3_1.docx. These are the source of truth for product behavior. No production customer data, testimonials, or brand assets are available; the UI must use clearly synthetic demonstration values.

## Product Principles

- Human choice is explicit and stays in control.
- One state must tell one coherent story across graph, gauges, FDR, and tools.
- Every reference earns equal product and visual treatment.
- Causality matters more than decorative breadth.
- Simulation values are inspectable models, not production guarantees.

## Accessibility & Inclusion

The web app must support keyboard navigation, visible focus, readable contrast, reduced motion, touch-sized controls, and state communication that does not depend on color or animation alone.
