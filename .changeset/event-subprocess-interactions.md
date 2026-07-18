---
'@buildtovalue/react': minor
---

Handoff 17 ES-3 — event-subprocess interactions (spec §4c). New
`announceVeto(reason)` on the diagram context: the DECLARED gesture-veto
channel — a rejected connect drop or a Tab on the event-subprocess shell
lights the same 🔒 surface as `lastVeto`, with the same lifecycle (replaced
by the next veto, cleared by the next successful command). The shell offers
NO connection ports and its context pad drops connect/append entries;
children keep the full pad and Tab chaining (the veto is shell-only, both
directions, with the ES-1 rule's message — one message, one source).
`InterruptingToggle` ("Interrompe o escopo") appears ONLY on the start of an
event subprocess (`isEventSubprocessStart` — core helpers on both sides of
the predicate): one undoable `updateNodeCommand`, with the OMG default
(interrupting) stored as the ABSENT field. The E-4 execution matrix is
TIGHTENED: `eventExecutionModeOf` catch-error now requires
`isEventSubprocess` on the parent (the same single-source helper the ES-4
lint will consume); the old "any subProcess" case is the new negative, and
the E-4 artifacts (tests + `?eventio=1` demo) migrate in this change.
Cross-scope flow (child → outside) keeps the behavior inherited from common
sub-processes — parity tested; the OMG non-conformance is registered in
pendencias.md, never a silent divergence.
