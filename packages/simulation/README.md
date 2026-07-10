# @buildtovalue/simulation

Headless BPMN **token-simulation** engine — "does the model behave the way I
expect?". Walks a diagram with animated-token semantics, entirely without a
DOM, so the React overlay (Handoff 7A-2) is a thin rendering layer over a
fully-tested core. **Consumes only `@buildtovalue/core`. Zero runtime
dependencies.**

```ts
import { SimulationEngine, CoverageTracker } from '@buildtovalue/simulation';

const engine = new SimulationEngine(diagram);
const coverage = new CoverageTracker(engine.graph); // survives engine.reset()

while (engine.canAdvance) {
  const choice = engine.pendingChoice;
  if (choice) {
    engine.choose({ kind: 'exclusive', gateway: choice.nodeId, edge: choice.options[0].edgeId });
  } else {
    engine.advance(); // one token, one hop — deterministic
  }
}
coverage.record(engine.state.traversedEdges);
```

## Semantics

Exact for **XOR (exclusive)**, **AND (parallel)** and **event-based**
gateways, and for **boundary events**:

- **XOR / event-based split** — pauses for a decision (`pendingChoice`); one
  branch is taken.
- **AND split** — emits one token per outgoing flow; **AND join** waits for a
  token on every incoming flow (`join-wait` → `join-fire`), so the classic trap
  (an XOR-split feeding an AND-join) **deadlocks exactly where the soundness
  analysis predicts it** — the two agree by construction
  (`tests/soundnessAgreement.test.ts`).
- **Boundary events** — fired while a token rests on the host: interrupting
  moves the token onto the boundary; non-interrupting spawns a second token.

**OR (inclusive) is approximate — declaredly** (cerca §0.1): the split is a
manual multi-select and the join fires once no other live token can still reach
it. `engine.hasApproximateSemantics` is `true` whenever an OR gateway
participates, and every OR-join transition is flagged `approximate`. See
[`docs/limitations.md`](../../docs/limitations.md).

## Coverage & scenarios

- **`CoverageTracker`** enumerates the structural paths of the graph — the same
  graph the soundness analysis reasons over (Handoff 7 §7.2) — and reports
  `N of M exercised`. It is held across `engine.reset()`, so restarting a
  session keeps coverage.
- A session is a **replayable scenario**: `engine.scenario` captures only the
  ordered decisions; `SimulationEngine.replay(diagram, scenario)` reproduces
  the run bit-for-bit. `canonicalizeScenario` / `hashScenario` give the stable
  artifact + `#hash` used for the ledger evidence (Handoff 7A-3).

## Decoupling

`simulation` never imports `soundness`, `replay`, `registry`, `library` or
`react` — pinned by `tests/independence.test.ts`. Integrations (versioned
scenarios in the library, session → ledger) happen through host adapters, never
a direct import.
