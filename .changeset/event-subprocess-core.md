---
'@buildtovalue/core': minor
---

Handoff 17 ES-1 — event subprocess in the core (spec §4a). New single-source
predicates `isEventSubprocess` (a common `subProcess` with
`properties.triggeredByEvent === true` — F7 containment reused whole) and
`startIsInterrupting` (OMG default true; `false` only when explicit) — the
E-4 execution matrix and the tightened lint rules will CONSUME these helpers,
never reimplement the predicate. Converter: `triggeredByEvent="true"` and
`isInterrupting="false"` serialize as the standard OMG attributes on their
element kinds, reserved from the property soup exactly when emitted, with the
OMG default OMITTED — and a DECLARED emission rule: the attributes round-trip
byte-stably wherever they appear (the converter preserves, it never judges —
semantics are the 4d lint's job). Sequence flow to or from the
event-subprocess SHELL is vetoed by the default rules (both directions,
always declared; children connect normally), and the shell is exempt from
`UNREACHABLE_NODE` like a boundary event. Frozen fixture
`eventSubprocFrozen.json` proves neutrality: without `triggeredByEvent`,
`toXml` and `computeDiagramHash` are byte-identical to the pre-ES-1 build.
