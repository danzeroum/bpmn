# @buildtovalue/copilot

## 1.1.0-next.0

### Minor Changes

- dc29b38: SL-12 — BPMN bridge (Handoff 22 "Squad Lane"), core half: process-level gate coverage.

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

  - BPMN bridge deep-link (react, §8-08, closes pendências §1.2): `?load=<versionId>` opens the EXACT
    artifact version instead of the demo diagram. `readLoadVersionId` + `resolveDeepLink` parse the param and
    call an injected `VersionResolver` (degradable — an absent/unresolved version falls back to the default,
    never guesses); `buildLoadSearch` builds the URL the host pushes to history. The host owns URL/history
    (never `window`/`history` here). `BpmnDesigner` gains `initialCanvasState` so "voltar" restores the saved
    viewport/selection.
  - `MAPPING_TRANSFORM_ILLEGAL` (react): `PayloadMapping` gains optional additive `transform`/`adapterRef`;
    `payloadMappingIssues(rows, catalog)` flags a mapping that names a transform OUTSIDE the injected catalog,
    or a catalog conversion with no `adapterRef` (a plain source→target copy is always legal). Degradable
    (host-owned catalog, the `resolveTool` mold).
  - Squad Studio Wave-3 wiring: the Memória/Governança inspector tab registered in SL-9 was not actually
    reachable (SquadStudio uses `BpmnDesigner`, which renders no inspector, and read-only blocks canvas
    selection). Fixed: SquadStudio now renders the `PropertiesPanel`, and a member list drives selection for
    inspection (read-only-safe — it only sets `selectedIds`, never mutates). Render vectors added (governance
    tab shows role/persona/context keys; degrades without a contract).

### Patch Changes

- Updated dependencies [0627ee6]
- Updated dependencies [a99b6f9]
- Updated dependencies [cbe56a7]
- Updated dependencies [b9b625a]
- Updated dependencies [e04c719]
- Updated dependencies [2dc3518]
- Updated dependencies [6d7f410]
- Updated dependencies [56fe142]
- Updated dependencies [40d6efd]
- Updated dependencies [8825d62]
- Updated dependencies [24c4684]
- Updated dependencies [47d0de8]
- Updated dependencies [dc29b38]
- Updated dependencies [031c379]
  - @buildtovalue/core@1.2.0-next.0
  - @buildtovalue/soundness@1.0.2-next.0

## 1.0.1

### Patch Changes

- 943006f: Backend hardening round (melhorias Bloco A): `canonicalJsonExact` + versioned
  audit-ledger hash recipe (v2 — exact JSON of the whole entry; legacy v1 chains
  keep verifying), O(n²) XML parsing fix, flow classification hoisted to core
  (`isFlowNode`/`isFlowEdge`/`flowScopeOf`), structural validation in
  `JsonSerializer.deserialize`, multi-process import warning, TAB/CR attribute
  escaping, per-lane publication index in `VersionRegistry`, stricter CLI flag
  parsing, and error-taxonomy alignment (`SimulationError`/`AdapterError`/DMN/
  CLI errors now extend `BpmnError`).
- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
  - @buildtovalue/core@1.1.0
  - @buildtovalue/soundness@1.0.1
