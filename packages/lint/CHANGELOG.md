# @buildtovalue/lint

## 1.2.0-next.0

### Minor Changes

- 81e4756: Handoff 19 CO-3 (§6c) — compensation lint rules; profiles → 1.4.0.

  - `COMP_HANDLER_FLOW` (error) — a compensation handler (`isForCompensation`)
    touched by sequence flow; one finding per edge naming the handler(s), covering
    both roles (handler as source OR target — the import path the core veto can't
    see).
  - `COMP_BOUNDARY_NO_HANDLER` (error) — a compensation boundary with no
    association to a handler; MECHANICAL quick-fix via the new shared
    `compensationHandlerCommands` builder (the EXACT FORM of the CO-2 «Compensation
    (pair)» palette composite — the react palette was refactored to consume it, so
    fix and palette never drift).
  - `COMP_REF_NOT_COMPENSABLE` (warning) — a compensation throw whose `activityRef`
    targets an activity with no ⟲ boundary in the throw's OWN scope, read from the
    shared `compensableActivitiesOf`.
  - `COMP_CATCH_ATTRS` (warning) — a catch carrying `activityRef`/`waitForCompletion`
    (non-OMG); warning only, since the converter already preserves them in the
    bpmnr: soup and never re-emits them on the OMG child (CO-1).
  - `EVT_SUBPROC_START` accepts a `compensate` start (the compensation event
    subprocess); `COMP_START_TOPLEVEL` flags a compensation start outside one.
  - Both profiles promoted 1.3.0 → 1.4.0 from the single version source.

- b9b625a: feat(lint): escalação nas regras vivas + perfis 1.3.0 (Handoff 18 EC-4, §5d)

  Escalação entra nas regras de lint pela MESMA fonte única (zero fork):

  - **`EVT_REF_MISSING` ganha o kind**: `NAMED_REF_KINDS` ganha `escalation`; o
    quick-fix cria `bpmn:escalation` no bucket `escalations` (molde do «+», nunca
    genérica).
  - **`EVT_ESCALATION_START_TOPLEVEL`** (erro): molde EXATO do de erro, consumindo
    o mesmo `isEventSubprocess` — concordância com a matriz E-4 testada nos dois
    lados (escalação não carrega I/O de engine, então a matriz a trata como null,
    DECLARADO; o predicado compartilhado é `isEventSubprocess`).
  - **`ESC_NO_CATCH`** (WARNING, não erro): throw de escalação sem catch elegível.
    A razão de ser warning está no código — escalação sem destino DISSOLVE (legal
    na OMG, diferente de erro, que é parada). Destino via a fonte única do core
    `eligibleEscalationCatches` (boundaries + esub-starts; ref ou catch-all).
  - **`EVT_ESCALATION_CATCH_ILLEGAL`** (reforço 8): um `intermediateCatchEvent` de
    escalação é ilegal (só boundary/esub-start capturam) — nunca silêncio sobre um
    catch que nenhum matching alcança. (Regra geral erro+escalação = follow-up em
    `pendencias.md`.)
  - **`EVT_SUBPROC_START` ganha escalation** em `SUBPROC_TRIGGER_KINDS` — fecha o
    transitório EC-2→EC-4; os testes ES-4 que rejeitavam escalation migraram para
    positivos. `EVT_START_THROW`/`EVT_END_CATCH` revisadas (escalação legal em
    end-throw e esub-start).
  - **Perfis 1.2.0 → 1.3.0** pela MESMA fonte — header do dock + `lintProfileAdapter`
    da Biblioteca refletem por construção (teste dedicado).

  core (patch): `eligibleEscalationCatches(diagram, throwRef?)` — enumeração
  headless diagram-wide (sem escopo/tiers) com retorno estruturado
  `{node, catchKind, matchType}`; a EC-5 constrói a RESOLUÇÃO (escopo+tiers) por
  cima sem re-derivar — o lint e a simulação nunca forkam a topologia de catch.

- 6d7f410: Event subprocess lint (Handoff 17 ES-4, painel 4d): novas regras
  `EVT_SUBPROC_FLOW` (fluxo de sequência tocando a casca — 1 finding por
  aresta nomeando as duas pontas) e `EVT_SUBPROC_START` (exatamente 1 start
  tipado entre os filhos DIRETOS — 0, >1 e sem-gatilho com mensagens
  distintas; kind fora da lista aceita acusa nomeando os aceitos), quick-fix
  mecânico só para 0 starts reusando o builder compartilhado
  `typedMessageStartCommands` (a MESMA forma do composto da paleta ES-2),
  aperto do `EVT_ERROR_START_TOPLEVEL` consumindo `isEventSubprocess`
  (fonte única — concordância com a matriz de executáveis), perfis
  etiquette/executability em 1.2.0. Core: o converter captura/emite
  `triggeredByEvent`/`isInterrupting` por TAG OMG (subProcess/startEvent),
  preservando os atributos mesmo quando o host mapeia a tag para um tipo
  próprio via `preferredTypes`.
- 40d6efd: #154 — lanes now tile the pool body at design time, and the lint names the gap.

  - core: lane/pool body geometry as ONE shared source (`POOL_TITLE_BAND`,
    `poolBodyOf`, `poolContainingRect`, `lanesOfPool`, `tileLaneRects`,
    `lanesTileBody`) — consumed by both the react gesture and the lint rule so
    interaction and diagnosis never drift.
  - react: creating a lane inside a pool snaps it to the pool body
    (`x = pool.x + 30`, `width = pool.width − 30`) and tiles the body equally
    with its siblings; resizing a lane keeps the requested height and re-tiles
    the siblings; resizing a pool reflows its lanes — each case inside the SAME
    gesture (one composite, one undo). Import is untouched: imported DI stays
    sovereign.
  - lint: new etiquette rule `LANE_BODY_TILING` (warning) flags a lane whose
    bounds do not partition the pool body (wrong x/width, vertical gap, overlap,
    remainder), with the mechanical quick-fix "ajustar ao corpo do pool" (one
    composite of ordinary resize commands). Etiquette profile 1.4.0 → 1.5.0.

- 031c379: Handoff 16 E-5 — EVT*\*/TIMER*\* lint, headless ISO 8601 parser and the timer
  editor (spec §3d, with the E-0 amendment). core: `parseTimerExpression`
  (date / duration / cycle — total, never throws; `P1M` is one MONTH, `PT1M`
  one MINUTE) returning a STRUCTURED result, plus the canonical
  `properties.timer = { kind, expression }` exported as the standard OMG
  `timeDate`/`timeDuration`/`timeCycle` child of the `timerEventDefinition` —
  ONLY on timer events (on any other node the property stays an ordinary
  `bpmnr:property`, never an orphan OMG child); byte-stable round-trip, absent
  field keeps prior exports byte-identical. lint: new rules in the shipped
  profiles (now 1.1.0 — a new promotable policy version): `EVT_START_THROW`,
  `EVT_END_CATCH`, `EVT_ERROR_START_TOPLEVEL` (etiquette; same containment
  predicate as the editor's Execução matrix) and `EVT_REF_MISSING` (warning,
  with a KIND-AWARE mechanical quick-fix: one composite creating a definition
  of the event's own kind and referencing it) + `TIMER_MALFORMED` (error via
  the parser; no mechanical fix — guessing intent is not mechanical). react:
  `TimerSection` — kind select, ISO 8601 expression and a HUMAN i18n preview
  built from the parser's structured result; an invalid expression shows ONLY
  the glyph+text notice (never a guessed preview) and an empty expression
  removes the property entirely.

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

## 1.1.0

### Minor Changes

- 9bee584: Handoff 14 U-5 — lint problems dock (panel 1d). `@buildtovalue/lint` gains the
  quick-fix contract `fix(ctx) → Command` (optional per rule, additive — the
  `ValidationRule` shape is untouched): mechanical fixes for `duplicate-flow`,
  `superfluous-gateway` (remove + reconnect in ONE composite) and
  `event-endpoints`, plus versioned `LintProfile`s (`lint-etiquette@1.0.0`,
  `lint-engine@1.0.0`), `lintFindings` (issues annotated with rule/profile/source
  /fixability) and `fixCommandFor`. `@buildtovalue/react` ships `LintPanel`: a
  resizable bottom dock grouped by rule with severity tokens, row click →
  select + the SAME animated pan as search (`panViewportTo` extracted to
  `canvas/viewport.ts` and now public), Esc via the dismissal stack, "corrigir"
  = one undoable command, "Corrigir todos (N)" = ONE composite, and
  "✦ sugerir correção" routing unfixable findings through the existing copilot
  C5 pipeline (only with a host-injected `AIProvider`). Etiquette AND
  engine-readiness findings share the one surface (source tag tells them apart);
  open-dock canvas badges are stripped from exports (new `TRANSIENT_ATTRIBUTES`
  in the exporter). `@buildtovalue/adapters-bpmn` adds `lintProfileAdapter` —
  lint profiles as versioned, promotable Biblioteca artifacts with the VIGENTE
  seal, reading the same `LINT_PROFILES` registry as the panel header.
- 9bee584: Market-parity editing round (referência itens 1–7): context pad with one-click
  quick-append beside the selected node; dependency-free layered auto-layout
  (`computeLayeredLayout`) with a toolbar Arrange action, align/distribute for
  multi-selections and smart drag guides; diagram find bar (Ctrl/Cmd+F) with
  match walking and scope-aware centering; native `complexGateway` support
  (registry, shape, XML round-trip); and the new `@buildtovalue/lint` package —
  bpmnlint-style etiquette and executability rule profiles with stable issue
  codes.

### Patch Changes

- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
  - @buildtovalue/core@1.1.0
