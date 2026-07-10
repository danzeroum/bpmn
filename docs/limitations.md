# Known limitations & roadmap

Documented deliberately so expectations are managed — none of these fail silently.

## BPMN coverage
- The XML converter implements the [documented profile](format-spec.md), not the full OMG spec.
- **Pools & lanes** are supported as single-process swimlanes (see
  [format-spec](format-spec.md#pools--lanes)): pools ↔ `collaboration`/`participant`, lanes ↔
  `laneSet`/`lane`/`flowNodeRef`, `messageFlow` in the collaboration and `association` for
  artifacts. Lane membership is interactive (drop a node into a lane to join it, undoable).
  Multi-pool collaborations with one process per pool are not modelled
  (tracked in [`pendencias.md`](../pendencias.md)).
- Boundary events, message/timer event definitions, call activities and nested sub-process content
  are ignored with import warnings.
- The XML parser validates structure, not the official XSD.

## Rendering & performance
- Optimized for diagrams up to **~300–400 elements** (memoized nodes/edges, granular store
  subscriptions, rAF-throttled gestures). Beyond that, SVG DOM size becomes the bottleneck.
  **Roadmap (post-1.0)**: viewport virtualization and a canvas-rendering fallback.
- Edge routing is Bézier (default) or simple orthogonal; there is no obstacle-avoiding router yet.
- Text rendering uses SVG `<text>` with rudimentary word wrapping (no auto-fit).

## Collaboration
- No built-in multi-user collaboration/CRDT. The command stream (`command.post` events with
  serializable commands) is the intended integration point. **Roadmap**: reference adapter.

## Export
- PNG export requires a fully self-contained SVG: inline styles/fonts only. External webfonts or
  cross-origin images would taint the canvas and the export fails with a clear error. The default
  shapes only use attribute styling, which is safe.

## Interaction
- Touch gestures: basic pointer events work on touch devices, but pinch-zoom and long-press menus
  are not implemented.
- Labels can be edited inline on the canvas (double-click a node) or in the properties panel.
- Dragging a pool/lane moves only the container, not the nodes inside it; lanes do not auto-reflow
  siblings when resized. Both are candidates for a post-1.0 "swimlane layout" pass.

## S-FEEL evaluation (`@buildtovalue/sfeel`, Handoff 9)
- **The simulator evaluates a documented S-FEEL SUBSET, never full FEEL.** Supported (§5 of the
  handoff): comparisons (`<`, `<=`, `>`, `>=`, `=`), inclusive/exclusive/mixed ranges, value lists
  (implicit OR), `not(list of literals)`, `-` (irrelevant), number/string/boolean, hit policies
  **U** and **F**. Excluded — explicitly: function invocation (`date()`, `duration()`, …),
  arithmetic in cells, `for`/`some`/`every`, nested contexts, date/time/duration types, non-literal
  output expressions, identifier references in cells, and evaluation of the A/P/R/O/C hit policies
  (editor metadata only). A cell outside the subset yields a DECLARED `nonSimulable {cell, reason}`
  — the token stops at the `businessRuleTask` with the warning, the DMN editor marks the cell ⚠
  while editing, and nothing is ever evaluated "approximately".
- Input-column expressions are used verbatim as context keys — they are not evaluated. A Unique
  hit-policy violation (two matching rules), a missing input variable and a test/value type
  mismatch are declared the same way, never a silent false.

## Token simulation (`@buildtovalue/simulation`, Handoff 7A)
- **OR (inclusive) gateways use dominator-based structural convergence (upgraded in #65).** The
  engine executes **exact** token semantics for **XOR (exclusive), AND (parallel) and event-based**
  gateways and for boundary events (interrupting / non-interrupting). For inclusive gateways: the
  **split** is a manual multi-select (the caller picks ≥1 outgoing flow), and the **join** fires
  once no live token can still reach it *without having already passed through it* — decided by
  dominator analysis (Cooper-Harvey-Kennedy) over the flow graph and re-settled to a fixpoint after
  every step, so a branch that later diverges away from the join no longer strands it, and a
  loop-back token (whose path is dominated by the join) doesn't hold it open. The `approximate`
  flag and `hasApproximateSemantics` are **retained by design**: a fully token-state-exact OR-join
  is undecidable in the general case, so runs touching an OR gateway still carry the notice — the
  flag now signals this theoretical bound, not a heuristic shortcut.
- **Path coverage** enumerates one route per XOR/event-based/inclusive branch and per boundary
  event; inclusive splits are enumerated one branch at a time (not the power set) to keep the
  checklist linear in branches. Enumeration cuts cycles at the first repeated edge and caps at
  `MAX_PATHS` (flagged as `truncated`).
- **Sub-process token descent is not modelled in v1** — a sub-process is simulated as a single
  activity in its own scope; the engine does not step *into* it. The scope is selectable, so a
  sub-process can be simulated on its own.
- The engine reasons over the **same flow graph as the soundness analysis** (the classification is
  duplicated because `simulation` depends only on `core`, and pinned identical by
  `packages/simulation/tests/soundnessAgreement.test.ts`).

## Replay / conformance (`@buildtovalue/replay`, Handoff 7B)
- **Token-replay fitness only, never alignments (cerca §0.2).** Conformance means: a transition in
  the log with no corresponding edge in the model is a deviation; `fitness = fit moves / total
  moves`, and a case is conformant when it replays with zero deviations. Optimal alignments (A\*
  over model×log — the process-mining state-of-the-art) are intentionally **out of scope**
  (registered in [`pendencias.md`](../pendencias.md)); the fitness here is a fast, honest
  frequency-of-fit metric, not an optimal-alignment cost.
- **Events map to nodes by normalized activity name** (node `name`, falling back to `id`);
  activities with no matching node are reported (`unmapped`) and their transitions count as
  deviations. There is no fuzzy/semantic matching.
- **Node times are the incoming gap** — the average time from the previous event to this one (how
  long the activity took to complete), which is what the ⌀ chip and the bottleneck (GARGALO) read;
  there is no start/complete lifecycle pairing in v1. Edge times are the same transition gap.
- **One-pass aggregation, no DOM** (cerca §0.3): a 100k-event log aggregates in < 2s; the overlay
  animates only *sampled* variant traces, never one token per event.
- The engine imports nothing from the ecosystem (operates on an injected `{ nodes, edges }`),
  pinned by `packages/replay/tests/independence.test.ts` + the fake-graph acid test.

## Governance
- **RBAC is verification, not enforcement (Handoff 8, cerca §1.2).** `evaluateRoleRequirement`
  (`@buildtovalue/identity`) checks signatures against required roles — a statement any third party can
  re-verify — but it does **not** block actions: whoever controls the client can ignore local rules.
  Enforcement belongs to the anchor and whoever hosts it. A pentest flagging "RBAC bypass" is an
  architecture decision, not a bug.
- **Signing never touches keys (cerca §1.1).** `@buildtovalue/identity` never generates, stores or
  manages keys; the `Signer` is always injected by the host (SSO/YubiKey/git key) and the private key
  never enters the library. Enforced by `scripts/check-no-key-generation.mjs` in CI.
- **WebCrypto Ed25519 support.** Signature verification uses WebCrypto Ed25519, stable in Node ≥ 20
  and recent browsers (Chrome 137+, Safari 17+). Older host browsers must provide their own verifier;
  the library never ships its own crypto.
- The library records `UserContext` data as given; authentication/authorization is the host
  application's responsibility.
- `AuditLedger` and `VersionRegistry` keep entries in memory; durable storage happens through their
  `AuditSink` / `RegistrySink` seams.
- `VersionTimeline` (React) is presentational and decoupled — it renders a plain
  `VersionTimelineItem[]`, so the host maps its registry (or any version source) to that shape and
  the React layer never depends on `@buildtovalue/registry`.
