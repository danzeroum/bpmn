# @bpmn-react/replay

Headless **conformance checking** for BPMN replay — "does reality behave the way
the model says?". Streaming XES 2.0 / CSV parsing, one-pass frequency/time
pre-aggregation, **token-replay fitness** (never alignments), deviation
detection and variant extraction.

**Imports nothing from the ecosystem — not even `@bpmn-react/core`.** It replays
over an *abstract graph injected by the caller*, so the same machinery works on
a BPMN model, a future DMN DRD, or a fake graph. **Zero dependencies.**

```ts
import { parseXes, aggregate } from '@bpmn-react/replay';

const traces = parseXes(xesText); // or parseCsv(csvText, { case, activity, timestamp })
const graph = {
  nodes: [{ id: 'brief', name: 'Coletar briefing' }, /* … */],
  edges: [{ id: 'e1', source: 'brief', target: 'gate' }, /* … */],
};

const log = aggregate(graph, traces);
log.fitness;          // { fitness, conformingCases, totalCases, … }
log.edges;            // per-edge frequency + avg time (heatmap thickness)
log.nodes;            // per-node frequency + avg sojourn (⌀ chip)
log.bottleneckNodeId; // slowest node (GARGALO)
log.deviations;       // transitions with no model edge (▲ DESVIO · N casos)
log.variants;         // top sequences by share (▶ Reproduzir)
log.unmapped;         // log activities with no matching node
```

## Design constraints (cercas §0)

- **Token-replay fitness only** — a transition move with no corresponding model
  edge is a deviation; `fitness = fit moves / total moves`. Optimal alignments
  (A\* over model×log) are process-mining literature and stay **out** (recorded
  in `pendencias.md`).
- **One pass, no DOM** — `aggregate` computes every frequency/time in a single
  O(n) sweep; a 100k-event log aggregates in well under 2s (`tests/benchmark.test.ts`).
  Rendering (Handoff 7B-2) animates only *sampled* variant traces, never one
  token per event.
- **Streaming parse** — XES scans trace-by-trace and CSV reads line-by-line into
  compact tuples; the full log is never materialized as a rich object graph.

## Matching

Events map to nodes by **normalized activity name** (`normalizeName`: trim,
lowercase, collapse whitespace) against each node's `name` (falling back to
`id`). Unmatched activities are reported in `unmapped` and every transition
touching them counts as a deviation.

## Decoupling

`replay` imports only relative paths — pinned by `tests/independence.test.ts` —
and the acid test (`tests/acidez.test.ts`) drives it with a coffee-brewing graph
to prove it knows nothing about BPMN. Integrations with `registry`/`audit`
(bindRun filtering, attaching analysis to a promotion) happen in the host by
injection, never here.
