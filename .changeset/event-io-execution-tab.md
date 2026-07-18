---
'@buildtovalue/react': minor
'@buildtovalue/core': patch
---

Handoff 16 E-4 — event I/O on the Execução tab (spec §3c). react: executable
EVENTS join activities behind the SAME `BpmnPlugin.engine` gate (no plugin →
panel byte-identical); the matrix lives in react (`eventExecutionModeOf` —
OMG semantics, not an engine opinion): message/signal throws (intermediate +
end) edit payload mappings (var → destino), error catches (boundary + error
start inside a subProcess) edit the errCode/errMsg capture variables — the
throw/catch asymmetry is imposed by the UI (payload never on catch, capture
never on throw). Props live under engine-named keys (`payloadKey`,
`errorCodeVariableKey`, `errorMessageVariableKey` on `EngineBridge`, with
`{id}:*` defaults), every commit is one undoable `updateNodeCommand`, and the
essential keys are excluded from the advanced fold (no double render). Clean
model: blank mapping rows are pruned on commit and an empty list removes the
property entirely — the absent field keeps prior exports byte-identical.
core: `updateNodeCommand`/`updateEdgeCommand` now DROP keys patched to
`undefined` instead of keeping an own key with an undefined value, which
leaked a value-less `bpmnr:property` into exports.
