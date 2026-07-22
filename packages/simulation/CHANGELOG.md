# @buildtovalue/simulation

## 1.1.0-next.0

### Minor Changes

- 2d65a69: Handoff 19 CO-5 (§6e) — compensation → ledger glue + the read-only planner that
  completes the OMG trigger family (message/signal/error/escalation/compensation).

  - `@buildtovalue/adapters-bpmn` gains `compensationTriggeredEntry` +
    `COMPENSATION_TRIGGERED_TYPE`: a PURE builder (the engine stays intact) the
    host appends when compensation ACTUALLY runs. The entry ties the EXECUTED plan
    (`compensated` in reverse order + `uncompensated` declared); `details.author`
    prefixed `ia.copilot@` paints the ✦ AI seal (the `aiAuthorOf` rule). A blocked
    specific target appends NOTHING (reforço 8).
  - `@buildtovalue/simulation` exposes `compensationPlan(activityRef?)` — a
    READ-ONLY computation (reforço 7: it reads the trail/diagram, never mutates)
    that is the SINGLE source both `compensate()` (record + run) and the host's
    ledger glue (append the EXECUTED reversal) consume, so the two never
    re-derive. New exported types `CompensationPlan` / `CompensationStep`.
  - `@buildtovalue/react` `BpmnSimulator` gains the `onCompensationTriggered`
    prop (path a — the engine stays pure): the demo/host reads the plan BEFORE
    firing and appends the ledger entry only when something reversed.

- 3d7be05: Handoff 19 CO-4 (§6d) — compensation in the token simulator (`compensate`).

  - `compensate(activityRef)` runs only that activity's handler; `compensate()`
    (broadcast) runs every completed compensable activity's handler in REVERSE
    order and fires the scope's compensation event subprocesses. Which activities
    are compensable comes from the shared core source (`compensableActivitiesOf`);
    the handler is resolved from the boundary's association.
  - Completion is derived from the trail (`'move'`/`'end'`), never a second record
    type; the loop rule is declared (last completion wins). A completed activity
    with no handler is a declared trail line; a specific non-compensable/incomplete
    target is a declared stop; `waitForCompletion` is declared in the trail.
  - Compensation has no ref-matching, so the ES-5 tier precedence does not apply —
    broadcast fires boundary handlers and esub-starts together; a specific target
    never fires an esub-start (reforço 9).
  - New `Decision` variant `compensate` (anchored to `atStep`), serializable and
    replayed bit-for-bit; existing E-6/ES-5/EC-5 scenarios replay unchanged.
  - The react `SimulationPanel` gains the «Compensate» card — broadcast (default)
    shows the reversal COUNT (reforço 10), each compensable activity is fireable
    when completed else listed not-eligible with a reason.

- b204522: Handoff 18 §5e — escalation throws in the token simulator (`throwEscalation`),
  completing the OMG trigger family. The candidate topology is enumerated by the
  SAME shared core source as the lint (`eligibleEscalationCatches`, no fork); the
  simulator builds the scoped, tiered resolution on top — the identical total
  order and ambiguity rule as `throwError` (`especificidade > escopo > catch-all`;

  > 1 in the winning tier is a `BlockedDecision`).

  Two things differ, both declared: the personality is NON-INTERRUPTING (a
  non-interrupting catch leaves the host token in place and re-emerges a parallel
  token at the catch — the host continues), and NO eligible catch = the escalation
  DISSOLVES (a declared no-op in the trail, the host token continues), the binding
  contrast with an uncaught error's stop.

  New public types `EscalationDestination` / `EscalationThrowOption` and the
  `escalationThrowOptions` state; the react `SimulationPanel` gains the «Escalate»
  card, which predicts each option's destination + mode as glyph + text before the
  throw (informed decision). `BpmnSimulator` gains an `onEscalationThrown` callback
  (the engine stays pure) so the host maps a fired escalation to a ledger entry
  (`escalationRaisedEntry` — the escalation actually happened).

- fcaaa8f: Simulação do event subprocess (Handoff 17 ES-5, painel 4e): candidatos de
  `throwError`/`throwSignal`/`throwMessage` passam a incluir os starts tipados
  dos event subprocesses do escopo do token (elegibilidade via os helpers
  fonte-única `isEventSubprocess`/`startIsInterrupting`); precedência do erro em
  ordem TOTAL declarada (esub-exato > boundary-exato > esub-catch-all >
  boundary-catch-all; >1 no tier vencedor = `BlockedDecision` nomeando
  candidatos); token no CONTÊINER com descida declarada não-simulada;
  interrupção nomeada na trilha (contagem de tokens cancelados + escopo, uma
  vez por throw — os tokens recém-colocados pelo mesmo throw sobrevivem);
  timer/conditional NUNCA auto-dispara — card manual novo
  (`eventSubprocessOptions`/`fireEventSubprocess`, decisão `eventSubprocess`
  ancorada em `atStep` para replay bit a bit); compat E-6: cenários sem event
  subprocess replayam com trilha byte-idêntica. React: card manual no
  `SimulationPanel` com o modo declarado (glifo+texto) e i18n EN/PT-BR;
  limitations.md atualizado no mesmo PR.
- c8223c9: Handoff 16 E-6 — honest event matching in the simulator (spec §3e, S-FEEL
  discipline: exact where possible, a DECLARED stop everywhere else, never a
  guessed route). simulation: `throwError(host, errorRef?)` — the user throws
  the ERROR (named definition or uncatalogued), the ENGINE resolves the boundary
  by matching: a specific `errorRef` match beats the DECLARED catch-all
  (documented precedence — both present is NOT ambiguity); two eligible
  specifics, two catch-alls, or an uncaught error are `BlockedDecision` stops
  naming node, reason and candidates. `throwSignal` broadcasts to every waiting
  matching catch; `throwMessage` delivers to a single destination — more than
  one waiting candidate is a declared stop (runtime correlation is not
  simulable; documented in limitations.md). All three are new serializable
  `Decision` kinds that replay through the SAME matching; `fireBoundary` and
  old scenarios stay intact, and error boundaries leave the manual
  `boundaryOptions` list for the new `errorThrowOptions` cards. react: the
  SimulationPanel renders the inverted "Throw error" card (per-definition
  buttons + the "uncatalogued error" path that exercises the catch-all).

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
