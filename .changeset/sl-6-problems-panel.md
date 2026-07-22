---
'@buildtovalue/react': minor
---

SL-6 — Problems Panel (business language) + safe quick-fix + Wave-2 Contracts tab (Handoff 22 "Squad Lane").

- **Problems Panel** in the AgentStudio inspector: every `validateGraph` issue rendered in BUSINESS language
  with the stable code beside it. Each code maps to a localized title AND a localized remediation; an
  unmapped code falls back (title → generic localized title, remediation → the EN headless string), never a
  raw code string. The headless `remediation` stays EN (host-agnostic); the UI localizes at the edge (N-6),
  closing the mixed-language i18n gap (melhorias F5). "Locate" selects the issue's node (no `scrollIntoView`).
- **Safe quick-fix** rides the modal's single undoable command/undo stack (`apply(EditResult)`) — never a
  parallel mutation path. A fix appears ONLY for codes that cannot change the I/O contract:
  `RETRY_WITHOUT_MAX` (bounds the looping route with `maxRetries`) and `LLM_NOT_STRUCTURED` (sets
  `structuredOutput`). Contract/gate/schema codes (`TOOL_EFFECT_UNGATED`, `TOOL_PARAMS_MISMATCH`,
  `DELEGATE_CONTRACT_MISMATCH`, empty-schema, …) show the code with NO fix button.
- **Wave 2 (O2) — Contracts tab** on the node inspector: the workflow I/O contract (input/output schema,
  read-only, normalized) and, for a tool node, the resolved `ToolContract` (capability/effect/authorization)
  via the injected `ToolProvider`, degrading with a declared notice when absent. Memory/Governance (O3)
  is untouched.
- The inspector now defaults to the **Intelligence** tab (the daily-work tab, prototype 02); Identity and
  Contracts are deliberate clicks.
- i18n EN+PT_BR for all new strings; AgentStudio stays on the migrated no-hardcoded-strings surface.
