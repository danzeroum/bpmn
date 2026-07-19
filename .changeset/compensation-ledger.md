---
'@buildtovalue/adapters-bpmn': minor
'@buildtovalue/simulation': minor
'@buildtovalue/react': minor
---

Handoff 19 CO-5 (§6e) — compensation → ledger glue + the read-only planner that
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
