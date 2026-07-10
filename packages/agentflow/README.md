# @buildtovalue/agentflow

Headless model of a **governed AI-agent sub-workflow** (Handoff 12, Agent Lane).
This package is the source of truth for the *shape* of an agent's micro-behaviour —
the JSON schema, the graph validation rules, and the normative autonomy scale.
It has **zero dependencies** and imports nothing from the ecosystem (same acidity
standard as `@buildtovalue/sfeel` and `@buildtovalue/replay`); every integration
— registry resolution, ledger, library, react — arrives by **injection** and is
degradable.

## What's in A-1

- **Schema** (`types.ts`) — exactly three node types (`llm` / `tool` / `decision`)
  plus **decorators** (`memory` / `planner` / `errorBoundary`). Decorators are
  properties, never nodes.
- **Ref parser** (`ref.ts`) — the canonical reference form is the `id@semver`
  string (`agnt-rsch@2.1.0`, `prm:research@2.0.0`). Abbreviated display forms are
  normalized to full `major.minor.patch` with a warning.
- **Graph validation** (`validate.ts`) — the five §3 rules, the honest-stop
  prohibition (§1.4) and the autonomy coherence rule (§4).
- **Autonomy scale** (`autonomy.ts`) — the normative 0–5 scale, the minimum level
  the graph justifies, and the pure gate-requirement predicate.
- **Templates** (`templates.ts`) — Approval Gate Agent ★, Research Agent,
  Document Review Agent.

## What's in A-2 — mock simulation engine

`simulate(wf, { fixtures })` runs a **deterministic mock** of an agent workflow
and returns a `SimulationState`. It is agentflow's OWN engine — message passing,
data mapping and retries — and never adapts or imports the H7 BPMN token engine
(cerca §2). The only thing shared with `@buildtovalue/simulation` is the result
**shape**: `SimulationState` / `TransitionRecord` / `BlockedDecision` here are
**structurally identical** to the H7 ones, verified by a type-level test that
inlines the H7 shapes (no import), so the react layer renders an agent run with
the same trail components.

- **Deterministic** — node outputs come from per-node `fixtures` (a sequence of
  outputs per visit), never from a clock or a random source: the same run twice
  is byte-identical.
- **Data mapping** — tool `params` templates `{{node.output.path}}` resolve from
  the run context; the merged output feeds decision conditions.
- **Honest stops** — an exhausted retry, an unmatched route, or a condition
  outside the simulable subset produce a `BlockedDecision` naming the node, the
  reason and the count. The run never guesses a route (S-FEEL discipline).
- **Decorators** — `memory` shows as a trail entry; `errorBoundary` consumes
  retries with a **simulated** (logical-time) backoff, not real time; `planner`
  static means successors are visited in declared order.

The BPMN `agentTask` (A-3), the Agent Studio UI (A-4/A-5), the Library adapter
(A-6) and LangGraph interop (A-7) build on this.

## What's in A-7 — LangGraph JSON interop (≥0.2), a DOCUMENTED subset

`importLangGraph(json)` / `exportLangGraph(workflow)` map a documented **subset**
of LangGraph JSON. This is not "almost LangGraph" — the same honesty rule as
S-FEEL: what maps is listed field-by-field; everything else is declared, never
silently converted. Pure JSON, zero dependencies.

### The subset that round-trips

| AgentWorkflow | LangGraph JSON |
|---|---|
| `id` / `name` / `version` | `id` / `name` / `version` (identity) |
| `inputSchema` / `outputSchema` | `input_schema` / `output_schema` |
| `node.id` | `nodes[].id` |
| `node.type` (`llm`/`tool`/`decision`) | `nodes[].type` |
| `node.config` | `nodes[].data` |
| `edge.from`/`to`/`edgeType`/`when` | `edges[].source`/`target`/`data.{edgeType,when}` |

### Import — ignored is declared, unmappable fails loudly

- Any top-level key outside the subset — `interrupts`, `checkpointer` /
  `checkpoints`, and anything else — is **ignored and DECLARED** in
  `result.warnings` (a list of dropped fields, never silence).
- A node whose `type` is not `llm` / `tool` / `decision` **fails** the import
  with a `LangGraphImportError` naming the node — never a silent lossy
  conversion.
- `autonomyLevel` is not in the subset; it is **recomputed** from the graph
  (`minCoherentLevel`) on import.

### Export — left out is declared

The export carries only the subset; agentflow constructs with no LangGraph form
are omitted and **declared** in `result.warnings`: `autonomyLevel` (always),
node **decorators** (memory/planner/errorBoundary), and **`delegate`** edges
(a2a:1.0 semantics, not a protocol).

`package.json` `interop`: `{ "langgraph": ">=0.2", "a2a": "1.0" }`.

## AgentO / AIAO vocabulary alignment — WITHOUT a JSON-LD claim

Property names follow the AgentO / AIAO agent-ontology vocabulary so the model is
legible to that community, but we make **no semantic-web claim**: there is
deliberately **no `@context` and no `@type`** (cerca §1.6). We do not assert a URI
we cannot resolve. The alignment is documentation only:

| This package | AgentO / AIAO notion |
|---|---|
| node `type: "llm"` | `LLMCall` |
| node `type: "tool"` | `ToolCall` |
| `config.usesTool` | `usesTool` |
| node `type: "decision"` | decision / branch point |
| `edgeType: "delegate"` | agent-to-agent delegation (a2a:1.0, semantics only) |
| `decorators[].type: "memory"` | agent memory |
| `decorators[].type: "planner"` | agent planner |
| `autonomyLevel` | agent autonomy |

## Graph validation rules (§3 + §1.4 + §4)

1. `RETRY_WITHOUT_MAX` — a decision route that loops back must declare `maxRetries`.
2. `CYCLE_WITHOUT_STOP` — no cycle without a decision carrying a structured stop
   criterion and an exit.
3. `LLM_NOT_STRUCTURED` — an LLM consumed by a structured decision must set
   `structuredOutput: true` (JSON mode).
4. `DELEGATE_REF_INVALID` (error) / `DELEGATE_UNRESOLVED` (warning) — a delegate
   must reference `id@semver`; resolution is injected and degradable.
5. `EMPTY_INPUT_SCHEMA` / `EMPTY_OUTPUT_SCHEMA` / `EDGE_ENDPOINT_MISSING` /
   `DECISION_ROUTE_MISSING` — non-empty schemas and structural integrity.
- `DECISION_IMPLICIT_METRIC` — a `confidence`-style implicit stop is forbidden
  (§1.4); route on structured output instead.
- `AUTONOMY_INCOHERENT` — the declared `autonomyLevel` may not be lower than the
  level the graph justifies (§4, "o grafo é quem manda").

An `error` blocks promotion (core wires this into `evaluateGates` in A-3); a
`warning` never does.

## autonomyLevel — normative scale (§4)

| Level | Name | Downstream gate |
|---|---|---|
| 0 | Manual | required |
| 1 | Loop-free | required |
| 2 | Bounded Loop | required |
| 3 | Decision Tree | required |
| 4 | Multi-Agent | optional (warning) |
| 5 | Self-Modifying | none (permanent inspector warning) |

`gateRequirement(level)` is pure. The "level ≤ 3 without a reachable btv:gate
downstream = error" check needs the surrounding BPMN process and lives in
`@buildtovalue/core` (A-3), which consumes `gateRequirement` — this package never
imports core.
