# @buildtovalue/copilot

Headless governed-AI layer (Handoff 9): **IA rascunha, humanos assinam.**

## Data flow (cerca §1.7 — read this first)

Nothing the user types and nothing from the diagram leaves the client through
this package. The ONLY transport is the `AIProvider` the **host** injects
(`complete(req) → Promise<string>`): the host decides what travels, to where,
under which key. This repo ships no LLM SDK, no API key handling, no
telemetry.

## Governance fences (§1, binding)

- The AI **never promotes, approves or signs**: this package has no import
  path to `@buildtovalue/identity` or promotion rules — enforced by the
  guardrails test (dependency graph + anti-governance grep) in CI.
- Proposals become **whitelisted edit commands only** (`addNode`, `addEdge`,
  `updateNode`, `updateEdge`, `moveNode`, `removeNode`, `removeEdge`),
  applied as ONE undoable composite. Governance operations are structurally
  inexpressible.
- **Integral rejection** (§1.3): one unknown/malformed command rejects the
  whole proposal with readable errors — never partial silent application.
- **soundnessPreview is computed locally** over the projected result via
  `@buildtovalue/soundness`; a provider-supplied preview is dropped.
