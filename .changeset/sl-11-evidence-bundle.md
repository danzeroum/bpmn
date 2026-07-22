---
'@buildtovalue/adapters-bpmn': minor
'@buildtovalue/studio': minor
'@buildtovalue/react': minor
---

SL-11 — EvidenceBundle as a canonical audit entry + ExecutionStore + LedgerExplorer renderer
(Handoff 22 "Squad Lane").

- `EvidenceBundle` (adapters-bpmn) — a neutral, serializable evidence record for one squad run, the
  squad analog of a simulation `Session`. It wraps the masked fact trail from `simulateSquad` (agentflow,
  which never imports audit/core) and REQUIRES the three governance refs: `policyRefs`,
  `decisionRuleRefs`, `maskingPolicyRef` (acceptance §10.4). `buildEvidenceBundle` REFUSES (throws) a bundle
  whose masked trail names no masking policy — masked evidence with no named policy is not attributable.
  It reuses core's integrity primitives (`canonicalJsonExact` + `sha256Hex`), never a bespoke format:
  `canonicalEvidenceBundle` exports byte-identical canonical JSON and `hashEvidenceBundle` hashes it
  deterministically (2× identical).
- `evidenceBundleEntry` maps a bundle to an `AuditEntryInput`. Appended through the normal
  `AuditLedger.append()`, the entry is hashed whole by core's v2 `computeEntryHash`, so the ledger's own
  `verify()` — and `@buildtovalue/audit`'s `verifyLedger`, which recomputes the identical hash — validate it
  with NO evidence-specific code. Tampering with a recorded ref breaks the chain (proven). `evidenceBundleOf`
  reconstructs the bundle from the chain (the chain IS the store).
- `ExecutionStore` (born here) — the injected, DEGRADABLE seam where a host persists evidence bundles: a
  consumer given `undefined` simply does not persist (the run still produces its bundle).
  `createInMemoryExecutionStore` is the default (records + lists newest-first) for tests/demos; a real host
  swaps durable storage without this package importing one.
- LedgerExplorer (studio) — a dedicated `evidence` category chip + a governance-refs detail section that
  surfaces the mandatory masking policy / policies / decision rules + the masked fact count, with a canonical
  evidence-bundle download. The section only renders when the masking policy is present (never unattributed
  evidence). i18n EN + PT-BR (react studio fragment).
- Vectors: mandatory-refs enforcement, canonical + hash determinism, ledger verify (+ tamper detection),
  chain round-trip, ExecutionStore degradability, and the renderer. apiSurface (adapters-bpmn) + typedoc updated.
