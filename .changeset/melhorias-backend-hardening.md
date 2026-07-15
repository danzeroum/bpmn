---
'@buildtovalue/core': minor
'@buildtovalue/audit': minor
'@buildtovalue/identity': patch
'@buildtovalue/registry': patch
'@buildtovalue/dmn': patch
'@buildtovalue/cli': patch
'@buildtovalue/simulation': patch
'@buildtovalue/soundness': patch
'@buildtovalue/adapters-bpmn': patch
'@buildtovalue/copilot': patch
---

Backend hardening round (melhorias Bloco A): `canonicalJsonExact` + versioned
audit-ledger hash recipe (v2 — exact JSON of the whole entry; legacy v1 chains
keep verifying), O(n²) XML parsing fix, flow classification hoisted to core
(`isFlowNode`/`isFlowEdge`/`flowScopeOf`), structural validation in
`JsonSerializer.deserialize`, multi-process import warning, TAB/CR attribute
escaping, per-lane publication index in `VersionRegistry`, stricter CLI flag
parsing, and error-taxonomy alignment (`SimulationError`/`AdapterError`/DMN/
CLI errors now extend `BpmnError`).
