# Resilience Forge

Resilience Forge is a shared human-and-browser-agent operations bench for testing architecture references under pressure. A human loads and constrains the reference. An external browser agent stresses the live state, proposes a legal remediation, and has to recover from stale writes when the human changes the bench first.

The build follows the project documents in the repository root:

- three equal architecture references: event-driven checkout, multi-region SaaS, and LLM inference serving;
- one catalogue route and one bench route with a shared in-memory state;
- deterministic simulation, visible failure modes, operator pins, and a forensic decision record (FDR);
- structured WebMCP tools that read and mutate the same state as the visible controls.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/` and load a reference onto the bench. To exercise the intended judge path:

1. Load any of the three references.
2. Run the scenario stress test and inspect the failing node, metrics, and FDR.
3. Change an ordinary control while the stress is active.
4. Ask an external browser agent to read state, attempt a remediation, and recover from the expected `STALE_STATE` response.
5. Add a constraint pin, repeat the test, and verify the legal remediation set changes.

The scenario model is intentionally deterministic and uses public list-price estimates. It is a competition demonstration, not production capacity planning. No live provider pricing or infrastructure APIs are required.

## Build

```bash
npm run lint
npm run build
```

The experience was designed for the [WebMCP Challenge](https://openai.com/webmcp-challenge/) with the practical design guidance from [Impeccable](https://github.com/pbakaus/impeccable).

## License

MIT. See [LICENSE](./LICENSE).
