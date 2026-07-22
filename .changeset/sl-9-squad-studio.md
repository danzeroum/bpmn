---
'@buildtovalue/react': minor
'@buildtovalue/agentflow': minor
---

SL-9 — Squad Studio (Handoff 22 "Squad Lane"), the a11y-heavy piece (§10.9). A `SquadManifest`
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
  + remediation vectors added.
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
