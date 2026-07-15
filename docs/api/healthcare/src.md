# healthcare/src

## Variables

### HC\_NODE\_TYPES

```ts
const HC_NODE_TYPES: NodeTypeDefinition[];
```

Healthcare vocabulary (Handoff 5 §6): every clinical type maps to a
standard BPMN element (`xml.tag`), so the export stays interoperable —
third-party tools read plain BPMN while `bpmnr:meta type` preserves the
clinical identity for lossless round-trips (same mechanism as the btv
and dmn families).

***

### HC\_DECISION\_UNLINKED

```ts
const HC_DECISION_UNLINKED: "HC_DECISION_UNLINKED" = 'HC_DECISION_UNLINKED';
```

Stable code surfaced by Validate for unlinked clinical decisions (§6).

***

### clinicalDecisionLinkedRule

```ts
const clinicalDecisionLinkedRule: ValidationRule;
```

Visible validation (§6): a clinical decision without a linked DMN table
warns — the shape already shows the amber ▲ chip in the badge slot; this
rule carries the same fact into Validate/promotion surfaces.

***

### healthcarePlugin

```ts
const healthcarePlugin: BpmnPlugin;
```

The healthcare pack (Handoff 5 §6): 305° clinical-violet step of the
family wheel, clinical vocabulary mapped to interoperable BPMN elements
(`bpmnr:meta type` preserves identity), and the visible validation for
unlinked clinical decisions. Declares its body color so the plugin lint
enforces the gold/green reserve (§10.3).

## Functions

### ClinicalTaskShape()

```ts
function ClinicalTaskShape(__namedParameters): Element;
```

Clinical task: violet card with a caregiver glyph.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### ClinicalDecisionShape()

```ts
function ClinicalDecisionShape(__namedParameters): Element;
```

Clinical decision: violet card + table glyph. Visible validation (§6):
without a linked DMN table the badge slot (top-right, the SAME slot as
the businessRuleTask link badge) shows the amber "▲ sem tabela DMN
vinculada" chip; with a decisionRef it shows the gold link badge.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### GuidelineShape()

```ts
function GuidelineShape(__namedParameters): Element;
```

Guideline: document card (folded corner) referencing clinical evidence.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### PathwayGateShape()

```ts
function PathwayGateShape(__namedParameters): Element;
```

Pathway gate: diamond with the branching-pathway glyph.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`
