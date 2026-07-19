---
'@buildtovalue/simulation': minor
'@buildtovalue/react': minor
---

Handoff 19 CO-4 (§6d) — compensation in the token simulator (`compensate`).

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
