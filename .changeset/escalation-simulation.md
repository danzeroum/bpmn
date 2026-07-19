---
'@buildtovalue/simulation': minor
'@buildtovalue/react': minor
---

Handoff 18 §5e — escalation throws in the token simulator (`throwEscalation`),
completing the OMG trigger family. The candidate topology is enumerated by the
SAME shared core source as the lint (`eligibleEscalationCatches`, no fork); the
simulator builds the scoped, tiered resolution on top — the identical total
order and ambiguity rule as `throwError` (`especificidade > escopo > catch-all`;
>1 in the winning tier is a `BlockedDecision`).

Two things differ, both declared: the personality is NON-INTERRUPTING (a
non-interrupting catch leaves the host token in place and re-emerges a parallel
token at the catch — the host continues), and NO eligible catch = the escalation
DISSOLVES (a declared no-op in the trail, the host token continues), the binding
contrast with an uncaught error's stop.

New public types `EscalationDestination` / `EscalationThrowOption` and the
`escalationThrowOptions` state; the react `SimulationPanel` gains the «Escalate»
card, which predicts each option's destination + mode as glyph + text before the
throw (informed decision). `BpmnSimulator` gains an `onEscalationThrown` callback
(the engine stays pure) so the host maps a fired escalation to a ledger entry
(`escalationRaisedEntry` — the escalation actually happened).
