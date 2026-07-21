---
'@buildtovalue/agentflow': minor
---

SL-1 — Tool as a versioned contract (Handoff 22 "Squad Lane").

- New `ToolContract` artifact type (capability + I/O schema + effect/authorization
  matrix, cerca §2.8) and the honest JSON-Schema subset it uses (`ToolSchema`,
  `ToolSchemaField`). Pure, headless, zero ecosystem imports (independence test).
- `tool` nodes now bind to a versioned `tool:*@semver` ref (`usesTool`), validated
  by `validateGraph`:
  - `TOOL_REF_INVALID` (error) — `usesTool` is not a `tool:id@major.minor.patch` ref;
  - `TOOL_REF_ABBREVIATED` (warning) — an abbreviated tool version, never accepted silently;
  - `TOOL_UNRESOLVED` (warning) — the injected `ToolProvider` (`resolveTool`) cannot resolve
    the ref (declared, never silent §2.4); with no provider the check degrades to the
    structural ref check only;
  - `TOOL_PARAMS_MISMATCH` (error) — node params do not satisfy the contract `inputSchema`
    (missing required / unknown keys);
  - `TOOL_EFFECT_UNGATED` (error) — a `write-irreversible`/`external-commitment` effect whose
    contract `authorization` is not `gate`. This is the acid-safe HEADLESS half — it reads only the
    injected `ToolContract`, never the process. The process-level rules the handoff §6 lists
    (`EFFECT_NEEDS_GATE` / `GATE_NOT_COVERING`, "a gate covering the action" over `reachableGateFrom`)
    are born in `@buildtovalue/core` at SL-12 and reuse the pure predicate below.
- New helpers `isToolRef`, `matchToolParams`, and the pure classifier `effectRequiresGate(effect)`
  (the `requiresDownstreamGate` mold, consumed by core in SL-12); `ValidateOptions` gains the injected,
  degradable `resolveTool`. Positive + negative + remediation vectors for every new code; the acid test
  binds a tool through an injected provider (no library/registry/core).
- The Research Agent template's tool now uses `tool:browser-search@1.2.0` (was a bare name).
