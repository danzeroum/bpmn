---
'@buildtovalue/agentflow': minor
'@buildtovalue/adapters-bpmn': minor
'@buildtovalue/react': minor
---

SL-7 — EvalSet + promotion gate + prompt coverage validator (Handoff 22 "Squad Lane").

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
