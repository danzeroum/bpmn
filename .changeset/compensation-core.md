---
'@buildtovalue/core': minor
'@buildtovalue/conformance': minor
---

Handoff 19 CO-1 (§6a) — compensation in the core model + converter, completing
the OMG trigger family. No named root and no bucket (unlike the H16–H18 path):
the internal event kind is `compensate` (== the OMG element prefix
`compensateEventDefinition`), so it round-trips through the generic
`${kind}EventDefinition` machinery with zero special-case.

- The trio round-trips byte-stably: a compensation boundary (⟲) with a bare
  `compensateEventDefinition` (no `cancelActivity` — it fires post-completion),
  linked to its handler by `bpmn:association` (an already first-class built-in
  edge type, reused not forked), and the handler carrying `isForCompensation`.
- `isForCompensation` is now read on import (it was silently dropped before —
  an un-prefixed native attribute) and emitted, default `false` omitted.
- The compensate THROW carries an optional `activityRef`
  (`properties.compensateActivityRef`; absent = broadcast) and `waitForCompletion`
  (default `true` omitted); a CATCH never emits them.
- Structural veto (`edge.connect.pre`, both sides): a handler neither receives
  nor emits sequence flow, and a compensation boundary emits no outgoing
  sequence flow — the handler is reached only by association. An error/message
  boundary keeps flowing normally (kind-gated); associations pass.
- CONFORMANCE promotes `bpmn:compensateEventDefinition`; a real book-hotel corpus
  file (`60-compensation-v1.bpmn`) imports the full trio with zero warnings.
