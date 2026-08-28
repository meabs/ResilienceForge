---
name: Resilience Forge
description: A human-and-browser-agent operations bench for architecture under pressure.
colors:
  graphite: "#101419"
  graphite-2: "#151b21"
  steel: "#1d252d"
  steel-2: "#27313b"
  line: "#3b4752"
  line-soft: "#2a343e"
  paper: "#e7ecef"
  muted: "#93a1ac"
  quiet: "#8d9ba6"
  safety-orange: "#ff8a28"
  acid-yellow: "#d9ef46"
  signal-cyan: "#73c9d2"
  webmcp-violet: "#a898d9"
  healthy-green: "#77d29a"
  failed-red: "#f0676d"
  fdr-amber: "#f3bc4b"
typography:
  display:
    fontFamily: "IBM Plex Sans, Arial Narrow, sans-serif"
    fontSize: "clamp(48px, 7vw, 94px)"
    fontWeight: 600
    lineHeight: 0.94
    letterSpacing: "-.065em"
  headline:
    fontFamily: "IBM Plex Sans, Arial Narrow, sans-serif"
    fontSize: "clamp(30px, 3.2vw, 51px)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-.06em"
  body:
    fontFamily: "IBM Plex Sans, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Mono, Courier New, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: ".1em"
rounded:
  node: "7px"
  status-pip: "50%"
spacing:
  control: "8px"
  section: "17px"
  panel: "20px"
  layout: "32px"
components:
  primary-action:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "0"
    padding: "0 15px"
    height: "46px"
  status-node:
    backgroundColor: "#202a33"
    textColor: "{colors.paper}"
    rounded: "{rounded.node}"
    padding: "10px 11px 9px"
---

# Design System: Resilience Forge

## Overview

**Creative North Star: “The Architecture Racing League.”**

Resilience Forge treats architecture as a live test course. The catalogue is the grid; the bench is the track; telemetry, constraints, and failure marks tell the story while the operator remains in control. The palette is deliberately industrial: matte graphite and steel carry the surface, while orange intervention flags, acid-yellow commitments, cyan human controls, violet WebMCP activity, and forensic amber make state readable at a glance.

The build combines racing-league telemetry with the discipline of a cutting bench: each state change leaves an observable mark, the topology stays central, and the forensic decision record is part of the interface rather than a hidden log. There is no assistant persona, conversation surface, or decorative dashboard wall.

The architecture language is consistently Google Cloud. Every scenario is a GCP reference rather than a cloud-neutral sketch: Pub/Sub ordering keys anchor the checkout flow, Cloud Run and a global external Application Load Balancer define the regional pair, and Vertex AI endpoints define model rollout. Cloud SQL and Memorystore make the stateful edges explicit.

**Key Characteristics:**

- live topology canvas with state encoded by geometry, stroke, density, and color;
- equal-weight reference architectures on the first view;
- compact mono telemetry paired with a confident sans display face;
- flat, bordered steel panels with depth reserved for active surfaces;
- human controls and structured site tools share one visible state.

## Colors

Use graphite and steel as the field. Accents are scarce and semantic: orange means intervention, acid means a pinned commitment or positive direction, cyan means the human operating layer, violet means WebMCP, amber means the FDR, green means healthy, and red means failed.

### Primary

- **Safety Orange** (`#ff8a28`): primary action, intervention state, architecture index, and the leading edge of reference cards.
- **Acid Yellow** (`#d9ef46`): commitments, selected constraints, key headings, and success-oriented emphasis.

### Secondary

- **Signal Cyan** (`#73c9d2`): human controls, live-control markers, and neutral telemetry.
- **WebMCP Violet** (`#a898d9`): external structured-tool activity and mutation highlights.

### Tertiary

- **Healthy Green** (`#77d29a`), **Failed Red** (`#f0676d`), and **FDR Amber** (`#f3bc4b`): reserved for status semantics.

### Neutral

- **Graphite** (`#101419`) and **Graphite 2** (`#151b21`): page field and deep surfaces.
- **Steel** (`#1d252d`) and **Steel 2** (`#27313b`): panels, node fills, and raised working surfaces.
- **Paper** (`#e7ecef`): primary text.
- **Muted** (`#93a1ac`) and **Quiet** (`#8d9ba6`): supporting text and labels. AA on steel and graphite.
- **Line** (`#3b4752`) and **Line Soft** (`#2a343e`): structure, dividers, and panel edges.

### Named Rules

**The State-as-Mark Rule.** Never rely on color alone. Failure and constraint states also change stroke treatment, density, pips, or geometry so the topology remains legible in reduced motion and low-saturation conditions.

**The Accent Scarcity Rule.** Let the graphite field do most of the work. Accents are reserved for actions, state, and evidence.

## Typography

**Display Font:** IBM Plex Sans (with Arial Narrow, sans-serif)

**Body Font:** IBM Plex Sans (with Arial Narrow, sans-serif)

**Label/Mono Font:** IBM Plex Mono (with Courier New, monospace)

**Character:** The sans face is technical but human; the mono face turns operational facts into instruments. Tight tracking and compact uppercase labels establish a control-room cadence without making the page feel like a terminal.

### Hierarchy

- **Display** (600, `clamp(48px, 7vw, 94px)`, `.94`): the Catalogue thesis.
- **Headline** (600, `clamp(30px, 3.2vw, 51px)`, `.98`): the active Bench reference.
- **Title** (600, 20–25px, about `1.06`): panel and reference names.
- **Body** (400, 12–16px, `1.45–1.6`): explanatory copy, capped to readable measure.
- **Label** (500–600, 8–12px, `1.2–1.4`, uppercase with tracking): telemetry, state, controls, and evidence.

## Layout

The Catalogue opens with a generous two-column thesis and a three-column reference grid. The Bench uses a 70/30 working split: a dominant topology canvas on the left and an always-visible scenario rail on the right. A sticky FDR ticker anchors the bottom of the Bench as the durable evidence layer.

The layout is dense but breathable: 16–22px gaps inside working areas, 32px outer Bench padding, and up to 48px Catalogue gutters. The Bench graph is clamped to the available first viewport instead of growing into an empty wall of canvas; on desktop the scenario rail remains sticky and independently scrollable so controls stay reachable beside the topology. At narrower widths the two-column thesis stacks, the reference grid becomes one column, and the Bench canvas precedes the scenario rail. The topology keeps its own responsive coordinate system, compact header, and smaller node cards so the graph remains legible inside the field on small screens.

## Elevation & Depth

Depth comes from tonal layering and restrained shadows, not floating card stacks. The page field is matte graphite; steel panels sit one step above it; the working canvas and selected nodes gain a measured lift. Motion is used for stream direction and state acknowledgement, with a reduced-motion mode that preserves all information.

### Shadow Vocabulary

- **Working node:** `0 12px 24px rgb(3 7 10 / 22%)` at rest; slightly stronger when selected.
- **Inspector:** `0 20px 48px rgb(0 0 0 / 37%)` to separate the transient detail layer from the graph.
- **FDR ticker:** `0 -12px 34px rgb(0 0 0 / 25%)` to keep the evidence rail legible against the canvas.

## Shapes

Panels and controls use square, engineered silhouettes. Nodes have a restrained 7px radius; buttons, cards, rails, and the FDR remain square. Borders, dashed constraints, diagonal hatching, rotated diamonds, and angled marks carry the visual vocabulary. Focus is a visible acid outline with offset so keyboard operation is never hidden.

## Components

### Buttons

- **Shape:** square, bordered, minimum 46px tall.
- **Primary:** transparent steel-field action with an orange border and mono uppercase label; hover fills orange and switches text to graphite.
- **Hover / Focus:** a small directional mark moves on hover; focus uses a 2px acid outline with 3px offset.
- **Secondary / Ghost:** back navigation and inspector controls stay quiet until hovered.

### Chips

- **Style:** status markers are compact mono labels or dashed pin stamps, not pill-shaped filters.
- **State:** active constraints use acid border/fill treatment; tool activity uses cyan or violet according to source.

### Cards / Containers

- **Corner Style:** square for structural panels and cards.
- **Background:** steel over graphite, with steel 2 for nested working surfaces.
- **Shadow Strategy:** mostly flat; depth is reserved for the graph, inspector, and sticky evidence rail.
- **Border:** 1px line or line-soft border, with accent bars used sparingly.
- **Internal Padding:** 15–20px for panels and 20px for catalogue card bodies.

### Inputs / Fields

- **Style:** native range controls are restyled as hardware sliders: slim steel track, cyan diamond thumb, graphite housing.
- **Focus:** acid outline; value remains adjacent to the control in mono.
- **Error / Disabled:** failed states are represented in the topology and metrics rather than by hiding a control.

### Navigation

The topbar is a compact instrument strip with the Resilience Forge mark, route context, shared-state version, and SITE TOOLS lamp. The Bench back link is quiet, uppercase, and geometric. The mobile topbar wraps while preserving route identity and state visibility.

### Live Topology Canvas

The signature component is a measured graph board with dashed flow edges, packets implied by moving stroke, stateful nodes, regional zones, a legend, and an inspector overlay. It is the primary working surface, not an illustration. The node graph, metrics strip, scenario rail, and FDR all read from and write to the same state.

## Do's and Don'ts

- **Do** keep all three reference architectures equal in the first-view catalogue.
- **Do** make the human control and WebMCP mutation visible as different marks in one timeline.
- **Do** encode failure with red plus pattern, density, or stroke changes.
- **Do** keep operational labels short, specific, and grounded in the current scenario.
- **Do** preserve keyboard focus, reduced-motion behavior, and readable contrast.
- **Don't** add a chat panel, assistant avatar, prompt box, or “agent owns screen” framing.
- **Don't** replace the canvas with a generic dashboard card wall.
- **Don't** use gradients as decoration, purple-blue hero gradients, or pill-shaped UI chrome.
- **Don't** introduce a second display typeface or default system-font styling.
- **Don't** hide stale-state rejection: the FDR and shared version must make it observable.
