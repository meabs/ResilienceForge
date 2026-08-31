# Resilience Forge — WebMCP Demo Script

## 0:00–0:15

**[Catalogue on screen]**

Hi, I'm Garry, and this is Resilience Forge.

It's a small architecture testing bench I've built for the WebMCP challenge.

You load a reference architecture, give it a workload, and then an external agent can inspect it, stress it and make changes through WebMCP.

## 0:15–0:32

**[Load Event-Driven Checkout]**

I'm going to use the event-driven checkout example.

We've got the application services, an ordered event queue and the database.

I'll set the workload to ten thousand requests per second and keep ordered events as a requirement.

**[Show the scenario values changing.]**

The graph, metrics and WebMCP tools all work from the same application state.

## 0:32–0:50

**[Move to ChatGPT/browser agent.]**

I'll now ask ChatGPT to test it.

**[Prompt:]**

*"Stress test this architecture at 10,000 requests per second. Keep event ordering, identify any SLO failures and fix what you can."*

**[Agent discovers/calls WebMCP tools.]**

It can read the architecture, workload, constraints and current metrics directly from the site.

## 0:50–1:15

**[Stress test starts. Ordered Pub/Sub queue turns unhealthy. Metrics deteriorate.]**

The test is running now.

You can see the ordered Pub/Sub queue is overloaded and latency and errors start climbing.

The agent hasn't been given that answer in the prompt. It's getting the current state through WebMCP and can inspect what's failing.

**[Agent diagnoses queue capacity.]**

Here it's found the queue throughput limit.

## 1:15–1:50

**[Before remediation, apply Keep Pub/Sub ordering keys pin.]**

Before it fixes anything, I'm going to add a constraint.

Ordering has to stay.

**[Show pin appearing.]**

That's now part of the application state as well, so the agent has to work within it.

It can't solve the problem by removing the requirement.

**[Agent prepares an ordered-queue remediation using `expectedVersion` from the current snapshot.]**

While it is working, I'm going to change the live workload.

**[Raise Peak RPS with the ordinary UI control before the agent's mutation completes.]**

The agent's write is rejected as `STALE_STATE` instead of overwriting my change.

It reads the decision log, sees my `ui` action, takes a fresh snapshot, and recalculates for the new version.

**[Agent applies `set_ordering_key_parallelism`, `set_batching`, and `set_autoscaling`, ideally as one atomic `apply_remediation_plan`.]**

It's increased ordered-key parallelism, added bounded batching, and scaled the service without removing the ordering constraint.

## 1:50–2:08

**[Metrics recover.]**

And we can see the effect immediately.

Throughput recovers, latency comes back down and the architecture is inside its SLO again.

The Flight Data Recorder shows my `ui` change, the rejected WebMCP `STALE_STATE` write, and the successful retry, so you can follow exactly what changed.

## 2:08–2:32

**[Show WebMCP tool activity / bench.]**

What I wanted to explore with this project was a website where the human and the agent work on the same thing.

I'm using the visual interface.

The agent is using the WebMCP tools.

When I change a constraint, it sees that change. When it changes the architecture, I see the result on the graph.

There's no separate agent version of the application to keep in sync.

## 2:32–2:48

**[Return to catalogue.]**

I've built three reference scenarios: event-driven checkout, multi-region SaaS and LLM inference.

They have different failure modes and different constraints, but they all use the same interaction model.

That's Resilience Forge.
