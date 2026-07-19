---
'@buildtovalue/core': minor
'@buildtovalue/react': minor
---

Handoff 19 CO-2 (§6b) — compensation visual, palette pair and target picker.

- core: `compensableActivitiesOf(diagram, scope?)` — the scope-aware single
  source of "which activities here can be compensated" (carry a ⟲ boundary),
  consumed by the throw picker, the lint (CO-3) and the simulator (CO-4).
- react visual: the rewind ◀◀ glyph joins the single-source `eventGlyph` (throw
  filled / catch hollow); the compensation boundary is always SOLID and its
  interrupting toggle is absent (it fires post-completion); a `bpmn:association`
  now renders as a dashed line with NO flow arrow (a new global `association`
  edge style — BPMN-correct for every association, including text annotations); a
  ◀◀ marker on `isForCompensation` handlers, coexisting with loop/MI markers.
- react UX: the «Compensation (pair)» palette composite drops the boundary +
  handler (below the host) + linking association in ONE undo, lint-clean, with a
  stable-DI association so the fresh diagram re-exports byte-stably; the throw's
  transient «⟲ compensa: {activity|scope}» chip; and a target picker listing the
  compensable activities of the throw's OWN scope (broadcast is the default).
- i18n EN/PT-BR; touch ≥44px; a `?comp=1` editor demo + e2e.
