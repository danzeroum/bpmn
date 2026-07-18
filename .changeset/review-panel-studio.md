---
'@buildtovalue/react': minor
'@buildtovalue/adapters-bpmn': minor
'@buildtovalue/studio': minor
---

Handoff 15 V-5 — Studio review panel (spec §2d). `BpmnDiffViewer` grows the
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
