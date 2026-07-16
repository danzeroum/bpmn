---
'@buildtovalue/core': minor
---

Handoff 15 V-1 — `diffDiagrams(base, target): DiffEntry[]`, the review-grade
semantic diff (§2a). Built ON `computeDiff` (untouched): classifies every
element change into `added | removed | moved | changed | rerouted` — a node
update that only moves is `moved` (with `from`/`to` for the ghost + arrow); a
node that moves AND changes is `changed` with `moved: true`; an edge whose
only change is `waypoints` is `rerouted` (its own category — a re-route never
pollutes ΔN nor `changed`); a `removedInVersion` transition reads as
removed/added (a closed element IS removed for review); supersession reads as
`changed` with a `supersededBy` breadcrumb (hard replacement) or as the
removed/added pair (temporal shape). `changes` never includes
x/y/waypoints/removedInVersion — its size is the ΔN badge. Entries come in a
STABLE graph-reading order (topological rank from the source nodes, removed
elements ranked by the BASE graph, ties by base position then id) — a pure
function of content, proven by a map-insertion shuffle test and a 10×
determinism test.
