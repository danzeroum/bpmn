---
'@buildtovalue/react': minor
---

SL-9 — Squad Studio (Handoff 22 "Squad Lane"), the a11y-heavy piece (§10.9). A `SquadManifest`
rendered as a STANDARD BPMN diagram over the EXISTING editor — no new canvas, no fork.

- `buildSquadDiagram(manifest)` — the DETERMINISTIC projection of the manifest (the source of truth,
  D5) into a `BpmnDiagram`: a pool with one lane per role (orchestrator + members, plus a `humano`
  lane only when an edge references it), an `agentTask` per lane carrying `agentWorkflowRef`/`personaRef`,
  and one edge per drawable squad relation with the kind as `edge.type`. A `*` broadcast fans out to
  every non-human member; edges to unknown roles are dropped rather than inventing a lane. Same manifest
  → byte-identical diagram.
- `SquadStudio` — instantiates `BpmnDesigner` with the squad plugin; all gestures/zoom/pan/selection/undo
  are the editor's, reused. Chrome mounts INSIDE the editor providers so it reads the same store: an
  Estrutura↔Colaboração toggle that flips only the new `viewMode` store key (selection/undo untouched),
  a keyboard-navigable legend, a manifest + context-contract summary panel, and a coordinated-promotion
  warning driven by an OPTIONAL host-injected `staleMembers` (absent → no warning; degradable).
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
