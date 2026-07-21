---
'@buildtovalue/agentflow': minor
---

SL-3 — extended LlmConfig + governed budget + honest BUDGET_EXCEEDED stop (Handoff 22 "Squad Lane").

- `LlmConfig` gains additive optional fields `provider` ("host-injetado" label, never a key/endpoint),
  `fallbackModel`, `temperature`, `maxOutputTokens` (feeds the budget projection).
- `AgentWorkflow.budget?: AgentBudget { maxTokens, maxCostBRL, maxWallTimeMs, maxSteps }` — additive.
- `validateGraph` adds `BUDGET_MISSING` (warning) when autonomy ≥ 2 declares no budget (never blocks;
  the run still simulates, just without a governed ceiling).
- `simulate` stops honestly with a `BlockedDecision { cell: 'budget' }` — alongside the existing
  micro-step safety cap — the moment a projected dimension overflows, naming node + reason + count
  (e.g. "projected steps 2 exceed budget maxSteps 1"). Deterministic: no clock, no random, same fixtures
  10× → byte-identical trail.
- Honest projection boundary (anti "invented pricing", §2.7): **steps** (real count) and **tokens**
  (from each llm call's declared `maxOutputTokens`) are projected/enforced ALWAYS; **cost** and
  **wall-time** need a rate the frontend does not honestly have, so they are enforced ONLY when the host
  injects `SimulateOptions.costModel`. `DEFAULT_COST_MODEL` stays exported as an OPT-IN convenience the
  host may pass explicitly — it is no longer a silent default, so no fictional "R$ x.xx" is ever shown.
- The Research (autonomy 2, llm `maxOutputTokens` 4096) and Document Review (autonomy 3) templates now
  declare a budget.
- Positive + negative + remediation vectors for `BUDGET_MISSING`; honest-stop + determinism vectors for
  `BUDGET_EXCEEDED`. `structuralShape` parity untouched (the stop rides the existing `BlockedDecision`).
