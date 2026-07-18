---
'@buildtovalue/react': minor
'@buildtovalue/adapters-bpmn': minor
---

Handoff 16 E-3 — governed event-definition bindings (`nome@semver`) via the
Biblioteca (spec §3b). react: the host injects a synchronous
`EventDefinitionResolver` through `BpmnPlugin.eventDefinitionResolver` (first
wins — the editor never consults a registry); the E-2 picker gains a
"Da Biblioteca" section whose selection binds in ONE composite
(`buildBindCommand`: local `gov-{nome}` mirror upsert + `eventDefinitionRef` +
pinned `properties.eventDefinitionBinding`, serialized as an ordinary
`bpmnr:property` — byte-stable, never a vendor attribute); unbinding
(`buildUnbindCommand`) garbage-collects the orphaned mirror in the same
composite. A canvas chip (transient — excluded from exports) and a panel seal
show the resolution state with glyph+text (`✓ VIGENTE` / `⚠ CANDIDATA` /
`✕ NÃO RESOLVIDA`), degrading DECLAREDLY to plain text when no resolver is
configured. `eventBindingRule(resolver)` validates bindings —
`SIG_REF_MISSING` (error) / `SIG_REF_STALE` (warning) — through the existing
issue badges. The `gov-*` mirror is read-only in the panel (managed by the
Library; editing = promoting a new version) and counts as a normal usage for
the deletion veto, and the pin never moves on artifact promotion — only an
explicit, audited re-bind. adapters-bpmn: `eventDefinitionCatalogAdapter`
(read-only Biblioteca catalog, one card per name with the version timeline)
and `eventBindingChangedEntry`/`EVENT_BINDING_CHANGED_TYPE` (ledger builder
for the explicit ref change, host-appended).
