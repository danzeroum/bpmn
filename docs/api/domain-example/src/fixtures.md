# domain-example/src/fixtures

## Functions

### buildCompensationEditorDiagram()

```ts
function buildCompensationEditorDiagram(): BpmnDiagram;
```

`?comp=1` — Handoff 19 §6b: the compensation editor demo. A completed activity
with a compensation boundary (⟲) linked by ASSOCIATION to its handler
(isForCompensation, ◀◀ marker), plus a compensate THROW targeting the activity
(the «⟲ compensa: …» chip). Exercises the visual + picker; the full
«pacote de viagem» simulation demo is `buildCompensationPackageDiagram`.

#### Returns

`BpmnDiagram`

***

### buildCompensationSimDiagram()

```ts
function buildCompensationSimDiagram(): BpmnDiagram;
```

`?simulate=1&comp=1` — Handoff 19 §6d: the compensation SIMULATION. A travel
booking flow (hotel → flight → card) where hotel and flight are compensable
(⟲ boundary + handler by association) and the card is NOT. Advance so the
first activities complete, then the «Compensar» card reverses them in reverse
order (the card completed without a handler is a declared, non-compensated
line).

#### Returns

`BpmnDiagram`

***

### buildCompensationPackageDiagram()

```ts
function buildCompensationPackageDiagram(): BpmnDiagram;
```

`?compensation=1` — Handoff 19 §6e: the «pacote de viagem» compensation demo.
hotel ⟲ + passagem ⟲ (handlers by association) + cartão WITHOUT a handler (the
visible RISK) + an ERROR event subprocess with a compensate THROW (the
reference "error → revert" pattern). The throw targets the card (which has no
⟲ boundary), so `COMP_REF_NOT_COMPENSABLE` fires — a DELIBERATE, pedagogical
warning that names the risk; the rest is lint-clean. Simulate → advance so the
activities complete → «Compensar» reverses hotel + passagem, the card is a
declared uncompensated line.

#### Returns

`BpmnDiagram`

***

### buildCompensationNoHandlerDiagram()

```ts
function buildCompensationNoHandlerDiagram(): BpmnDiagram;
```

`?compno=1` — Handoff 19 §6c: a compensation boundary (⟲) with NO handler, so
`COMP_BOUNDARY_NO_HANDLER` shows in the lint dock with its quick-fix. Applying
it creates the handler + association (the shared builder = the palette FORM);
the finding clears. Drives the lint-dock e2e of the quick-fix.

#### Returns

`BpmnDiagram`
