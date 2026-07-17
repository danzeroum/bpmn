---
'@buildtovalue/react': minor
'@buildtovalue/adapters-bpmn': minor
---

Handoff 15 V-4 — anchored review comments (§2c). `@buildtovalue/react`: the
host-injected `ReviewStore` contract (AIProvider mold — sync CRUD + subscribe;
reference `createInMemoryReviewStore` included): without a store the review
surface does not exist (declared degradation, §1.5) and the editor never
persists review data. Gold pins (`--btv-gold`) anchor by elementId — the
issueBadges pattern, so they follow moves/layout for free — with glyph+count
(💬N, never color alone) and a ≥44px hit; resolved-only elements show the
hollow ✓. Double-click an element to open its thread; the popover
opens/replies/resolves, `ia.copilot@…`/aiAssisted messages carry the ✦
mixed-authorship seal, and the N-3 catalog grows to 16 with the typed
`review.thread.opened`/`review.thread.resolved`/`review.changes.requested`
events (V-0 decision 5). Orphaned threads (anchor removed from the target)
are NEVER dropped: they list in a warning bar and stay navigable — the pan
goes to the last known anchor on the v-base. Nothing of the review ever
touches the model: the XML round-trip stays byte-identical with open threads
(the PR's central test) and pins/threads are TRANSIENT (clean exports
mid-thread). `@buildtovalue/adapters-bpmn`: `reviewCommentEntry` /
`reviewThreadResolvedEntry` builders (`REVIEW_COMMENT_ADDED` /
`REVIEW_THREAD_RESOLVED`) — every message and resolution is its own chain
entry the host appends; ledger motor untouched, chain verifies.
