# @buildtovalue/dmn

## 1.0.2-next.0

### Patch Changes

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
- Updated dependencies [c4f2cbb]
- Updated dependencies [0627ee6]
- Updated dependencies [2d65a69]
- Updated dependencies [a99b6f9]
- Updated dependencies [3d7be05]
- Updated dependencies [db362a2]
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
  - @buildtovalue/core@1.1.0
