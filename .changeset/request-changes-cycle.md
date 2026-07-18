---
'@buildtovalue/core': minor
'@buildtovalue/identity': minor
'@buildtovalue/react': minor
'@buildtovalue/adapters-bpmn': minor
'@buildtovalue/studio': minor
'@buildtovalue/dmn': patch
---

Handoff 15 V-6 — request-changes cycle (spec §2e). `VersionStatus` grows the
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
