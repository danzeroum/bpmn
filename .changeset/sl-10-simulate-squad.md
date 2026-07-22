---
'@buildtovalue/agentflow': minor
---

SL-10 (headless) — `simulateSquad` + the `AgentRunner` seam + the `CTX_PURPOSE_VIOLATION` flow rule
(Handoff 22 "Squad Lane"). All pure, deterministic, zero ecosystem imports.

- `AgentRunner` — how one agent workflow is executed for a squad run: `simulate` (the always-present
  deterministic mock, agentflow's own engine — never the BPMN one) and an OPTIONAL `run?` (a real backend,
  ABSENT in this frontend-only delivery). `defaultAgentRunner` supplies `simulate` and nothing else, so the
  seam is degradable and agentflow imports no backend (independence stays green).
- `simulateSquad(manifest, options)` — traverses the squad's `delegar` edges from the orchestrator in
  manifest order, running each member through the injected runner's `simulate`. Deterministic (order from
  the manifest, outputs from declared fixtures — same squad + fixtures 10× → byte-identical facts). Honest
  CROSS-agent stops: a member that blocks (or a member whose workflow/ref does not resolve) names the agent,
  the node, and the reason — never a silent skip.
- The FACT TRAIL (D1): an ordered `intencao → acao → io → decisao → evidencia` (+ `parada`) record, each
  labeled `fixture` vs `evidencia-declarada` (E6 — the host declares which member fixtures are captured real
  evidence), with sensitive I/O MASKED (`sensitivity`/`forbidden` keys go through the injected `maskingPolicy`,
  or are conservatively redacted to `MASKED_VALUE` when none is injected — never leaks PII), and a per-step
  masked shared-context snapshot for the step mode (D8). Facts are flat, so a UI filters by agent / kind / error.
- `validateSquadFlow(manifest, contract, { resolveWorkflow, resolveTool })` — the FLOW half of
  `CTX_PURPOSE_VIOLATION` (E5), which only exists once the squad graph + members' resolved tool effects are
  known: a `grounding` key read by a role whose workflow reaches a gate-requiring tool effect
  (`external-commitment`/`write-irreversible`) with NO gate in the squad is flagged. A squad WITH gates defers
  the precise per-path coverage to SL-12's `GATE_NOT_COVERING` (documented, not silently skipped). Fully
  degradable (both resolvers required) and reuses SL-1's `effectRequiresGate` predicate.
- Positive + negative + remediation + determinism (10×) + degradability vectors. apiSurface updated;
  independence / acidez / structuralShape untouched.
