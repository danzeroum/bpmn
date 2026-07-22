---
'@buildtovalue/core': minor
'@buildtovalue/copilot': minor
---

SL-12 — BPMN bridge (Handoff 22 "Squad Lane"), core half: process-level gate coverage.

- `gateBypassRoute(diagram, startId, isGate, isTerminal?)` — the process-path-coverage companion to
  `reachableGateFrom`, over the SAME sequence-flow graph (never a new traversal model). Returns the id of an
  ungated commit point (a terminal — default an `endEvent` — or a sink) reachable WITHOUT passing a gate;
  gate nodes are walls (a gate covers everything downstream of itself). `undefined` means every route to a
  commit passes a gate.
- `agentGateCoverageViolations` + `agentGateCoverageRule` — `GATE_NOT_COVERING` (§6): every agentTask whose
  autonomy requires a gate where a gate IS reachable (so NOT the no-gate case that `agentGateViolations`
  already reports — the two stay distinct, no double-report) but a route (fallback/retry/bypass) reaches a
  commit without passing it. The violation names the bypass route; the promotion rule blocks activation with a
  `GATE_NOT_COVERING` reason. Built over `reachableGateFrom` + `effectRequiresGate` (SL-1) — the
  process-path-coverage layer the SL-1 `TOOL_EFFECT_UNGATED` (contract-level) and the SL-11 squad grounding
  check deliberately deferred.
- Positive + negative + remediation + no-double-report + sink + cyclic + custom-terminal + promotion-block
  vectors. apiSurface updated.

- `scaffoldSquad(template, options?)` (copilot) — the whitelisted squad scaffolder (§8-08), a PROPOSAL
  GENERATOR built ENTIRELY from the primitive whitelisted commands (`addNode`/`addEdge`), so it is
  structurally incapable of expressing anything off the whitelist. It flows through the ordinary
  PROPOSTA → APLICADA pipeline (`validateProposal` → `buildPlan` → CopilotPanel): applying runs through the
  CommandStack like any edit and NEVER approves/promotes (#150). Four templates (`hierarquico` / `sequencial`
  / `paralelo` / `revisao`), each scaffolding a gate-covered squad process — a start, agentTasks with an
  `autonomyLevel`, an approval gate (a core `userTask` marked `properties.gate`, since the domain `btv:gate`
  is not core-creatable) before the end, and the sequence flows. Deterministic (ids/positions from
  template + prefix); a `prefix` option namespaces ids so two squads coexist. Vectors: whitelist-only,
  node-before-edge order, validates against a fresh diagram, gate-covered projection, determinism,
  prefix-collision. apiSurface updated.
