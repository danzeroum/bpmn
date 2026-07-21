---
'@buildtovalue/agentflow': minor
---

SL-4 — honest SchemaNode + cross-workflow delegate contracts (Handoff 22 "Squad Lane").

- `SchemaShape` becomes `Record<string, string | SchemaNode>` — a purely ADDITIVE union (MINOR): every
  existing plain type-token schema stays byte-stable, and the new `SchemaNode` (honest JSON-Schema subset:
  `type`/`required`/`enum`/`items`/`properties`) is lifted from strings by `normalizeSchema` /
  `normalizeSchemaField` so readers see one shape. New pure helpers: `isSchemaNode`, `requiredKeys`,
  `unsupportedKeywords`, `SUPPORTED_SCHEMA_KEYWORDS`.
- `SCHEMA_UNSUPPORTED_KEYWORD` (warning) — any keyword outside the honest subset is declared, never
  silently honored.
- `ValidateOptions.resolveDelegate` widened ADDITIVELY to return `AgentWorkflow | boolean | undefined`
  (a boolean resolver still works). When it returns the delegate's workflow, the cross-workflow checks run:
  - `DELEGATE_CONTRACT_MISMATCH` (error) — the delegator `outputSchema` does not cover the delegate's
    required `inputSchema` keys;
  - `DELEGATE_CYCLE` (error) — the delegate chain returns to its start (A → … → A), naming the path;
  - `AUTONOMY_CHAIN` (error) — the declared autonomy is below the chain's maximum (max of the delegates).
  A boolean/absent resolver degrades honestly — none of these run, and `DELEGATE_UNRESOLVED` still covers
  absence.
- Positive + negative + remediation vectors for every new code; the `structuralShape` parity and corpus
  round-trip are untouched (SchemaShape is not a parity-pinned shape).
