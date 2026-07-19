---
'@buildtovalue/lint': minor
---

Handoff 19 CO-3 (§6c) — compensation lint rules; profiles → 1.4.0.

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
