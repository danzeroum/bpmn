---
'@buildtovalue/simulation': minor
'@buildtovalue/react': minor
---

Handoff 16 E-6 — honest event matching in the simulator (spec §3e, S-FEEL
discipline: exact where possible, a DECLARED stop everywhere else, never a
guessed route). simulation: `throwError(host, errorRef?)` — the user throws
the ERROR (named definition or uncatalogued), the ENGINE resolves the boundary
by matching: a specific `errorRef` match beats the DECLARED catch-all
(documented precedence — both present is NOT ambiguity); two eligible
specifics, two catch-alls, or an uncaught error are `BlockedDecision` stops
naming node, reason and candidates. `throwSignal` broadcasts to every waiting
matching catch; `throwMessage` delivers to a single destination — more than
one waiting candidate is a declared stop (runtime correlation is not
simulable; documented in limitations.md). All three are new serializable
`Decision` kinds that replay through the SAME matching; `fireBoundary` and
old scenarios stay intact, and error boundaries leave the manual
`boundaryOptions` list for the new `errorThrowOptions` cards. react: the
SimulationPanel renders the inverted "Throw error" card (per-definition
buttons + the "uncatalogued error" path that exercises the catch-all).
