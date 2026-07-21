---
'@buildtovalue/agentflow': minor
'@buildtovalue/react': minor
---

SL-5 — tab-registered inspector sections + Wave-1 agent tabs + headless promptCoverage (Handoff 22 "Squad Lane").

- **agentflow (headless):** `promptCoverage(inputVars, promptText)` — a pure, deterministic check emitting
  `PROMPT_VAR_UNUSED` (warning) for each declared input variable the prompt never references as `{{name}}`.
  It is a SEPARATE entry point (not wired into `validateGraph`, which has only the `promptRef`): the host
  feeds resolved prompt text; with none it simply is not called. `promptVariables` exposes the bare-`{{name}}`
  extractor, deliberately distinct from the simulate engine's `{{node.output.path}}` tool-param form. Zero
  ecosystem imports (independence preserved).
- **react — reusable infra:** `InspectorSection` gains an optional `tab?: { id, label }` (additive, MINOR).
  `PropertiesPanel` generalizes its hardcoded General/Execution pair into a tab registry: a section that
  declares a `tab` renders as its own registered tab; sections without `tab` stay inline in General exactly
  as before. General/Execution and every existing node-type render byte-identically (regression tests green);
  no engine + no tab section → no tab strip, unchanged.
- **react — Wave 1 (O1):** the AgentStudio node inspector is organized into **Identity** + **Intelligence**
  tabs. Intelligence shows the model-facing config (model, promptRef, provider shown as a host-injected label
  — never a key field, structuredOutput) and, for a tool node, the resolved contract effect via the injected
  `ToolProvider` (degrading with a declared warning when absent — inherited from SL-2). Decorators + remove
  stay below the tabs (Waves 2/3 are not pre-empted; the errorBoundary flow is unchanged).
- The agentTask node in the main canvas keeps its current inline inspector; giving it Wave tabs needs an
  injected agent-workflow resolver and lands at the SL-12 bridge (registered in `pendencias.md` §11).
- i18n EN+PT_BR for all new strings; PropertiesPanel/AgentStudio stay on the migrated no-hardcoded-strings
  surface. Positive + negative + remediation vectors for `PROMPT_VAR_UNUSED`.
