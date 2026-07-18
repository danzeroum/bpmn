---
'@buildtovalue/core': minor
'@buildtovalue/conformance': patch
---

Foreign extension passthrough (`zeebe:*`/`camunda:*` — the registered
pendency's dedicated PR). Foreign `extensionElements` children on flow nodes,
edges and the `<bpmn:process>` itself, foreign-prefixed attributes
(`zeebe:modelerTemplate`, `camunda:asyncBefore`) and the root's foreign
`xmlns:*` declarations now survive the round-trip: semantically lossless on
import, byte-stable between bpmn-react exports. Model storage is additive
(`foreignExtensions`/`foreignAttributes` on nodes/edges,
`processForeignExtensions`/`foreignNamespaces` on the diagram) — absent
fields keep every pre-existing hash and export byte-identical (frozen-fixture
proven). Changed foreign extensions surface in `computeDiff`/`diffDiagrams`
as NAMED fields (the element tag, or `@`-prefixed attribute name) so the
review ΔN popover renders them per field — never an opaque blob. The
whitespace-trim and CDATA→escaped-text normalizations are documented contract
in `docs/format-spec.md`. Conformance: real-corpus assertion that preserved
extensions re-export; CONFORMANCE.md generator gains the passthrough section.
