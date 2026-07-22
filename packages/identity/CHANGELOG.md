# @buildtovalue/identity

## 1.1.0-next.0

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

### Patch Changes

- Updated dependencies [0627ee6]
- Updated dependencies [a99b6f9]
- Updated dependencies [cbe56a7]
- Updated dependencies [b9b625a]
- Updated dependencies [e04c719]
- Updated dependencies [2dc3518]
- Updated dependencies [6d7f410]
- Updated dependencies [56fe142]
- Updated dependencies [40d6efd]
- Updated dependencies [8825d62]
- Updated dependencies [24c4684]
- Updated dependencies [47d0de8]
- Updated dependencies [dc29b38]
- Updated dependencies [031c379]
  - @buildtovalue/core@1.2.0-next.0

## 1.0.1

### Patch Changes

- 943006f: Backend hardening round (melhorias Bloco A): `canonicalJsonExact` + versioned
  audit-ledger hash recipe (v2 — exact JSON of the whole entry; legacy v1 chains
  keep verifying), O(n²) XML parsing fix, flow classification hoisted to core
  (`isFlowNode`/`isFlowEdge`/`flowScopeOf`), structural validation in
  `JsonSerializer.deserialize`, multi-process import warning, TAB/CR attribute
  escaping, per-lane publication index in `VersionRegistry`, stricter CLI flag
  parsing, and error-taxonomy alignment (`SimulationError`/`AdapterError`/DMN/
  CLI errors now extend `BpmnError`).
- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
  - @buildtovalue/core@1.1.0
