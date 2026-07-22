---
'@buildtovalue/adapters-bpmn': minor
'@buildtovalue/react': minor
---

SL-2 — TOOL catalog + selector binding + the injectable `ToolProvider` (Handoff 22 "Squad Lane").

- **adapters-bpmn:** `toolAdapter(contracts)` surfaces `ToolContract` artifacts in the Biblioteca as
  "mais um adapter" (type `FERRAMENTA`), mirroring the non-diagram `copilotPromptAdapter` mold — one
  artifact per tool id, versions grouped, governance posture (effect/authorization) in `meta`,
  read-only. `resolveToolContract(contracts)` is the shared headless resolver the catalog and the
  react provider both use (one registry, never a parallel truth).
- **react:** the `ToolProvider` interface is born here (`{ resolve; list?() }`, implementing agentflow's
  `ResolveTool` — types flow down react→agentflow) plus `createToolProvider(contracts)`. It is injected
  as an optional `toolProvider` prop on `AgentStudio` (the `AIProvider`/H9 mold). The tool inspector
  binds by **selector/autocomplete** — impossible to type a loose string (cerca §2.2) — showing the
  resolved contract's effect + capability inline, and a declared `TOOL_UNRESOLVED` warning when the bound
  ref is not in the catalog. `validateGraph` now runs with `{ resolveTool: toolProvider?.resolve }`.
- **Degradability:** with no provider the binding degrades to the pre-SL-2 typed text field and the graph
  still validates (contract-aware checks simply do not run) — never a crash, never silence. Covered by a
  render test (provider undefined → plain field; provider that lists → selector + effect chip; provider
  that cannot resolve → visible warning, no validation error).
- Drag-into-node from the catalog is explicitly OUT of the MVP and registered in `pendencias.md` (§11).
