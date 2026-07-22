---
'@buildtovalue/agentflow': minor
---

SL-8 — SquadManifest + ContextContract + readinessState (Handoff 22 "Squad Lane"), headless-pure.

- `SquadManifest` (`sqd-*@semver`): members (`agentRef` + `personaRef` + role), `dynamic`
  (hierarquico/sequencial/paralelo/blackboard), the six edge kinds, `contextContractRef`, gates.
- `ContextContract` (`ctx-contract:*@semver`) is its OWN reusable artifact referenced BY the manifest
  (never inlined — E5), so two squads share one contract by ref. Keys carry
  owner/readers/writers/purpose/merge/ttl/sensitivity/immutableAfterGate/forbidden.
- `validateContextContract` — `CTX_WRITE_FORBIDDEN` (a forbidden key still granting access) and
  `CTX_PURPOSE_VIOLATION` (immutableAfterGate on a non-operational key, or grounding that merges by
  exigir-decisao). `validateSquad` — structural validity (dynamic, the six edge kinds, versioned refs)
  plus `SQUAD_MEMBER_STALE` (warning) via an INJECTED, degradable `resolveMemberStatus` (candidata/
  obsoleta is a registry concept — no resolver → no warning, and agentflow never imports the registry).
- `squadAutonomy(manifest, resolveMember)` — the squad's composite autonomy is the MAX over resolved
  members (the SL-4 "max of the chain" rule reused, not a new one).
- `readinessState(wf, ctx)` (E1) — the single PURE source of `rascunho` → `validado` →
  `simulado-com-evidencia` → `apto-para-integracao`. Ceiling is `apto-para-integracao`; the host states
  `executando`/`erro-de-integracao` are NEVER derived here. Tested without DOM.
- Positive + negative + remediation vectors for CTX_*/SQUAD_MEMBER_STALE and the readiness ladder.
  independence/acidez/structuralShape/corpus untouched.
