# dmn/src

## Classes

### DmnXmlConverter

Bidirectional converter between a DRD (modeled as a BpmnDiagram with
`dmn:*` node/edge types) and DMN 1.3+ XML (Handoff 5 §11 F-B1). Scope:
the §4.1 minimum viable DRD — decision, inputData, knowledgeSource,
businessKnowledgeModel and the three requirement edges, plus DMNDI
(shapes, bounds, edge waypoints) and the bpmnr governance extension.
Same guarantees as the BPMN converter: lossless round-trip, byte-stable
canonical export, XXE-safe parsing.

#### Constructors

##### Constructor

```ts
new DmnXmlConverter(): DmnXmlConverter;
```

###### Returns

[`DmnXmlConverter`](#dmnxmlconverter)

#### Methods

##### toXml()

```ts
toXml(diagram): string;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`string`

##### fromXml()

```ts
fromXml(xmlText): DmnImportResult;
```

###### Parameters

###### xmlText

`string`

###### Returns

[`DmnImportResult`](#dmnimportresult)

## Interfaces

### DecisionSummary

What the peek/inspector know about a linked decision — resolved by the
host (registry lookup) or, by default, from a `dmn:decision` node in the
same diagram (whose governance identity is the diagram's version).

#### Properties

##### ref

```ts
ref: string;
```

##### label

```ts
label: string;
```

##### semanticVersion?

```ts
optional semanticVersion?: string;
```

##### status?

```ts
optional status?: VersionStatus;
```

##### table?

```ts
optional table?: DecisionTable;
```

***

### DecisionPeekProps

#### Properties

##### resolveDecision?

```ts
optional resolveDecision?: (ref) => DecisionSummary | undefined;
```

Resolves a decisionRef; default looks for a dmn:decision in the diagram.

###### Parameters

###### ref

`string`

###### Returns

[`DecisionSummary`](#decisionsummary) \| `undefined`

##### onOpen?

```ts
optional onOpen?: (ref) => void;
```

Footer "editar tabela →" — opens the decision's own surface.

###### Parameters

###### ref

`string`

###### Returns

`void`

***

### DecisionTableEditorProps

#### Properties

##### decisionId

```ts
decisionId: string;
```

The `dmn:decision` node whose table is edited (same diagram/stack).

##### breadcrumbLevels?

```ts
optional breadcrumbLevels?: GovernanceBreadcrumbLevel[];
```

Governance trail rendered on top (fluxo vX ▸ nó ▸ tabela vY [SELO]).

##### onNavigate?

```ts
optional onNavigate?: (id, index) => void;
```

###### Parameters

###### id

`string` \| `null`

###### index

`number`

###### Returns

`void`

##### onPromote?

```ts
optional onPromote?: () => void;
```

Opens the host's formal promotion flow (same modal as the Designer).

###### Returns

`void`

***

### DmnImportResult

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### warnings

```ts
warnings: string[];
```

***

### DecisionInspectorOptions

#### Properties

##### searchDecisions?

```ts
optional searchDecisions?: (query) => DecisionSummary[];
```

Searches the host's decision registry. Defaults to the dmn:decision
nodes of the current diagram (label/ref substring match).

###### Parameters

###### query

`string`

###### Returns

[`DecisionSummary`](#decisionsummary)[]

##### onOpen?

```ts
optional onOpen?: (ref) => void;
```

"abrir →" — opens the decision's own editing surface (drill-down).

###### Parameters

###### ref

`string`

###### Returns

`void`

##### onDiff?

```ts
optional onDiff?: (ref) => void;
```

"diff" — compares the linked version against the draft (optional).

###### Parameters

###### ref

`string`

###### Returns

`void`

##### specVersion?

```ts
optional specVersion?: string;
```

Spec label shown in the section header — parameterized (§11.4).

***

### DecisionTableColumn

#### Properties

##### id

```ts
id: string;
```

##### label

```ts
label: string;
```

##### expression

```ts
expression: string;
```

FEEL input expression / output name.

##### typeRef

```ts
typeRef: string;
```

***

### DecisionRule

#### Properties

##### id

```ts
id: string;
```

##### inputEntries

```ts
inputEntries: string[];
```

FEEL unary tests, one per input column ('-' = any).

##### outputEntries

```ts
outputEntries: string[];
```

FEEL expressions, one per output column.

##### annotation?

```ts
optional annotation?: string;
```

***

### DecisionTable

#### Properties

##### hitPolicy

```ts
hitPolicy: "U" | "A" | "P" | "F" | "R" | "O" | "C";
```

##### inputs

```ts
inputs: DecisionTableColumn[];
```

##### outputs

```ts
outputs: DecisionTableColumn[];
```

##### rules

```ts
rules: DecisionRule[];
```

***

### InvalidCell

#### Properties

##### ruleId

```ts
ruleId: string;
```

##### column

```ts
column: number;
```

Column index across inputs+outputs (inputs first).

##### message

```ts
message: string;
```

***

### SfeelDecisionSupport

S-FEEL-backed decision support for the token simulator (Handoff 9 SF-2).

Structurally implements `@buildtovalue/simulation`'s `DecisionEvaluator`
WITHOUT importing it (dmn does not depend on simulation): the host passes
the returned object to `SimulationOptions.decisions`. Tables are resolved
from the node itself (`properties.decisionTable`) by default; hosts with a
registry/DRD lookup inject their own `resolveTable`.

#### Methods

##### hasDecision()

```ts
hasDecision(nodeId): boolean;
```

###### Parameters

###### nodeId

`string`

###### Returns

`boolean`

##### inputsOf()

```ts
inputsOf(nodeId): string[];
```

###### Parameters

###### nodeId

`string`

###### Returns

`string`[]

##### evaluate()

```ts
evaluate(nodeId, context): object;
```

###### Parameters

###### nodeId

`string`

###### context

`Record`\<`string`, `number` \| `string` \| `boolean`\>

###### Returns

`object`

###### outputs?

```ts
optional outputs?: Record<string, string | number | boolean>;
```

###### ruleIndex?

```ts
optional ruleIndex?: number;
```

###### noMatch?

```ts
optional noMatch?: boolean;
```

###### nonSimulable?

```ts
optional nonSimulable?: object;
```

###### nonSimulable.cell

```ts
cell: string;
```

###### nonSimulable.reason

```ts
reason: string;
```

## Type Aliases

### HitPolicy

```ts
type HitPolicy = keyof typeof HIT_POLICIES;
```

***

### DmnEdgeType

```ts
type DmnEdgeType = typeof DMN_EDGE_TYPES[number];
```

## Variables

### DMN\_NS

```ts
const DMN_NS: "https://www.omg.org/spec/DMN/20191111/MODEL/" = 'https://www.omg.org/spec/DMN/20191111/MODEL/';
```

***

### DMNDI\_NS

```ts
const DMNDI_NS: "https://www.omg.org/spec/DMN/20191111/DMNDI/" = 'https://www.omg.org/spec/DMN/20191111/DMNDI/';
```

***

### DMN\_SPEC\_VERSION

```ts
const DMN_SPEC_VERSION: "DMN 1.3" = 'DMN 1.3';
```

Human-readable spec version matching DMN_NS (20191111 = DMN 1.3). §11.4:
surfaces show this configured string — "DMN 1.x" is never hardcoded in a
component; hosts override it where their converter targets change.

***

### HIT\_POLICIES

```ts
const HIT_POLICIES: object;
```

DMN hit policies with their effect phrases (Handoff 5 §4.2 menu).

#### Type Declaration

##### U

```ts
readonly U: "Unique — no overlap, single match" = 'Unique — no overlap, single match';
```

##### A

```ts
readonly A: "Any — overlaps agree, single output" = 'Any — overlaps agree, single output';
```

##### P

```ts
readonly P: "Priority — highest output priority wins" = 'Priority — highest output priority wins';
```

##### F

```ts
readonly F: "First — first matching rule wins" = 'First — first matching rule wins';
```

##### R

```ts
readonly R: "Rule order — all matches, rule order" = 'Rule order — all matches, rule order';
```

##### O

```ts
readonly O: "Output order — all matches, output priority order" = 'Output order — all matches, output priority order';
```

##### C

```ts
readonly C: "Collect — all matches aggregated" = 'Collect — all matches aggregated';
```

***

### DMN\_NODE\_TYPES

```ts
const DMN_NODE_TYPES: NodeTypeDefinition[];
```

DRD node types (Handoff 5 §4.1) — minimum viable DMN family. Sizes are the
spec's; geometry differentiates the family internally (OMG DMN notation),
the 185° teal step differentiates it from BPMN. The `dmn:` prefix keeps
the vocabulary out of the BPMN namespace, mirroring domain plugins.

***

### DMN\_EDGE\_TYPES

```ts
const DMN_EDGE_TYPES: readonly ["dmn:informationRequirement", "dmn:knowledgeRequirement", "dmn:authorityRequirement"];
```

Requirement edge types (§4.1): one family color, differentiated by FORM —
information solid/filled arrow, knowledge dashed/open arrow, authority
dotted/filled disc. Direction in the model: source = required element,
target = requiring element (matches how DMN nests the requirement inside
the requiring element).

***

### REQUIREMENT\_OWNERS

```ts
const REQUIREMENT_OWNERS: Record<DmnEdgeType, string[]>;
```

Node types that may own each requirement kind (per the DMN spec).

***

### dmnPlugin

```ts
const dmnPlugin: BpmnPlugin;
```

The DMN family plugin (Handoff 5 §4): DRD node types + shapes, the three
requirement edge styles (one family color, straight routing, form-coded
tips) and the DMN palette group. Claims the 185° step of the color wheel
(§7.3) and declares its body color so the plugin lint can enforce the
gold/green reserve (§10.3).

## Functions

### DecisionPeek()

```ts
function DecisionPeek(__namedParameters): Element | null;
```

Read-only decision peek (Handoff 5 §4.3, spec revisada): opens on the
SELECTION of a businessRuleTask with a decisionRef — selection is the
trigger so touch works without hover. A 300px DOM overlay positioned to
the right of the node (flipped when it wouldn't fit), rendered as a child
of <BpmnDesigner> — ZERO nodes inserted into the SVG (aceite 10.5.1).
Closes via the single Esc dismissal stack (above selection, below
popovers — §11.1), on deselection, and on drill-down.

#### Parameters

##### \_\_namedParameters

[`DecisionPeekProps`](#decisionpeekprops)

#### Returns

`Element` \| `null`

***

### DecisionTableEditor()

```ts
function DecisionTableEditor(__namedParameters): Element;
```

Decision table editor (Handoff 5 §4.2) — HTML/DOM surface sharing the BTV
tokens, OUTSIDE the SVG budget. Canonical DMN anatomy: hit policy cell
(gold), input/output headers split by the 3px double divider, rule-number
column, dashed annotation column. Every mutation is ONE command on the
shared CommandStack (global undo merges canvas + table chronologically);
a non-draft table is read-only — editing proposes a new version through
the core's clone/supersede flow (aceite 10.5.4).

#### Parameters

##### \_\_namedParameters

[`DecisionTableEditorProps`](#decisiontableeditorprops)

#### Returns

`Element`

***

### decisionInspectorSection()

```ts
function decisionInspectorSection(options?): InspectorSection;
```

`DECISÃO · DMN` inspector section for businessRuleTask (Handoff 5 §4.3,
wireframe 2d) — a plugin `InspectorSection` rendered by PropertiesPanel.
Linked: card with name + semver + seal + hit policy + rule count and the
abrir → / diff / desvincular actions. Unlinked: registry search with
per-result vincular, or "+ criar nova tabela" (born RASCUNHO). Every
action is ONE undoable command + ONE ledger entry (aceite 10.5.2).

#### Parameters

##### options?

[`DecisionInspectorOptions`](#decisioninspectoroptions) = `{}`

#### Returns

`InspectorSection`

***

### createDecisionTable()

```ts
function createDecisionTable(partial?): DecisionTable;
```

A starter table: 1 input, 1 output, 1 any-rule — born a draft artifact.

#### Parameters

##### partial?

`Partial`\<[`DecisionTable`](#decisiontable)\> = `{}`

#### Returns

[`DecisionTable`](#decisiontable)

***

### decisionTableOf()

```ts
function decisionTableOf(node): DecisionTable | undefined;
```

The table stored on a decision node, if any.

#### Parameters

##### node

###### properties

`Record`\<`string`, `unknown`\>

#### Returns

[`DecisionTable`](#decisiontable) \| `undefined`

***

### validateDecisionTable()

```ts
function validateDecisionTable(table): InvalidCell[];
```

Structural validation of FEEL cells — unbalanced quotes/brackets and empty
output entries. Never color-only in the UI: the editor renders ▲ + border
+ tooltip per invalid cell (§4.2).

#### Parameters

##### table

[`DecisionTable`](#decisiontable)

#### Returns

[`InvalidCell`](#invalidcell)[]

***

### linkDecisionCommand()

```ts
function linkDecisionCommand(nodeId, decisionRef): Command;
```

Links a decision to a businessRuleTask — ONE undoable command, ONE ledger
entry (aceite 10.5.2); unlink never deletes the table.

#### Parameters

##### nodeId

`string`

##### decisionRef

`string`

#### Returns

`Command`

***

### unlinkDecisionCommand()

```ts
function unlinkDecisionCommand(nodeId, decisionRef?): Command;
```

#### Parameters

##### nodeId

`string`

##### decisionRef?

`string`

#### Returns

`Command`

***

### createDecisionCommand()

```ts
function createDecisionCommand(nodeId, decision): Command;
```

"+ criar nova tabela" (wireframe 2d): adds the decision node (born a draft
artifact with its starter table) AND links it to the businessRuleTask as
ONE undoable command / ONE ledger entry (aceite 10.5.2).

#### Parameters

##### nodeId

`string`

##### decision

`BpmnNode`

#### Returns

`Command`

***

### setDecisionTableCommand()

```ts
function setDecisionTableCommand(decisionId, table): Command;
```

Creates (or replaces) the table bound to a DECISION node — undoable.

#### Parameters

##### decisionId

`string`

##### table

[`DecisionTable`](#decisiontable)

#### Returns

`Command`

***

### createSfeelDecisionSupport()

```ts
function createSfeelDecisionSupport(diagram, resolveTable?): SfeelDecisionSupport;
```

#### Parameters

##### diagram

`BpmnDiagram`

##### resolveTable?

(`node`) => [`DecisionTable`](#decisiontable) \| `undefined`

#### Returns

[`SfeelDecisionSupport`](#sfeeldecisionsupport)

***

### nonSimulableCells()

```ts
function nonSimulableCells(table): NonSimulable[];
```

Static ⚠ analysis of a node's table for the editor (§5 feedback-before-
simulation): every out-of-subset cell with rule/column coordinates.

#### Parameters

##### table

[`DecisionTable`](#decisiontable)

#### Returns

`NonSimulable`[]

***

### DmnDecisionShape()

```ts
function DmnDecisionShape(__namedParameters): Element;
```

Decision: SHARP rectangle (rx 0); table glyph bottom-left when it has a
decision table bound.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### DmnInputDataShape()

```ts
function DmnInputDataShape(__namedParameters): Element;
```

Input data: flattened oval (rx = h/2) — lighter fill: it is data, not logic.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### DmnKnowledgeSourceShape()

```ts
function DmnKnowledgeSourceShape(__namedParameters): Element;
```

Knowledge source: rectangle with a WAVY base (2 alternating curves,
amplitude 8) — paper-neutral fill: external authority.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`

***

### DmnBusinessKnowledgeModelShape()

```ts
function DmnBusinessKnowledgeModelShape(__namedParameters): Element;
```

Business knowledge model: rectangle with two 12px cut corners (top-left in
perspective + bottom-right), inner edge visible.

#### Parameters

##### \_\_namedParameters

`ShapeProps`

#### Returns

`Element`
