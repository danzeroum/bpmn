# @buildtovalue/agentflow

## 1.1.0-next.0

### Minor Changes

- 98b285e: SL-1 — Tool as a versioned contract (Handoff 22 "Squad Lane").

  - New `ToolContract` artifact type (capability + I/O schema + effect/authorization
    matrix, cerca §2.8) and the honest JSON-Schema subset it uses (`ToolSchema`,
    `ToolSchemaField`). Pure, headless, zero ecosystem imports (independence test).
  - `tool` nodes now bind to a versioned `tool:*@semver` ref (`usesTool`), validated
    by `validateGraph`:
    - `TOOL_REF_INVALID` (error) — `usesTool` is not a `tool:id@major.minor.patch` ref;
    - `TOOL_REF_ABBREVIATED` (warning) — an abbreviated tool version, never accepted silently;
    - `TOOL_UNRESOLVED` (warning) — the injected `ToolProvider` (`resolveTool`) cannot resolve
      the ref (declared, never silent §2.4); with no provider the check degrades to the
      structural ref check only;
    - `TOOL_PARAMS_MISMATCH` (error) — node params do not satisfy the contract `inputSchema`
      (missing required / unknown keys);
    - `TOOL_EFFECT_UNGATED` (error) — a `write-irreversible`/`external-commitment` effect whose
      contract `authorization` is not `gate`. This is the acid-safe HEADLESS half — it reads only the
      injected `ToolContract`, never the process. The process-level rules the handoff §6 lists
      (`EFFECT_NEEDS_GATE` / `GATE_NOT_COVERING`, "a gate covering the action" over `reachableGateFrom`)
      are born in `@buildtovalue/core` at SL-12 and reuse the pure predicate below.
  - New helpers `isToolRef`, `matchToolParams`, and the pure classifier `effectRequiresGate(effect)`
    (the `requiresDownstreamGate` mold, consumed by core in SL-12); `ValidateOptions` gains the injected,
    degradable `resolveTool`. Positive + negative + remediation vectors for every new code; the acid test
    binds a tool through an injected provider (no library/registry/core).
  - The Research Agent template's tool now uses `tool:browser-search@1.2.0` (was a bare name).

- 7f73b05: SL-10 (headless) — `simulateSquad` + the `AgentRunner` seam + the `CTX_PURPOSE_VIOLATION` flow rule
  (Handoff 22 "Squad Lane"). All pure, deterministic, zero ecosystem imports.

  - `AgentRunner` — how one agent workflow is executed for a squad run: `simulate` (the always-present
    deterministic mock, agentflow's own engine — never the BPMN one) and an OPTIONAL `run?` (a real backend,
    ABSENT in this frontend-only delivery). `defaultAgentRunner` supplies `simulate` and nothing else, so the
    seam is degradable and agentflow imports no backend (independence stays green).
  - `simulateSquad(manifest, options)` — traverses the squad's `delegar` edges from the orchestrator in
    manifest order, running each member through the injected runner's `simulate`. Deterministic (order from
    the manifest, outputs from declared fixtures — same squad + fixtures 10× → byte-identical facts). Honest
    CROSS-agent stops: a member that blocks (or a member whose workflow/ref does not resolve) names the agent,
    the node, and the reason — never a silent skip.
  - The FACT TRAIL (D1): an ordered `intencao → acao → io → decisao → evidencia` (+ `parada`) record, each
    labeled `fixture` vs `evidencia-declarada` (E6 — the host declares which member fixtures are captured real
    evidence), with sensitive I/O MASKED (`sensitivity`/`forbidden` keys go through the injected `maskingPolicy`,
    or are conservatively redacted to `MASKED_VALUE` when none is injected — never leaks PII), and a per-step
    masked shared-context snapshot for the step mode (D8). Facts are flat, so a UI filters by agent / kind / error.
  - `validateSquadFlow(manifest, contract, { resolveWorkflow, resolveTool })` — the FLOW half of
    `CTX_PURPOSE_VIOLATION` (E5), which only exists once the squad graph + members' resolved tool effects are
    known: a `grounding` key read by a role whose workflow reaches a gate-requiring tool effect
    (`external-commitment`/`write-irreversible`) with NO gate in the squad is flagged. A squad WITH gates defers
    the precise per-path coverage to SL-12's `GATE_NOT_COVERING` (documented, not silently skipped). Fully
    degradable (both resolvers required) and reuses SL-1's `effectRequiresGate` predicate.
  - Positive + negative + remediation + determinism (10×) + degradability vectors. apiSurface updated;
    independence / acidez / structuralShape untouched.

- 5de2c92: SL-3 — extended LlmConfig + governed budget + honest BUDGET_EXCEEDED stop (Handoff 22 "Squad Lane").

  - `LlmConfig` gains additive optional fields `provider` ("host-injetado" label, never a key/endpoint),
    `fallbackModel`, `temperature`, `maxOutputTokens` (feeds the budget projection).
  - `AgentWorkflow.budget?: AgentBudget { maxTokens, maxCostBRL, maxWallTimeMs, maxSteps }` — additive.
  - `validateGraph` adds `BUDGET_MISSING` (warning) when autonomy ≥ 2 declares no budget (never blocks;
    the run still simulates, just without a governed ceiling).
  - `simulate` stops honestly with a `BlockedDecision { cell: 'budget' }` — alongside the existing
    micro-step safety cap — the moment a projected dimension overflows, naming node + reason + count
    (e.g. "projected steps 2 exceed budget maxSteps 1"). Deterministic: no clock, no random, same fixtures
    10× → byte-identical trail.
  - Honest projection boundary (anti "invented pricing", §2.7): **steps** (real count) and **tokens**
    (from each llm call's declared `maxOutputTokens`) are projected/enforced ALWAYS; **cost** and
    **wall-time** need a rate the frontend does not honestly have, so they are enforced ONLY when the host
    injects `SimulateOptions.costModel`. `DEFAULT_COST_MODEL` stays exported as an OPT-IN convenience the
    host may pass explicitly — it is no longer a silent default, so no fictional "R$ x.xx" is ever shown.
  - The Research (autonomy 2, llm `maxOutputTokens` 4096) and Document Review (autonomy 3) templates now
    declare a budget.
  - Positive + negative + remediation vectors for `BUDGET_MISSING`; honest-stop + determinism vectors for
    `BUDGET_EXCEEDED`. `structuralShape` parity untouched (the stop rides the existing `BlockedDecision`).

- 9a715ec: SL-4 — honest SchemaNode + cross-workflow delegate contracts (Handoff 22 "Squad Lane").

  - `SchemaShape` becomes `Record<string, string | SchemaNode>` — a purely ADDITIVE union (MINOR): every
    existing plain type-token schema stays byte-stable, and the new `SchemaNode` (honest JSON-Schema subset:
    `type`/`required`/`enum`/`items`/`properties`) is lifted from strings by `normalizeSchema` /
    `normalizeSchemaField` so readers see one shape. New pure helpers: `isSchemaNode`, `requiredKeys`,
    `unsupportedKeywords`, `SUPPORTED_SCHEMA_KEYWORDS`.
  - `SCHEMA_UNSUPPORTED_KEYWORD` (warning) — any keyword outside the honest subset is declared, never
    silently honored.
  - `ValidateOptions.resolveDelegate` widened ADDITIVELY to return `AgentWorkflow | boolean | undefined`
    (a boolean resolver still works). When it returns the delegate's workflow, the cross-workflow checks run:
    - `DELEGATE_CONTRACT_MISMATCH` (error) — the delegator `outputSchema` does not cover the delegate's
      required `inputSchema` keys;
    - `DELEGATE_CYCLE` (error) — the delegate chain returns to its start (A → … → A), naming the path;
    - `AUTONOMY_CHAIN` (error) — the declared autonomy is below the chain's maximum (max of the delegates).
      A boolean/absent resolver degrades honestly — none of these run, and `DELEGATE_UNRESOLVED` still covers
      absence.
  - Positive + negative + remediation vectors for every new code; the `structuralShape` parity and corpus
    round-trip are untouched (SchemaShape is not a parity-pinned shape).

- b9d565e: SL-5 — tab-registered inspector sections + Wave-1 agent tabs + headless promptCoverage (Handoff 22 "Squad Lane").

  - **agentflow (headless):** `promptCoverage(inputVars, promptText)` — a pure, deterministic check emitting
    `PROMPT_VAR_UNUSED` (warning) for each declared input variable the prompt never references as `{{name}}`.
    It is a SEPARATE entry point (not wired into `validateGraph`, which has only the `promptRef`): the host
    feeds resolved prompt text; with none it simply is not called. `promptVariables` exposes the bare-`{{name}}`
    extractor, deliberately distinct from the simulate engine's `{{node.output.path}}` tool-param form. Zero
    ecosystem imports (independence preserved).
  - **react — reusable infra:** `InspectorSection` gains an optional `tab?: { id, label }` (additive, MINOR).
    `PropertiesPanel` generalizes its hardcoded General/Execution pair into a tab registry: a section that
    declares a `tab` renders as its own registered tab; sections without `tab` stay inline in General exactly
    as before. General/Execution and every existing node-type render byte-identically (regression tests green);
    no engine + no tab section → no tab strip, unchanged.
  - **react — Wave 1 (O1):** the AgentStudio node inspector is organized into **Identity** + **Intelligence**
    tabs. Intelligence shows the model-facing config (model, promptRef, provider shown as a host-injected label
    — never a key field, structuredOutput) and, for a tool node, the resolved contract effect via the injected
    `ToolProvider` (degrading with a declared warning when absent — inherited from SL-2). Decorators + remove
    stay below the tabs (Waves 2/3 are not pre-empted; the errorBoundary flow is unchanged).
  - The agentTask node in the main canvas keeps its current inline inspector; giving it Wave tabs needs an
    injected agent-workflow resolver and lands at the SL-12 bridge (registered in `pendencias.md` §11).
  - i18n EN+PT_BR for all new strings; PropertiesPanel/AgentStudio stay on the migrated no-hardcoded-strings
    surface. Positive + negative + remediation vectors for `PROMPT_VAR_UNUSED`.

- 88b9f0f: SL-7 — EvalSet + promotion gate + prompt coverage validator (Handoff 22 "Squad Lane").

  - **agentflow (headless):** the `EvalSet` artifact (`eval:*@semver`, assertions ONLY regex/contains/schema —
    never code) + `runEvalSet(evalSet, wf)` which runs every case through the deterministic `simulate` engine
    and scores the assertion pass-rate. A new `finalOutput(state)` recovers the run's merged output from the
    `end` trail entry (SimulationState is parity-pinned, so it carries no output field) — one tested owner of
    that parsing; a blocked run yields `undefined` and fails the case honestly. Same fixtures 10× → identical
    report.
  - **adapters-bpmn:** `evalSetAdapter(evalSets)` surfaces EvalSets in the Biblioteca (type `AVALIAÇÃO`, TOOL
    mold) and `evalPromotionGate(wf, evalSet)` blocks promotion to active below `promotionThreshold` — a
    `RuleVerdict` in the SAME shape as `agentPromotionGate` (reusing the evaluateGates/PromotionRule path, not
    a new mechanism), with `EVAL_BELOW_THRESHOLD` as the stable token in the reason. An eval with no assertions
    never blocks (honest degradation).
  - **react:** the `PromptProvider` interface (`resolve`/`save`, mirroring `ToolProvider`) + `createPromptProvider`,
    injected as an optional `AgentStudio` prop. The Intelligence tab gains the prototype-05 **coverage validator**
    (transparent textarea over a highlight backdrop of `{{var}}` spans + a coverage bar) — the prompt TEXT is
    resolved through the provider (the body lives in the Library btv:prompt artifact, NEVER on the AgentWorkflow),
    edits persist via `save`, and it degrades honestly (no provider → absent; unresolvable ref → declared warning;
    no `save` → read-only). Reduced-motion respected on the coverage bar.
  - Positive + negative + determinism vectors for `runEvalSet`/`finalOutput`; the four-case promotion-gate
    pattern for `evalPromotionGate`; adapter list/get/reject; coverage-validator render + degradation + "edits
    hit the artifact, not the workflow". i18n EN+PT_BR; independence/structuralShape/corpus untouched.

- fdc42b9: SL-8 — SquadManifest + ContextContract + readinessState (Handoff 22 "Squad Lane"), headless-pure.

  - `SquadManifest` (`sqd-*@semver`): members (`agentRef` + `personaRef` + role), `dynamic`
    (hierarquico/sequencial/paralelo/blackboard), the six edge kinds, `contextContractRef`, gates.
  - `ContextContract` (`ctx-contract:*@semver`) is its OWN reusable artifact referenced BY the manifest
    (never inlined — E5), so two squads share one contract by ref. Keys carry
    owner/readers/writers/purpose/merge/ttl/sensitivity/immutableAfterGate/forbidden.
  - `validateContextContract` — `CTX_WRITE_FORBIDDEN` (a forbidden key still granting access) and
    `CTX_PURPOSE_VIOLATION` (immutableAfterGate on a non-operational key, or grounding that merges by
    exigir-decisao). `validateSquad` — structural validity (dynamic, the six edge kinds, versioned refs)
    plus `SQUAD_MEMBER_STALE` (warning) via an INJECTED, degradable `resolveMemberStatus` (candidata/
    obsoleta is a registry concept — no resolver → no warning, and agentflow never imports the registry).
  - `squadAutonomy(manifest, resolveMember)` — the squad's composite autonomy is the MAX over resolved
    members (the SL-4 "max of the chain" rule reused, not a new one).
  - `readinessState(wf, ctx)` (E1) — the single PURE source of `rascunho` → `validado` →
    `simulado-com-evidencia` → `apto-para-integracao`. Ceiling is `apto-para-integracao`; the host states
    `executando`/`erro-de-integracao` are NEVER derived here. Tested without DOM.
  - Positive + negative + remediation vectors for CTX\_\*/SQUAD_MEMBER_STALE and the readiness ladder.
    independence/acidez/structuralShape/corpus untouched.

- febc376: SL-9 — Squad Studio (Handoff 22 "Squad Lane"), the a11y-heavy piece (§10.9). A `SquadManifest`
  rendered as a STANDARD BPMN diagram over the EXISTING editor — no new canvas, no fork.

  - `buildSquadDiagram(manifest)` — the DETERMINISTIC projection of the manifest (the source of truth,
    D5) into a `BpmnDiagram`: a pool with one lane per role (orchestrator + members, plus a `humano`
    lane only when an edge references it), an `agentTask` per lane carrying `agentWorkflowRef`/`personaRef`,
    and one edge per drawable squad relation with the kind as `edge.type`. A `*` broadcast fans out to
    every non-human member; edges to unknown roles are dropped rather than inventing a lane. Same manifest
    → byte-identical diagram.
  - `SquadStudio` — instantiates `BpmnDesigner` with the squad plugin; zoom/pan/keyboard-navigation/inspection
    are the editor's, reused. The diagram is READ-ONLY on purpose: a projection with no write-back must not
    accept mutation gestures (drag/connect/delete), or an edit would vanish on the next projection — silent
    loss, which the doctrine forbids. Read-only keeps every inspection affordance alive (perspective toggle,
    legend, roving keyboard focus over nodes/edges that drives the announce, governance tab). Squad editing
    happens via the manifest UI; the full manifest↔diagram round-trip (edits mapped back to manifest commands)
    is a registered pendência, not SL-9. Chrome mounts INSIDE the editor providers so it reads the same store:
    an Estrutura↔Colaboração toggle that flips only the new `viewMode` store key, a keyboard-navigable legend,
    a manifest + context-contract summary panel, and a coordinated-promotion warning driven by an OPTIONAL
    host-injected `staleMembers` (absent → no warning; degradable).
  - `validateSquad` (agentflow) gains `SQUAD_EDGE_ROLE_UNKNOWN` (error): an edge whose `from`/`to` is not a
    known role (`orch`, a declared member role, `humano`, or `*` as a broadcast source). This is the SAME
    known-role set the projection treats as drawable, so an edge the diagram silently omits is exactly an edge
    this check flags — the omission is never mute (the user sees it in the Problems Panel). Positive + negative
    - remediation vectors added.
  - `createSquadPlugin` / `SQUAD_EDGE_STYLES` / `SQUAD_EDGE_GLYPH` — the six collaboration edges are
    distinguishable WITHOUT color (distinct marker + dash + glyph + localized label). `EdgeStyle` gains an
    additive `collaboration` override that only thickens the stroke in the Colaboração view (DMN/escalation
    edges unaffected). The plugin also registers the Wave-3 (O3) Memória/Governança inspector tab for a
    squad member (role, persona, autonomy, downstream-gate need, and the member's context keys).
  - New canvas-store `viewMode` (`estrutura`/`colaboracao`, default `estrutura`) — a pure renderer switch,
    read by `EdgeRenderer` to apply the collaboration override. Focusing a squad edge announces
    kind + from → to in an `aria-live` region.
  - Tests: the projection (determinism, lanes, broadcast fan-out, unknown-role drop, humano lane) and the
    Studio (canvas render, toggle preserves selection, six-edge legend, edge announce, stale-member warning,
    and a zero-serious/critical axe gate). i18n EN + PT-BR; both new surfaces added to the hardcoded-string
    cerca.
