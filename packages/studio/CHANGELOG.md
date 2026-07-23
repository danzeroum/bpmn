# @buildtovalue/studio

## 1.2.0-next.1

### Patch Changes

- @buildtovalue/adapters-bpmn@1.2.0-next.1
- @buildtovalue/react@1.2.0-next.1
- @buildtovalue/library-react@1.1.0-next.1

## 1.2.0-next.0

### Minor Changes

- 47d0de8: Handoff 15 V-6 — request-changes cycle (spec §2e). `VersionStatus` grows the
  additive `in-review` (EM REVISÃO ⟲) state: entered only by request-changes
  (candidate → in-review) and left only by re-submission (→ candidate), both
  through the core state machine; the status round-trips in XML via
  `bpmnr:version` like every other. `identity` adds
  `buildChangeRequestPayload` (+`CanonicalChangeRequestPayload`): the signed
  request binds versionRef + attached open threadRefs + the mandatory
  justification, verified by the unchanged `verifySignature`. `react` adds
  `buildChangeRequestPayloadFor`, the ⟲ gold seal (StatusBadge/VersionTimeline/
  i18n `status.in-review`) and scopes `reviewThreadsRule` to `target: 'active'`
  only — request-changes passes with open threads by design. `adapters-bpmn`
  adds `reviewChangesRequestedEntry` (+`REVIEW_CHANGES_REQUESTED` type) and maps
  `in-review` → `candidate` for the Biblioteca (documented loss) with the ⟲
  seal surviving in the gallery meta. `studio` adds `requestChanges` (the
  default soft path — `rejectPromotion` stays as the documented hard reject),
  the signed "Pedir mudanças…" flow in the ReviewScreen, the
  `review.changes.requested` N-3 bridge (`onReviewEvent`) and the re-submission
  diff that opens against the version that requested changes (v-pedido →
  v-nova) via registry lineage.
- b4557cd: SL-11 — EvidenceBundle as a canonical audit entry + ExecutionStore + LedgerExplorer renderer
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

### Patch Changes

- Updated dependencies [c4f2cbb]
- Updated dependencies [0627ee6]
- Updated dependencies [2d65a69]
- Updated dependencies [a99b6f9]
- Updated dependencies [3d7be05]
- Updated dependencies [c4ad4fe]
- Updated dependencies [db362a2]
- Updated dependencies [a127e70]
- Updated dependencies [cbe56a7]
- Updated dependencies [b9b625a]
- Updated dependencies [febfdb1]
- Updated dependencies [b204522]
- Updated dependencies [a3058f3]
- Updated dependencies [e04c719]
- Updated dependencies [2dc3518]
- Updated dependencies [00b17de]
- Updated dependencies [6d7f410]
- Updated dependencies [f034a2a]
- Updated dependencies [fcaaa8f]
- Updated dependencies [56fe142]
- Updated dependencies [5215bae]
- Updated dependencies [c8223c9]
- Updated dependencies [40d6efd]
- Updated dependencies [6dbc87a]
- Updated dependencies [8825d62]
- Updated dependencies [24c4684]
- Updated dependencies [47d0de8]
- Updated dependencies [c944070]
- Updated dependencies [b4557cd]
- Updated dependencies [dc29b38]
- Updated dependencies [d8d3269]
- Updated dependencies [627dbea]
- Updated dependencies [b9d565e]
- Updated dependencies [a8b3dda]
- Updated dependencies [88b9f0f]
- Updated dependencies [febc376]
- Updated dependencies [031c379]
  - @buildtovalue/react@1.2.0-next.0
  - @buildtovalue/core@1.2.0-next.0
  - @buildtovalue/conformance@1.2.0-next.0
  - @buildtovalue/adapters-bpmn@1.2.0-next.0
  - @buildtovalue/library-react@1.1.0-next.0
  - @buildtovalue/identity@1.1.0-next.0
  - @buildtovalue/copilot@1.1.0-next.0
  - @buildtovalue/audit@1.1.1-next.0
  - @buildtovalue/registry@1.0.2-next.0
  - @buildtovalue/soundness@1.0.2-next.0

## 1.1.0

### Minor Changes

- e54e5f3: Handoff 15 V-5 — Studio review panel (spec §2d). `BpmnDiffViewer` grows the
  embedded review surface: Threads/Mudanças side tabs synced with the V-3
  topological list, the ⚑ approval-gate banner with "ver no canvas", justified
  thread dismissal (min 10 chars, never silent) and Esc riding the single
  dismissal stack (thread popover → ΔN popover → diff mode). New
  `reviewThreadsRule` promotion rule blocks `evaluateGates` while OPEN threads
  anchor to the target (resolved/dismissed release; orphans never block).
  `adapters-bpmn` adds `reviewThreadDismissedEntry` (+`REVIEW_THREAD_DISMISSED`
  type) for the host-appended audit trail. `ReviewScreen` accepts an optional
  `reviewStore` and embeds the split diff canvas with the gated approve button;
  without a store it renders exactly as before (declared degradation).

### Patch Changes

- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [6e94b12]
- Updated dependencies [b6f631d]
- Updated dependencies [a96973f]
- Updated dependencies [943006f]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
- Updated dependencies [e54e5f3]
  - @buildtovalue/react@1.1.0
  - @buildtovalue/adapters-bpmn@1.1.0
  - @buildtovalue/core@1.1.0
  - @buildtovalue/conformance@1.1.0
  - @buildtovalue/audit@1.1.0
  - @buildtovalue/identity@1.0.1
  - @buildtovalue/registry@1.0.1
  - @buildtovalue/soundness@1.0.1
  - @buildtovalue/copilot@1.0.1
  - @buildtovalue/library-react@1.0.1
