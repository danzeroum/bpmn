# @buildtovalue/dmn

## 1.0.1

### Patch Changes

- 943006f: Backend hardening round (melhorias Bloco A): `canonicalJsonExact` + versioned
  audit-ledger hash recipe (v2 — exact JSON of the whole entry; legacy v1 chains
  keep verifying), O(n²) XML parsing fix, flow classification hoisted to core
  (`isFlowNode`/`isFlowEdge`/`flowScopeOf`), structural validation in
  `JsonSerializer.deserialize`, multi-process import warning, TAB/CR attribute
  escaping, per-lane publication index in `VersionRegistry`, stricter CLI flag
  parsing, and error-taxonomy alignment (`SimulationError`/`AdapterError`/DMN/
  CLI errors now extend `BpmnError`).
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [6e94b12]
- Updated dependencies [b6f631d]
- Updated dependencies [a96973f]
- Updated dependencies [943006f]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
- Updated dependencies [e54e5f3]
  - @buildtovalue/react@1.1.0
  - @buildtovalue/core@1.1.0
